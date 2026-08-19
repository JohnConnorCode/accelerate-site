import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { createClient } from "@supabase/supabase-js";

function hydrateEnvFromLocalFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (!key || !value) continue;
    if (process.env[key] === undefined) {
      process.env[key] = value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value;
    }
  }
}

type Cookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
};

type SetupCheck = { id: string; label: string; status: "ready" | "action" | "degraded" | "optional" | "disabled"; description?: string; lastFailure?: string | null };
type SetupResponse = { checks: SetupCheck[]; summary: { launchReady: boolean; requiredReady: number; requiredTotal: number } };

hydrateEnvFromLocalFile(".env.local");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const outDir = "/tmp/accelerate-setup-qa";
mkdirSync(outDir, { recursive: true });
if (ADMIN_EMAIL === undefined || ADMIN_EMAIL.trim() === "") {
  throw new Error("ADMIN_EMAIL is required for founder setup QA.");
}
if (!existsSync(outDir)) {
  writeFileSync(join(outDir, ".keep"), "", { flag: "w" });
}

function getProjectRef() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "";
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "";
  }
}

function parseCookieEnvelope(raw: string): Cookie[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => {
      const cookie = entry as Record<string, unknown>;
      const name = String(cookie.name ?? "");
      if (!name) return null;
      return {
        name,
        value: String(cookie.value ?? ""),
        domain: String(cookie.domain ?? "localhost"),
        path: String(cookie.path ?? "/"),
        expires: Number(cookie.expires ?? 0),
        httpOnly: Boolean(cookie.httpOnly),
        secure: Boolean(cookie.secure),
        sameSite: ["Strict", "Lax", "None"].includes(String(cookie.sameSite)) ? String(cookie.sameSite) as Cookie["sameSite"] : "Lax",
      };
    })
    .filter((cookie): cookie is Cookie => Boolean(cookie));
}

function toBase64CookiePayload(payload: unknown, baseUrl: string): Cookie[] {
  if (!payload || typeof payload !== "object") return [];
  const projectRef = getProjectRef();
  if (!projectRef) return [];
  const expiresAt = Number((payload as { expires_at?: string | number }).expires_at);
  const expires = Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : 0;
  const token = `base64-${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const origin = new URL(baseUrl);
  const baseCookie: Omit<Cookie, "name" | "value"> = {
    domain: origin.hostname,
    path: "/",
    expires,
    httpOnly: true,
    secure: origin.protocol === "https:",
    sameSite: "Lax",
  };
  const cookieKey = `sb-${projectRef}-auth-token`;
  if (token.length <= 3180) {
    return [{ ...baseCookie, name: cookieKey, value: token }];
  }

  return Array.from({ length: Math.ceil(token.length / 3180) }, (_, index) => ({
    ...baseCookie,
    name: `${cookieKey}.${index}`,
    value: token.slice(index * 3180, (index + 1) * 3180),
  }));
}

async function applyFounderCookies(context: BrowserContext, baseUrl: string, cookies: Cookie[]) {
  const origin = new URL(baseUrl);
  await context.addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      domain: cookie.domain || origin.hostname,
      path: cookie.path || "/",
      secure: cookie.secure ?? origin.protocol === "https:",
      sameSite: cookie.sameSite || "Lax",
    })),
  );
}

async function loadFounderCookies() {
  const explicit = parseCookieEnvelope(process.env.FOUNDER_ADMIN_COOKIES || "");
  if (explicit.length) return explicit;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to mint a founder session.");
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const link = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL!,
    options: { redirectTo: `${BASE_URL}/admin/setup` },
  });
  if (link.error || !link.data) {
    throw new Error(link.error?.message || "Could not generate founder magic-link session.");
  }
  const actionLink = link.data.properties?.hashed_token;
  if (!actionLink) throw new Error("Could not resolve the founder magic-link callback token.");
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: actionLink,
    type: "magiclink",
  });
  if (verifyError || !verified?.session) {
    throw new Error(verifyError?.message || "Could not exchange founder magic-link for a server session.");
  }
  const cookies = toBase64CookiePayload(verified.session, BASE_URL);
  if (!cookies.length) {
    throw new Error("Could not encode verified founder session into browser cookie shape.");
  }
  return cookies;
}

async function runSetupMobileChecks() {
  const cookies = await loadFounderCookies();
  const browser = await chromium.launch({ headless: true });

  const apiContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await applyFounderCookies(apiContext, BASE_URL, cookies);
  const response = await apiContext.request.get(`${BASE_URL}/api/admin/setup`);
  if (!response.ok()) {
    const body = await response.text();
    console.error(`Setup API status ${response.status()} body: ${body.slice(0, 220)}`);
    await apiContext.close();
    await browser.close();
    throw new Error(`Authenticated /api/admin/setup request failed with ${response.status()}`);
  }
  const payload = await response.json() as SetupResponse;
  if (!Array.isArray(payload.checks)) throw new Error("Setup response missing checks array.");
  const schemaCheck = payload.checks.find((check) => check.id === "schema");
  if (!schemaCheck) {
    await apiContext.close();
    await browser.close();
    throw new Error("Setup API response missing the schema check.");
  }
  if (!schemaCheck.description) {
    await apiContext.close();
    await browser.close();
    throw new Error("Schema check missing a descriptive status explanation.");
  }
  if (!["ready", "action", "degraded", "optional", "disabled"].includes(schemaCheck.status)) {
    await apiContext.close();
    await browser.close();
    throw new Error(`Unknown schema status ${schemaCheck.status}`);
  }

  const violations: string[] = [];
  const screenshotPathMobile = `${outDir}/setup-mobile.png`;
  const screenshotPathDesktop = `${outDir}/setup-desktop.png`;

  const checks = ["mobile", "desktop"] as const;
  for (const viewport of checks) {
    const context = await browser.newContext({
      viewport: viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1024 },
      colorScheme: "light",
    });
    await applyFounderCookies(context, BASE_URL, cookies);
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") {
        violations.push(`${viewport}: console error ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      violations.push(`${viewport}: page error ${error.message}`);
    });

    const response = await page.goto(`${BASE_URL}/admin/setup`, { waitUntil: "networkidle" });
    if (!response || !response.ok()) {
      await context.close();
      await apiContext.close();
      await browser.close();
      throw new Error(`Setup page navigation failed for ${viewport}: ${response?.status() || "none"}`);
    }

    await page.getByRole("heading", { name: "Setup Center" }).waitFor({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      title: Boolean(document.querySelector("h1")),
      schemaCard: Boolean(document.querySelector('[id="schema"]')),
      hasSettledCards: !!document.querySelectorAll('[id="supabase"] [class*="rounded-full"]').length,
      overflowPx: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    }));

    if (!state.title || !state.schemaCard) {
      violations.push(`${viewport}: setup interface did not render expected elements.`);
    }
    if (state.overflowPx > (viewport === "mobile" ? 420 : 1500)) {
      violations.push(`${viewport}: visible width exceeded viewport (${state.overflowPx}px).`);
    }

    await page.screenshot({
      path: viewport === "mobile" ? screenshotPathMobile : screenshotPathDesktop,
      fullPage: true,
    });
    await context.close();
  }

  await apiContext.close();
  await browser.close();

  if (violations.length) {
    throw new Error(`Setup QA detected issues:\n${violations.join("\n")}`);
  }

  const readiness = payload.summary.launchReady ? "ready" : "action/degraded";
  const result = {
    checks: payload.checks.length,
    schemaStatus: schemaCheck.status,
    schemaLastFailure: schemaCheck.lastFailure ?? null,
    requiredReady: payload.summary.requiredReady,
    requiredTotal: payload.summary.requiredTotal,
    launchReady: readiness,
    mobileScreenshot: screenshotPathMobile,
    desktopScreenshot: screenshotPathDesktop,
    schemaDescription: schemaCheck.description,
  };
  writeFileSync(`${outDir}/setup-qa-result.json`, JSON.stringify(result, null, 2));
  console.log("Setup mobile QA passed:", JSON.stringify(result));
}

void runSetupMobileChecks();

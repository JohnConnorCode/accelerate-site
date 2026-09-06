import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

function hydrateEnvFromLocalFile(filePath) {
  if (!existsSync(filePath)) return;
  const body = readFileSync(filePath, "utf8");
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (!key || value === undefined || process.env[key] !== undefined) continue;
    process.env[key] =
      value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value;
  }
}

hydrateEnvFromLocalFile(".env.local");

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const outDir = "/tmp/accelerate-booking-mode";
mkdirSync(outDir, { recursive: true });

const secretNeedles = [
  process.env.CALENDLY_WEBHOOK_SECRET,
  process.env.CALENDLY_PERSONAL_ACCESS_TOKEN,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.RESEND_API_KEY,
  process.env.OPENROUTER_API_KEY,
].filter((value) => value && value.length > 8);

function assertNoSecrets(label, text) {
  for (const secret of secretNeedles) {
    if (text.includes(secret)) {
      throw new Error(`${label} exposed a configured secret`);
    }
  }
}

function setupPayload(bookingMode, calendlyStatus, calendlyDescription) {
  return {
    bookingMode,
    google: null,
    checks: [
      {
        id: "manual_booking",
        group: "booking",
        label:
          bookingMode === "embed"
            ? "Public scheduler embed"
            : bookingMode === "disabled"
              ? "Public booking paused"
              : "Manual scheduling mode",
        description: calendlyDescription,
        accomplishes: "Keeps calendar activation optional without blocking the revenue workflow.",
        status: bookingMode === "disabled" ? "disabled" : "ready",
        required: false,
        keys: ["tenant.capabilities.publicBooking", "CALENDLY_ENABLED"],
      },
      {
        id: "calendly",
        group: "booking",
        label: "Calendly attribution",
        description: calendlyDescription,
        accomplishes: "Adds booking and cancellation attribution without treating tokens as health.",
        status: calendlyStatus,
        required: false,
        keys: ["CALENDLY_WEBHOOK_SECRET"],
        lastSuccessAt: calendlyStatus === "ready" || calendlyStatus === "degraded" ? "2026-09-04T11:00:00.000Z" : null,
      },
    ],
    summary: {
      requiredReady: 1,
      requiredTotal: 1,
      optionalReady: calendlyStatus === "ready" ? 1 : 0,
      optionalTotal: 2,
      launchReady: true,
      percent: 100,
      degraded: calendlyStatus === "degraded" ? 1 : 0,
    },
  };
}

const visualStates = [
  {
    id: "enabled",
    bookingMode: "embed",
    calendlyStatus: "action",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription: "The public embed is on. Signed webhooks are still required before attribution can be Ready.",
  },
  {
    id: "disabled",
    bookingMode: "disabled",
    calendlyStatus: "disabled",
    heading: "Public booking paused",
    copy: "paused",
    calendlyDescription: "Public self-booking is paused. Attribution stays off until the embed is re-enabled.",
  },
  {
    id: "not-configured",
    bookingMode: "manual",
    calendlyStatus: "optional",
    heading: "Manual scheduling",
    copy: "No public embed",
    calendlyDescription: "The founder schedules by reply. Calendly API tokens are not required and are not treated as ready.",
  },
  {
    id: "degraded",
    bookingMode: "embed",
    calendlyStatus: "degraded",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription: "The latest signed booking or cancellation receipt is older than the freshness window.",
  },
  {
    id: "recovered",
    bookingMode: "embed",
    calendlyStatus: "ready",
    heading: "Public scheduler embed",
    copy: "not implied by the embed",
    calendlyDescription: "A fresh signed Calendly booking or cancellation receipt is on the ledger.",
  },
];

async function mintFounderCookies() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
    if (!process.env[key]) throw new Error(`${key} is required for authenticated booking QA`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: process.env.ADMIN_EMAIL,
    options: { redirectTo: `${base}/auth/callback?next=/admin/setup` },
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    throw linkError || new Error("Could not generate a QA session");
  }
  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError || !verified.session) {
    throw verifyError || new Error("Could not exchange a QA session");
  }
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookieKey = `sb-${projectRef}-auth-token`;
  const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
  const origin = new URL(base);
  const parts =
    cookieValue.length <= 3180
      ? [{ name: cookieKey, value: cookieValue }]
      : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
          name: `${cookieKey}.${index}`,
          value: cookieValue.slice(index * 3180, (index + 1) * 3180),
        }));
  return parts.map((cookie) => ({
    ...cookie,
    domain: origin.hostname,
    path: "/",
    httpOnly: false,
    secure: origin.protocol === "https:",
    sameSite: "Lax",
  }));
}

async function stubAdminNoise(page) {
  const empty = { status: 200, contentType: "application/json", body: JSON.stringify({ items: [], notifications: [] }) };
  await page.route("**/api/admin/notifications**", (route) => route.fulfill(empty));
  await page.route("**/api/admin/tenants**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tenants: [] }) }),
  );
  await page.route("**/api/admin/revenue-os/priority**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }),
  );
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations: [] }) }),
  );
}

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  const cookies = await mintFounderCookies();
  const viewports = [
    { id: "desktop", width: 1440, height: 1024 },
    { id: "mobile", width: 390, height: 844 },
  ];

  for (const state of visualStates) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: "light",
      });
      await context.addCookies(cookies);
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(`${state.id}/${viewport.id}: console ${message.text().split("\n")[0]}`);
      });
      page.on("pageerror", (error) => failures.push(`${state.id}/${viewport.id}: page ${error.message.split("\n")[0]}`));
      await stubAdminNoise(page);
      await page.route("**/api/admin/setup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            setupPayload(state.bookingMode, state.calendlyStatus, state.calendlyDescription),
          ),
        }),
      );
      await page.goto(`${base}/admin/setup`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { name: "Setup Center" }).waitFor({ timeout: 20_000 });
      const heading = page.getByRole("heading", { name: state.heading, level: 2, exact: true });
      await heading.waitFor({ timeout: 10_000 });
      const bodyText = await page.locator("body").innerText();
      if (!bodyText.includes(state.copy) && !bodyText.toLowerCase().includes(state.copy.toLowerCase())) {
        failures.push(`${state.id}/${viewport.id}: missing copy "${state.copy}"`);
      }
      if (state.calendlyStatus === "degraded" && !/degraded/i.test(bodyText)) {
        failures.push(`${state.id}/${viewport.id}: degraded Calendly status not visible`);
      }
      if (state.calendlyStatus === "ready" && !/Ready/i.test(bodyText)) {
        failures.push(`${state.id}/${viewport.id}: recovered Ready status not visible`);
      }
      assertNoSecrets(`${state.id}/${viewport.id} setup`, bodyText);
      await page.screenshot({
        path: `${outDir}/setup-${state.id}-${viewport.id}.png`,
        fullPage: true,
      });
      await context.close();
    }
  }

  for (const path of ["/contact", "/roofing"]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(`${path}/${viewport.id}: console ${message.text().split("\n")[0]}`);
      });
      const response = await page.goto(`${base}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      if (!response || response.status() >= 500) {
        failures.push(`${path}/${viewport.id}: HTTP ${response?.status() || "none"}`);
      } else {
        const bodyText = await page.locator("body").innerText();
        assertNoSecrets(`${path}/${viewport.id}`, bodyText);
        const html = await page.content();
        assertNoSecrets(`${path}/${viewport.id} html`, html);
        if (/CALENDLY_WEBHOOK_SECRET|CALENDLY_PERSONAL_ACCESS_TOKEN/.test(html)) {
          failures.push(`${path}/${viewport.id}: booking secret name leaked into HTML`);
        }
        await page.screenshot({
          path: `${outDir}${path.replace("/", "-")}-${viewport.id}.png`,
          fullPage: true,
        });
      }
      await context.close();
    }
  }

  const apiContext = await browser.newContext();
  await apiContext.addCookies(cookies);
  try {
    const live = await apiContext.request.get(`${base}/api/admin/setup`, { timeout: 120_000 });
    if (!live.ok()) {
      failures.push(`live setup API failed with ${live.status()}`);
    } else {
      const liveBody = await live.json();
      if (!["embed", "manual", "disabled"].includes(liveBody.bookingMode)) {
        failures.push(`Live Setup bookingMode was ${liveBody.bookingMode}, expected embed|manual|disabled`);
      }
      const liveText = JSON.stringify(liveBody);
      assertNoSecrets("setup API", liveText);
      const calendlyCheck = (liveBody.checks || []).find((check) => check.id === "calendly");
      if (!calendlyCheck) failures.push("Setup API missing the Calendly attribution check");
      else if (calendlyCheck.status === "ready" && liveBody.bookingMode !== "embed") {
        failures.push("Calendly attribution cannot be Ready when public booking is not embed");
      }
    }
  } catch (error) {
    failures.push(`live setup API: ${error instanceof Error ? error.message : String(error)}`);
  }
  await apiContext.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      screenshots: outDir,
      checks: [
        "live-setup-canonical-mode",
        "enabled",
        "disabled",
        "not-configured",
        "degraded",
        "recovered",
        "desktop-mobile",
        "no-token-leak",
      ],
    },
    null,
    2,
  ),
);

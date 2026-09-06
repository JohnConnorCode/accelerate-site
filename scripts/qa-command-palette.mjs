import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-command-palette";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for command-palette QA`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/today` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieParts =
  cookieValue.length <= 3180
    ? [{ name: cookieKey, value: cookieValue }]
    : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
        name: `${cookieKey}.${index}`,
        value: cookieValue.slice(index * 3180, (index + 1) * 3180),
      }));

const browser = await chromium.launch({ headless: true });
const failures = [];

// Canonical-first fixture: one canonical contact and one legacy-only lead.
// (The API dedupes by email with canonical priority, so the same address
// can never appear twice; the UI proof is that the canonical row renders
// above the legacy row.)
const SEARCH_FIXTURE = {
  results: [
    { name: "QA Canon", email: "qa-canon@example.com", type: "Canonical contact" },
    { name: "QA Legacy", email: "qa-legacy@example.com", type: "Lead" },
  ],
};

async function openAdmin(viewport, label, { reducedMotion = "reduce", dark = false } = {}) {
  const context = await browser.newContext({
    viewport,
    colorScheme: dark ? "dark" : "light",
    reducedMotion,
  });
  const origin = new URL(base);
  await context.addCookies(
    cookieParts.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  if (dark) await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error")
      failures.push(`${label}: console ${message.text().split("\n")[0]}`);
  });
  page.on("pageerror", (error) => failures.push(`${label}: page ${error.message.split("\n")[0]}`));
  page.on("response", (response) => {
    if (response.status() >= 500) failures.push(`${label}: ${response.status()} ${response.url()}`);
  });
  await page.route("**/api/admin/notifications**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    }),
  );
  await page.route("**/api/admin/search?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SEARCH_FIXTURE),
    }),
  );
  await page.goto(`${base}/admin/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("main.admin-main").waitFor({ timeout: 30_000 });
  return { context, page };
}

async function openPalette(page, viaKeyboard) {
  const dialog = page.getByRole("dialog", { name: "Admin command palette" });
  if (viaKeyboard) {
    // Real key events, both modifiers: retry once in case the first press
    // races shell hydration.
    for (const combo of ["Meta+k", "Control+k"]) {
      await page.keyboard.press(combo);
      try {
        await dialog.waitFor({ timeout: 4000 });
        return;
      } catch {
        /* retry with the other modifier */
      }
    }
  } else {
    await page.getByRole("button", { name: "Open command palette" }).click();
  }
  await dialog.waitFor({ timeout: 15_000 });
}

function paletteInput(page) {
  return page.getByPlaceholder("Search people, pages, or run a command…");
}

async function runJourney() {
  // 1. Desktop via real Cmd+K: setup command navigates (keyboard coverage).
  {
    const { context, page } = await openAdmin({ width: 1440, height: 900 }, "desktop-cmdk");
    const paletteSetup = page.getByRole("dialog", { name: "Admin command palette" });
    await openPalette(page, true);
    await paletteInput(page).fill("setup");
    await paletteSetup.getByRole("button", { name: /Open setup/ }).click();
    await page.waitForURL("**/admin/setup", { timeout: 30_000 });
    await page.screenshot({ path: `${outDir}/setup-desktop.png` });
    await context.close();
  }

  // 2. Desktop: "New lead" opens the shared AddLeadModal, not a bare page.
  {
    const { context, page } = await openAdmin({ width: 1440, height: 900 }, "desktop-lead");
    const paletteLead = page.getByRole("dialog", { name: "Admin command palette" });
    await openPalette(page, true);
    await paletteInput(page).fill("new lead");
    await paletteLead.getByRole("button", { name: /New lead/ }).click();
    await page.waitForURL("**/admin/leads?create=1", { timeout: 30_000 });
    await page.getByRole("dialog", { name: "Add new lead" }).waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `${outDir}/lead-modal-desktop.png` });
    // Close without submitting: no records may be created by QA.
    await page.keyboard.press("Escape");
    await context.close();
  }

  // 3. Desktop: canonical-first people ordering with mocked fixture.
  {
    const { context, page } = await openAdmin({ width: 1440, height: 900 }, "desktop-people");
    await openPalette(page, true);
    await paletteInput(page).fill("qa-canon");
    const rows = page.locator('[role="dialog"] >> text=/QA Canon/');
    await rows.first().waitFor({ timeout: 15_000 });
    const firstType = await page
      .locator('[role="dialog"]')
      .getByText("Canonical contact")
      .first()
      .textContent();
    if (!firstType) throw new Error("canonical result missing from palette");
    const palette = page.getByRole("dialog", { name: "Admin command palette" });
    const order = await palette.innerText();
    if (order.indexOf("Canonical contact") > order.indexOf("QA Legacy")) {
      throw new Error("legacy row rendered before the canonical record");
    }
    await page.screenshot({ path: `${outDir}/people-desktop.png` });
    await context.close();
  }

  // 4. Desktop dark: AI-read command opens the gated workspace, executes nothing.
  {
    const { context, page } = await openAdmin({ width: 1440, height: 900 }, "desktop-ai", {
      dark: true,
    });
    const palette = page.getByRole("dialog", { name: "Admin command palette" });
    await openPalette(page, true);
    await paletteInput(page).fill("pipeline risk");
    await palette.getByRole("button", { name: /Show pipeline risk/ }).click();
    await page.getByLabel("Ask AI").waitFor({ timeout: 15_000 });
    await page.screenshot({ path: `${outDir}/ai-dark.png` });
    await context.close();
  }

  // 5. Mobile 390px: palette button opens, recovery command navigates.
  {
    const { context, page } = await openAdmin({ width: 390, height: 844 }, "mobile");
    const paletteRecovery = page.getByRole("dialog", { name: "Admin command palette" });
    await openPalette(page, false);
    await paletteInput(page).fill("recovery");
    await paletteRecovery.getByRole("button", { name: /Open recovery/ }).click();
    await page.waitForURL("**/admin/recovery", { timeout: 30_000 });
    await page.screenshot({ path: `${outDir}/recovery-mobile.png` });
    await context.close();
  }
}

try {
  await runJourney();
} catch (error) {
  failures.push(`journey: ${error instanceof Error ? error.message : String(error)}`);
  try {
    await browser.newPage().then(async (p) => {
      await p.goto(`${base}/admin/today`).catch(() => undefined);
      await p.screenshot({ path: `${outDir}/failure.png` }).catch(() => undefined);
    });
  } catch {
    /* evidence best-effort */
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`COMMAND PALETTE QA FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(
  "COMMAND PALETTE QA PASSED: setup, lead modal, canonical ordering, AI gate, mobile recovery",
);

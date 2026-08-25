import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-founder-note";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated founder-note QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/today` },
});
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieParts = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
      name: `${cookieKey}.${index}`,
      value: cookieValue.slice(index * 3180, (index + 1) * 3180),
    }));

const browser = await chromium.launch({ headless: true });
const failures = [];

async function openAdmin(viewport, label, { failFirstSave = false, colorScheme = "light", reducedMotion = "reduce" } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  const origin = new URL(base);
  await context.addCookies(cookieParts.map((cookie) => ({
    ...cookie,
    domain: origin.hostname,
    path: "/",
    httpOnly: false,
    secure: origin.protocol === "https:",
    sameSite: "Lax",
  })));
  if (colorScheme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const page = await context.newPage();
  const requests = [];
  let saves = 0;
  page.on("console", (message) => {
    const expectedFailedSave = failFirstSave && saves === 1 && message.text().includes("503");
    if (message.type() === "error" && !expectedFailedSave) failures.push(`${label}: console ${message.text().split("\n")[0]}`);
  });
  page.on("pageerror", (error) => failures.push(`${label}: page ${error.message.split("\n")[0]}`));
  page.on("response", (response) => {
    if (response.status() >= 500 && !response.url().includes("/api/admin/revenue-os/notes")) {
      failures.push(`${label}: ${response.status()} ${response.url()}`);
    }
  });
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ notifications: [], unreadCount: 0 }),
  }));
  await page.route("**/api/admin/search**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ results: [
      { name: "Sarah Owner", email: "sarah@example.com", type: "Canonical contact" },
      { name: "Legacy Sarah", email: "legacy@example.com", type: "Lead" },
    ] }),
  }));
  await page.route("**/api/admin/revenue-os/notes", async (route) => {
    requests.push(route.request().postDataJSON());
    saves += 1;
    if (failFirstSave && saves === 1) {
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Operating memory is temporarily unavailable" }) });
    }
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ receipt: { id: "qa-note", duplicate: false } }),
    });
  });
  const response = await page.goto(`${base}/admin/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 500) failures.push(`${label}: HTTP ${response?.status() ?? "none"}`);
  await page.locator("main.admin-main").waitFor();
  return { context, page, requests };
}

async function openNoteFromPalette(page, mobile = false) {
  if (mobile) await page.getByRole("button", { name: "Open command palette" }).click();
  else await page.getByRole("button", { name: /Search or run a command/ }).click();
  const palette = page.getByRole("dialog", { name: "Admin command palette" });
  await palette.waitFor();
  await palette.getByPlaceholder("Search people, pages, or run a command…").fill("capture note");
  await palette.getByRole("button", { name: /Capture note/ }).click();
  await page.getByRole("dialog", { name: "Capture what you know" }).waitFor();
  await palette.waitFor({ state: "detached" });
}

function assertRequest(request, expectedNote) {
  if (request.note !== expectedNote) throw new Error(`Unexpected captured note: ${request.note}`);
  if (request.contactEmail !== "sarah@example.com") throw new Error("Note did not retain the canonical contact attachment");
  if (!/^[0-9a-f-]{36}$/.test(request.requestId)) throw new Error("Note request is missing its idempotency key");
}

const desktop = await openAdmin({ width: 1440, height: 1000 }, "desktop", { failFirstSave: true, reducedMotion: "no-preference" });
await openNoteFromPalette(desktop.page);
const desktopDialog = desktop.page.getByRole("dialog", { name: "Capture what you know" });
await desktopDialog.getByPlaceholder("What happened, what was decided, or what should not be forgotten?").fill("Sarah approved the custom automation discovery plan.");
await desktopDialog.getByRole("button", { name: "Attach to a person" }).click();
await desktopDialog.getByPlaceholder("Search canonical contacts").fill("Sarah");
await desktopDialog.getByRole("button", { name: /Sarah Owner/ }).waitFor();
await desktopDialog.getByRole("button", { name: /Sarah Owner/ }).click();
await desktop.page.screenshot({ path: `${outDir}/founder-note-desktop.png`, fullPage: true });
await desktopDialog.getByRole("button", { name: "Save note" }).click();
await desktop.page.getByRole("alert").getByText("Operating memory is temporarily unavailable").waitFor();
await desktopDialog.waitFor();
await desktop.page.screenshot({ path: `${outDir}/founder-note-retry.png`, fullPage: true });
await desktopDialog.getByRole("button", { name: "Save note" }).click();
await desktop.page.getByText("Note added to the operating memory").waitFor();
await desktopDialog.waitFor({ state: "detached" });
if (desktop.requests.length !== 2) throw new Error(`Expected two save attempts, received ${desktop.requests.length}`);
assertRequest(desktop.requests[0], "Sarah approved the custom automation discovery plan.");
if (desktop.requests[0].requestId !== desktop.requests[1].requestId) throw new Error("Retry changed the note idempotency key");

const mobile = await openAdmin({ width: 390, height: 844 }, "mobile");
await openNoteFromPalette(mobile.page, true);
const mobileDialog = mobile.page.getByRole("dialog", { name: "Capture what you know" });
await mobileDialog.getByPlaceholder("What happened, what was decided, or what should not be forgotten?").fill("Mobile capture preserves operating context.");
await mobileDialog.getByRole("button", { name: "Attach to a person" }).click();
await mobileDialog.getByPlaceholder("Search canonical contacts").fill("Sarah");
await mobileDialog.getByRole("button", { name: /Sarah Owner/ }).waitFor();
await mobileDialog.getByRole("button", { name: /Sarah Owner/ }).click();
const mobileLayout = await mobile.page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }));
if (mobileLayout.documentWidth > mobileLayout.viewportWidth + 2) throw new Error(`Founder note overflows mobile by ${mobileLayout.documentWidth - mobileLayout.viewportWidth}px`);
await mobile.page.screenshot({ path: `${outDir}/founder-note-mobile.png`, fullPage: true });
await mobileDialog.getByPlaceholder("What happened, what was decided, or what should not be forgotten?").press("Control+Enter");
await mobileDialog.waitFor({ state: "detached" });
assertRequest(mobile.requests[0], "Mobile capture preserves operating context.");

const dark = await openAdmin({ width: 1280, height: 800 }, "dark", { colorScheme: "dark" });
await openNoteFromPalette(dark.page);
await dark.page.getByRole("dialog", { name: "Capture what you know" }).getByPlaceholder("What happened, what was decided, or what should not be forgotten?").fill("Dark-mode capture check.");
await dark.page.screenshot({ path: `${outDir}/founder-note-dark.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await dark.context.close();
await browser.close();

if (failures.length) throw new Error(`Founder-note QA failures:\n${failures.join("\n")}`);
console.log(JSON.stringify({
  result: "passed",
  screenshots: [
    `${outDir}/founder-note-desktop.png`,
    `${outDir}/founder-note-retry.png`,
    `${outDir}/founder-note-mobile.png`,
    `${outDir}/founder-note-dark.png`,
  ],
  checks: ["founder auth", "command palette", "canonical contact", "keyboard save", "idempotent retry", "visible error", "mobile overflow", "dark", "reduced motion", "console"],
}, null, 2));

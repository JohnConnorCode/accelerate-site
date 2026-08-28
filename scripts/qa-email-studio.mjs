import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const scenario = "northline-roofing";
const output = "/tmp/accelerate-email-studio";
const failures = [];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label}: console ${message.text()}`); });
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/emails/preview") && !pathname.startsWith("/api/admin/emails/history")) failures.push(`${label}: protected request escaped demo runtime (${pathname})`);
  });
  await page.goto(`${base}/demo/command-center/${scenario}/emails`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Email Studio" }).waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByText("Email sections", { exact: true }).waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /Paragraph/ }).first().click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved. Live email is unchanged until you publish.", { exact: true }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(350);
  const overlayGeometry = await page.evaluate(() => {
    const toast = document.querySelector(".admin-toast");
    const dock = document.querySelector(".admin-mobile-dock");
    const toastRect = toast?.getBoundingClientRect();
    const dockRect = dock?.getBoundingClientRect();
    return { toastBottom: toastRect?.bottom ?? null, dockTop: dockRect?.top ?? null };
  });
  if (label === "mobile" && overlayGeometry.toastBottom != null && overlayGeometry.dockTop != null && overlayGeometry.toastBottom > overlayGeometry.dockTop - 8) failures.push(`${label}: operation receipt overlaps the navigation dock`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Mobile preview" }).click();
  await page.locator('iframe[title="Exact email preview"]').waitFor({ timeout: 15_000 });
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    surfaces: [...document.querySelectorAll(".admin-surface")].map((node) => ({ radius: getComputedStyle(node).borderRadius, shadow: getComputedStyle(node).boxShadow })),
    rendered: Boolean(document.querySelector('iframe[title="Exact email preview"]')),
  }));
  if (state.overflow) failures.push(`${label}: horizontal overflow`);
  if (!state.rendered) failures.push(`${label}: exact rendered preview did not mount`);
  if (state.surfaces.some((surface) => !surface.radius || surface.radius === "0px")) failures.push(`${label}: surface did not inherit the shared radius token`);
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  await context.close();
}

await browser.close();
if (failures.length) throw new Error(`Email Studio QA failures:\n${[...new Set(failures)].join("\n")}`);
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));

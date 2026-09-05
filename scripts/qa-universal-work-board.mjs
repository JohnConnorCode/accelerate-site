import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3014";
const out = "/tmp/accelerate-work-board-qa";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];
const errors = [];
for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/demo/command-center/${scenario}/features`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByRole("heading", { name: "Feature Board", exact: true })
    .waitFor({ timeout: 60000 });
  await page.evaluate(
    ([scenario]) =>
      sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, "dark"),
    [scenario],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "New feature", exact: true }).waitFor();
  await page.getByRole("button", { name: "All work", exact: true }).waitFor();
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await page.screenshot({ path: `${out}/${scenario}-dark.png`, fullPage: true });
  await page.evaluate(
    ([scenario]) =>
      sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, "light"),
    [scenario],
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "All work", exact: true }).waitFor();
  await page.getByRole("button", { name: "New feature", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(`QA ${scenario}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A business outcome verified through the shared admin component.");
  await page
    .getByLabel("Definition of done", { exact: true })
    .fill("The fixture can be claimed and submitted for review.");
  await page.getByRole("button", { name: "Add to board", exact: true }).click();
  await page.getByRole("button", { name: "All work", exact: true }).click();
  // Open via the rendered card title, never call a protected backend from demo.
  await page.getByRole("button", { name: `Edit QA ${scenario}`, exact: true }).click();
  await page.getByRole("button", { name: "Claim work", exact: true }).click();
  await page.getByRole("button", { name: "Renew claim", exact: true }).waitFor();
  await page
    .getByLabel("Decision, progress or review reason", { exact: true })
    .fill("Verified the controlled demo work journey.");
  await page.getByRole("button", { name: "Record progress", exact: true }).click();
  await page.getByText("Submit verification for review", { exact: true }).click();
  await page.getByLabel("Exact commit SHA", { exact: true }).fill("a".repeat(40));
  await page
    .getByLabel("Passing checks — one per line: check name | evidence", { exact: true })
    .fill("browser | Controlled demo journey passed");
  await page.getByRole("button", { name: "Submit for review", exact: true }).click();
  await page.getByRole("button", { name: "Accept verification", exact: true }).click();
  await page
    .getByRole("button", { name: "Accept verification", exact: true })
    .waitFor({ state: "detached" });
  await page.getByText("Delivery evidence", { exact: true }).waitFor();
  await page.waitForTimeout(5500);
  await page.screenshot({ path: `${out}/${scenario}-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "Close feature details", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "All work", exact: true }).focus();
  await page.keyboard.press("Tab");
  assert.ok(await page.evaluate(() => document.activeElement?.tagName !== "BODY"));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/${scenario}-mobile.png`, fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "page must not overflow horizontally",
  );
  await context.close();
  console.log(
    `PASS demo ${scenario}: shared create, claim, progress, submit/review, desktop/mobile, keyboard, reduced motion`,
  );
}
await browser.close();
assert.deepEqual(errors, []);
console.log(`Screenshots: ${out}`);

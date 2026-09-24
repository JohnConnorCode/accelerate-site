import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-admin-mobile-navigation";
const failures = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));

const check = (condition, message) => {
  if (!condition) failures.push(message);
};

await page.goto(`${base}/demo/command-center/northline-roofing/today`, {
  waitUntil: "networkidle",
});
await page.locator('[data-admin-async-state="ready"]').waitFor();

check(
  (await page.getByRole("heading", { name: "Needs you" }).count()) === 1,
  "Today: the primary attention view is missing",
);
check(
  (await page.getByRole("heading", { name: "Business changes" }).count()) === 1,
  "Today: the business changes view is missing",
);
check(
  (await page.getByText("Revenue integrations are not configured yet", { exact: true }).count()) ===
    0,
  "Today: demo exposes an irrelevant setup warning",
);
check(
  (await page.locator("[data-today-approval-rail]:visible").count()) === 0,
  "Today: duplicate desktop approval rail is visible on mobile",
);
check(
  !(await page
    .getByText("Operational ledger", { exact: true })
    .isVisible()
    .catch(() => false)),
  "Today: full operational ledger is visible in the primary mobile flow",
);

const work = page.locator('nav[aria-label="Primary navigation"] a').filter({ hasText: "Work" });
const started = Date.now();
await work.click({ noWaitAfter: true });
await Promise.race([
  page.locator('nav[aria-label="Primary navigation"] a[data-pending="true"]').waitFor(),
  page.getByRole("heading", { level: 1, name: "Work" }).waitFor(),
]);
const acknowledgedIn = Date.now() - started;
check(acknowledgedIn <= 200, `Navigation: tap acknowledgement took ${acknowledgedIn}ms`);
await page.getByRole("heading", { level: 1, name: "Work" }).waitFor();
const routeMotion = await page
  .locator("[data-admin-route-stage] .admin-page-introduction")
  .first()
  .evaluate((node) => {
    const style = getComputedStyle(node);
    return style.animationName !== "none" && Number.parseFloat(style.animationDuration) > 0;
  });
check(routeMotion, "Navigation: committed Work route has no declared entrance motion");
check(
  (await page.locator("[data-admin-route-loading]").count()) === 0,
  "Navigation: full-page loading tree remained after Work committed",
);

await page.getByRole("button", { name: "Open command palette" }).click();
const palette = page.getByRole("dialog", { name: "Admin command palette" });
await palette.waitFor();
await page.waitForTimeout(260);
const searchGeometry = await palette.evaluate((node) => {
  const rect = node.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    top: rect.top,
    activeTag: document.activeElement?.tagName,
  };
});
check(
  searchGeometry.width >= 385 && searchGeometry.height >= 835 && searchGeometry.top <= 2,
  "Search: mobile command surface does not own the safe viewport",
);
check(searchGeometry.activeTag === "INPUT", "Search: input was not focused on the first frame");
await page.getByPlaceholder("Search people, pages, or run a command…").fill("analytics");
check(
  (await page.getByRole("button", { name: /Analytics/ }).count()) > 0,
  "Search: local page results were not available immediately",
);

await page.screenshot({ path: `${output}/search-mobile.png`, fullPage: false });
await page.keyboard.press("Escape");
await palette.waitFor({ state: "detached" });
await page.screenshot({ path: `${output}/work-mobile.png`, fullPage: false });
await browser.close();

if (failures.length) {
  console.error(`Admin mobile navigation QA failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(
  `Admin mobile navigation QA passed (tap acknowledgement ${acknowledgedIn}ms). Screenshots: ${output}`,
);

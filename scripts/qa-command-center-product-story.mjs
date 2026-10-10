import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Run through the existing server owner:
// NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded QA_FOCUS=product-story npm run qa:admin-polish
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const origin = new URL(base).origin;
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = process.env.PRODUCT_STORY_QA_OUTPUT || "/tmp/command-center-overhaul-qa";
await mkdir(output, { recursive: true });
const areas = ["customer-context", "sales", "delivery", "billing", "marketing", "custom-apps"];
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
  "superdebate",
];
const groups = [
  "Daily work",
  "Customers & sales",
  "Delivery",
  "Billing",
  "Marketing",
  "Apps & AI",
  "Workspace",
];
const checks = [];
const escaped = [];
const errors = [];
const browser = await chromium.launch();
let activePage;
let activeRoute = "";
async function stable(page) {
  await page.locator("main h1, .admin-main h1").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Horizontal viewport overflow",
  );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
      if (url.origin !== origin || url.pathname.startsWith("/api/")) {
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(20_000);
    page.on("pageerror", (error) => errors.push(error.message));
    const routes = [
      "/command-center",
      "/command-center/features",
      ...areas.map((id) => `/command-center/features/${id}`),
      "/command-center/compare",
      "/open-source",
      "/docs",
      "/docs/start/daily-path",
      "/docs/extend/first-change",
      "/docs/billing",
      "/demo/command-center",
    ];
    for (const route of routes) {
      activeRoute = route;
      const response = await page.goto(base + route, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      assert.equal(response.status(), 200, route);
      await stable(page);
      if (route === "/command-center") {
        const business = page.getByRole("link", { name: "Run a business workflow", exact: true });
        const builder = page
          .getByRole("link", { name: "Build on the platform", exact: true })
          .first();
        await business.waitFor();
        await builder.waitFor();
        await page.getByText("Open the searchable reference", { exact: true }).click();
        const filter = page.getByRole("button", { name: "Sales & follow-up", exact: true });
        await filter.focus();
        await page.keyboard.press("Enter");
        assert.equal(await filter.getAttribute("aria-pressed"), "true");
        await page.getByRole("searchbox", { name: "Find a capability" }).fill("zzz no capability");
        await page.getByText("No capabilities match this search.", { exact: false }).waitFor();
        await page.getByRole("button", { name: "Clear filters", exact: true }).click();
        await page.getByText("Open the searchable reference", { exact: true }).click();
      }
      if (route === "/command-center/features")
        for (const area of areas)
          assert(await page.locator(`a[href="/command-center/features/${area}"]`).count());
      if (areas.some((area) => route === `/command-center/features/${area}`)) {
        const figure = page.locator("main figure").first();
        const fullSize = new URL(await figure.locator("a").getAttribute("href"), base);
        const asset = await page.request.get(base + fullSize.pathname);
        assert.equal(asset.status(), 200);
        const revision = createHash("sha256")
          .update(await asset.body())
          .digest("hex")
          .slice(0, 12);
        assert.equal(fullSize.searchParams.get("v"), revision, "Full-size screenshot is current");
        const rendered = new URL(await figure.locator("img").getAttribute("src"), base);
        const image = new URL(rendered.searchParams.get("url") ?? rendered.href, base);
        assert.equal(image.searchParams.get("v"), revision, "Optimized screenshot is current");
      }
      if (route === "/command-center/compare")
        assert((await page.locator('main a[href^="https://"]').count()) >= 10);
      if (route === "/docs") {
        await page.getByRole("heading", { name: "Run your business", exact: true }).waitFor();
        await page.getByRole("heading", { name: "Build business apps", exact: true }).waitFor();
      }
      if (route === "/docs/start/daily-path") {
        for (const anchor of ["inquiry", "onboarding", "invoice"])
          assert.equal(await page.locator(`#${anchor}`).count(), 1);
      }
      if (
        [
          "/command-center",
          "/command-center/features",
          "/command-center/features/billing",
          "/command-center/compare",
          "/docs",
          "/docs/extend/first-change",
          "/demo/command-center",
        ].includes(route)
      ) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({
          path: `${output}/${width}-${route.slice(1).replaceAll("/", "-")}.png`,
          fullPage: true,
        });
        await page.screenshot({
          path: `${output}/${width}-${route.slice(1).replaceAll("/", "-")}-viewport.png`,
        });
      }
      checks.push({ width, route, result: "passed" });
    }
    const bad = await page.goto(base + "/command-center/features/not-a-feature");
    assert.equal(bad.status(), 404);

    // The audience switch works through the desktop sidebar and mobile disclosure.
    await page.goto(base + "/docs/start");
    if (width === 390) {
      await page.locator(".docs-mobile-nav > summary").focus();
      await page.keyboard.press("Enter");
    }
    const audience = page.locator('nav[aria-label="Documentation sections"]:visible');
    const buildLink = audience.getByRole("link", { name: "Build business apps", exact: true });
    await buildLink.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/docs/extend");
    await page.goBack();
    await page.waitForURL("**/docs/start");
    checks.push({ width, route: "docs audience switch and Back", result: "passed" });

    // Each scenario keeps the new grouping and a direct, recoverable destination.
    for (const scenario of scenarios) {
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(root + "/today", { waitUntil: "networkidle" });
      await stable(page);
      if (width === 390) {
        await page.getByRole("button", { name: "Open More", exact: true }).click();
        await page.getByRole("dialog", { name: "Admin navigation", exact: true }).waitFor();
      }
      const navigation = page.locator('nav[aria-label="Admin navigation"]:visible');
      assert.deepEqual(
        await navigation
          .locator("[data-nav-section]")
          .evaluateAll((nodes) => nodes.map((node) => node.dataset.navSection)),
        groups,
      );
      if (width === 390) {
        await page.keyboard.press("Escape");
        await page
          .getByRole("dialog", { name: "Admin navigation", exact: true })
          .waitFor({ state: "hidden" });
      }
      await page.goto(root + "/contacts");
      await stable(page);
      await page.goBack();
      await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
      checks.push({
        width,
        scenario,
        route: "navigation groups, direct load and Back",
        result: "passed",
      });
    }

    // The guide is optional and navigates the actual workspace; it creates no work.
    const demo = `${base}/demo/command-center/northline-roofing`;
    await page.goto(demo + "/contacts?workflow=client");
    const guide = page.locator("[data-client-lifecycle-guide]");
    await guide.waitFor();
    await guide.getByRole("link", { name: "2. Sales decision", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/pipeline?workflow=client");
    await page.goBack();
    await page.waitForURL("**/contacts?workflow=client");
    await page.reload();
    await guide.waitFor();
    for (const [name, route] of [
      ["3. Delivery handoff", "client-onboarding"],
      ["4. Customer invoice", "invoicing"],
      ["5. Payment follow-up", "collections"],
    ]) {
      await guide.getByRole("link", { name, exact: true }).click();
      await page.waitForURL(`${demo}/${route}?workflow=client`);
      await guide.locator('a[aria-current="step"]').filter({ hasText: name }).waitFor();
      await stable(page);
    }
    await page.screenshot({ path: `${output}/${width}-client-lifecycle.png` });
    await guide.getByRole("link", { name: "Close client lifecycle guide", exact: true }).click();
    await guide.waitFor({ state: "hidden" });
    assert.equal(new URL(page.url()).searchParams.has("workflow"), false);
    checks.push({
      width,
      route: "optional lifecycle, keyboard, reload and Back",
      result: "passed",
    });

    await page.goto(demo + "/get-started");
    await page.locator('[aria-label="Business workflow starting points"]').waitFor();
    await stable(page);
    assert.equal(
      await page.locator('[aria-label="Business workflow starting points"] h3').count(),
      6,
    );
    await page.screenshot({ path: `${output}/${width}-getting-started.png` });

    // A prepared AI request fills the existing composer without sending inference.
    await page.goto(demo + "/ai?view=capabilities");
    await page
      .getByRole("heading", { name: "Find what AI can do for your business", exact: true })
      .waitFor();
    const jobs = page.locator('[aria-label="Business jobs for AI"]');
    assert.equal(await jobs.getByRole("heading", { level: 3 }).count(), 5);
    await page.screenshot({ path: `${output}/${width}-ai-jobs.png` });
    await jobs.getByRole("button", { name: "Start a request", exact: true }).first().focus();
    await page.keyboard.press("Enter");
    const composer = page.getByRole("textbox", { name: "Ask the business", exact: true });
    await composer.waitFor();
    assert.match(await composer.inputValue(), /Help me understand a customer/);
    checks.push({ width, route: "first-use choices and prepared AI request", result: "passed" });
    await context.close();
  }
  assert.deepEqual(escaped, [], "A protected or external request escaped the fictional runtime");
  assert.deepEqual(errors, [], "Browser runtime errors");
  await writeFile(
    `${output}/summary.json`,
    JSON.stringify({ result: "passed", checks, escaped, errors }, null, 2) + "\n",
  );
  console.log(
    `Product story browser acceptance passed: ${checks.length} checks. Screenshots: ${output}`,
  );
} catch (error) {
  await activePage?.screenshot({ path: `${output}/failed.png`, fullPage: true }).catch(() => {});
  await writeFile(
    `${output}/summary.json`,
    JSON.stringify(
      { result: "failed", activeRoute, checks, escaped, errors, failure: error.message },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await browser.close();
}

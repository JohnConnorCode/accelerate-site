import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.DOCS_QA_URL ?? "http://localhost:3025";
const output = process.env.DOCS_QA_OUTPUT ?? "/tmp/accelerate-docs-takeover-qa";
const routes = [
  "/docs",
  "/docs/start/daily-path",
  "/docs/command-center",
  "/docs/contacts/import",
  "/docs/extend/mcp-clients",
  "/docs/intelligence/tools",
];
const failures: string[] = [];
const checks: string[] = [];
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        page.on("pageerror", (error) => failures.push(error.message));
        for (const route of routes) {
          const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
          assert.equal(response?.status(), 200, route);
          await page.locator("main h1").waitFor({ state: "visible" });
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          );
          assert.equal(overflow, false, `${route} overflows at ${viewport.width}`);
          if (route === "/docs/intelligence/tools") {
            await page.getByText("Input schema for propose_send_email", { exact: true }).click();
            assert.ok(await page.locator("details[open] pre").isVisible());
          }
          await page.screenshot({
            path: `${output}/${viewport.width}-${route.replaceAll("/", "_")}.png`,
          });
          if (route === "/docs/start/daily-path") {
            await page.locator("figure img").scrollIntoViewIfNeeded();
            await page.waitForFunction(() => {
              const image = document.querySelector<HTMLImageElement>("figure img");
              return image?.complete && image.naturalWidth > 0;
            });
            await page.screenshot({ path: `${output}/${viewport.width}-workflow-figure.png` });
          }
          checks.push(`${viewport.width}: ${route} renders without horizontal overflow`);
        }
        await page.goto(`${base}/docs`, { waitUntil: "domcontentloaded" });
        const search = page.getByRole("searchbox", { name: "Search the docs" });
        await search.fill("RFC threading");
        await page.getByRole("status").filter({ hasText: "matching guide" }).waitFor();
        await page
          .locator('section[aria-label="Search documentation"] a[href="/docs/conversations/reply"]')
          .click();
        await page.waitForURL("**/docs/conversations/reply");
        assert.equal(await search.inputValue(), "");
        await search.fill("zxq_nonexistent_reference");
        await page.getByRole("status").filter({ hasText: "No matching guides" }).waitFor();
        await search.press("Escape");
        assert.equal(await search.inputValue(), "");
        await search.fill("propose_send_email");
        await page
          .locator('section[aria-label="Search documentation"] a[href="/docs/intelligence/tools"]')
          .waitFor();
        await page.screenshot({ path: `${output}/${viewport.width}-search.png` });
        checks.push(
          `${viewport.width}: body and generated-tool search, result navigation, empty state, Escape`,
        );
        if (viewport.width >= 1024) {
          await search.press("Tab");
          assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Clear search");
          await page.keyboard.press("Tab");
          assert.equal(
            await page.locator(":focus").getAttribute("href"),
            "/docs/intelligence/tools",
          );
          await page.keyboard.press("Enter");
          await page.waitForURL("**/docs/intelligence/tools");
          await page.goto(`${base}/docs`, { waitUntil: "domcontentloaded" });
          await page.getByRole("button", { name: "Switch to dark mode" }).click();
          await page.getByRole("button", { name: "Switch to light mode" }).waitFor();
          await page.screenshot({ path: `${output}/1440-dark-docs.png` });
          checks.push("Keyboard search navigation and dark-mode rendering");
        }
        if (viewport.width < 1024) {
          await search.press("Escape");
          const mobile = page.locator("main details").first();
          await mobile.locator("summary").click();
          await mobile.locator('a[href="/docs/start"]').click();
          await page.waitForURL("**/docs/start");
          await page.waitForFunction(
            () => !document.querySelector("main details")?.hasAttribute("open"),
          );
          checks.push("Mobile navigation closes after selecting a guide");
        }
      } finally {
        await context.close();
      }
    }
    const recovery = await browser.newContext();
    try {
      await recovery.route("**/api/search", (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"unavailable"}',
        }),
      );
      const page = await recovery.newPage();
      await page.goto(`${base}/docs`, { waitUntil: "domcontentloaded" });
      await page.getByRole("searchbox", { name: "Search the docs" }).fill("contacts");
      await page.getByRole("status").filter({ hasText: "unavailable" }).waitFor();
      await recovery.unroute("**/api/search");
      await page.getByRole("button", { name: "Retry search" }).click();
      await page.getByRole("status").filter({ hasText: "matching guide" }).waitFor();
      checks.push("Search failure remains navigable and retry recovers");
    } finally {
      await recovery.close();
    }
    assert.deepEqual(failures, [], "Browser runtime errors");
    writeFileSync(`${output}/results.json`, JSON.stringify({ result: "passed", checks }, null, 2));
    console.log(JSON.stringify({ result: "passed", checks: checks.length, output }));
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

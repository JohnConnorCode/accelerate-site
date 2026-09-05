import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { navItems, footerLinks } from "../src/content/navigation";

const base = process.env.DOCS_QA_URL ?? "http://localhost:3025";
const output = process.env.DOCS_QA_OUTPUT ?? "/tmp/accelerate-docs-takeover-qa";
const routes = [
  "/docs",
  "/docs/start/daily-path",
  "/docs/start/business-owners",
  "/docs/start/agencies",
  "/docs/extend/first-change",
  "/docs/self-hosting/installation",
  "/docs/start/troubleshooting",
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
          const headerBackground = await page
            .locator("header.site-header")
            .evaluate((header) => getComputedStyle(header).backgroundColor);
          assert.notEqual(
            headerBackground,
            "rgba(0, 0, 0, 0)",
            "Docs navigation must remain opaque over reading content",
          );
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
        const audiencePaths = page.getByRole("list", { name: "Choose your docs path" });
        for (const href of [
          "/docs/start/business-owners",
          "/docs/start/agencies",
          "/docs/extend/first-change",
        ]) {
          await audiencePaths.locator(`a[href="${href}"]`).click();
          await page.waitForURL(`**${href}`);
          await page.locator("main h1").waitFor({ state: "visible" });
          await page.goBack({ waitUntil: "domcontentloaded" });
          await audiencePaths.waitFor();
        }
        checks.push(
          `${viewport.width}: each audience path opens its guide and Back returns to the chooser`,
        );
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
    // The docs must be discoverable through the real public site, not only direct URLs.
    for (const width of [1440, 1024, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      try {
        const page = await context.newPage();
        page.on("pageerror", (error) => failures.push(error.message));
        await page.goto(`${base}/docs`, { waitUntil: "domcontentloaded" });
        if (width >= 1280) {
          const nav = page.getByRole("navigation", { name: "Primary", exact: true });
          const product = nav.getByRole("button", { name: "Command Center", exact: true });
          await product.focus();
          await product.press("Enter");
          const submenu = nav.getByRole("group", { name: "Command Center submenu" });
          await submenu.getByRole("link", { name: "Try the demo", exact: true }).waitFor();
          await product.press("Tab");
          assert.equal(await page.locator(":focus").getAttribute("href"), "/command-center");
          await page.keyboard.press("Escape");
          assert.equal(await product.getAttribute("aria-expanded"), "false");
          assert.equal(await product.evaluate((el) => el === document.activeElement), true);
          await product.click();
          await submenu.waitFor({ state: "visible" });
          await page.waitForFunction(
            (element) =>
              element?.parentElement && getComputedStyle(element.parentElement).opacity === "1",
            await submenu.elementHandle(),
          );
          await page.screenshot({ path: `${output}/${width}-public-submenu.png` });
          await page.locator("main h1").click();
          assert.equal(await product.getAttribute("aria-expanded"), "false");
          const company = nav.getByRole("button", { name: "Company", exact: true });
          await company.click();
          await nav.getByRole("link", { name: "Team", exact: true }).click();
          await page.waitForURL("**/team");
          assert.equal(await company.getAttribute("aria-expanded"), "false");
          checks.push(
            "Desktop disclosures: keyboard, Escape focus, outside click, and route dismissal",
          );
        } else {
          const trigger = page.getByRole("button", { name: "Open navigation menu" });
          await trigger.click();
          const mobile = page.getByRole("navigation", { name: "Mobile", exact: true });
          const product = mobile.getByRole("button", { name: "Command Center", exact: true });
          await product.click();
          await mobile.getByRole("link", { name: "Try the demo", exact: true }).waitFor();
          await page.waitForFunction(() => {
            const overlay = document.querySelector(".mobile-nav-overlay");
            const children = document.querySelector("#mobile-command-center");
            return (
              overlay &&
              children &&
              getComputedStyle(overlay).opacity === "1" &&
              getComputedStyle(children).opacity === "1"
            );
          });
          await page.screenshot({ path: `${output}/${width}-public-submenu.png` });
          await product.click();
          assert.equal(await page.locator("#mobile-command-center").getAttribute("inert"), "");
          await product.press("Tab");
          assert.equal(
            await page
              .locator(":focus")
              .innerText()
              .then((text) => text.includes("Industries")),
            true,
          );
          await page.keyboard.press("Escape");
          assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
          await trigger.click();
          await mobile.getByRole("link", { name: "Docs", exact: true }).click();
          assert.equal(await trigger.getAttribute("aria-expanded"), "false");
          await trigger.click();
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page.waitForFunction(() => !document.body.dataset.mobileNavigation);
          await page.setViewportSize({ width, height: 1000 });
          checks.push(
            `${width}: mobile submenu excludes collapsed links from Tab, restores focus, closes on navigation and resize`,
          );
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        for (const section of await page.locator("footer [data-footer-section]").all()) {
          await section.scrollIntoViewIfNeeded();
          await page.waitForFunction(
            (element) => element && getComputedStyle(element).opacity === "1",
            await section.elementHandle(),
          );
        }
        await page.locator("footer").scrollIntoViewIfNeeded();
        const clippedFooterControls = await page
          .locator("footer input, footer button, footer a")
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
              })
              .map((element) => element.getAttribute("aria-label") || element.textContent),
          );
        assert.deepEqual(
          clippedFooterControls,
          [],
          `${width}: footer controls must fit the viewport`,
        );

        await page.locator("footer").screenshot({ path: `${output}/${width}-public-footer.png` });
        await page
          .locator("footer")
          .getByRole("link", { name: "Documentation", exact: true })
          .click();
        await page.waitForURL("**/docs");
        await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
        const homeDocs = page
          .locator("#command-center")
          .getByRole("link", { name: "Read the docs" });
        await homeDocs.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const link = document.querySelector('#command-center a[href="/docs"]');
          return link?.parentElement && getComputedStyle(link.parentElement).opacity === "1";
        });
        await page.screenshot({ path: `${output}/${width}-home-docs-link.png` });
        await homeDocs.click();
        await page.waitForURL("**/docs");
        for (const [route, label, destination] of [
          ["/command-center", "Read the docs", "/docs"],
          ["/open-source", "Read the self-hosting docs", "/docs/self-hosting"],
        ] as const) {
          await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
          await page.locator("main").getByRole("link", { name: label, exact: true }).click();
          await page.waitForURL(`**${destination}`);
        }
        checks.push(
          `${width}: footer, homepage, product overview, and open-source page lead into the docs`,
        );
        if (width === 1440) {
          const links = [
            ...navItems.flatMap((item) => item.children ?? [item]),
            ...footerLinks.flatMap((group) => group.links),
          ];
          const documents = new Map<string, string>();
          for (const href of new Set(links.map((link) => link.href))) {
            const [path, hash] = href.split("#");
            assert.ok(
              path && path.startsWith("/"),
              `Real navigation destination required: ${href}`,
            );
            if (!documents.has(path)) {
              const response = await page.request.get(`${base}${path}`);
              assert.equal(response.status(), 200, `Public link ${href}`);
              documents.set(path, await response.text());
            }
            if (hash)
              assert.ok(documents.get(path)?.includes(`id="${hash}"`), `Missing section ${href}`);
          }
          checks.push("All shared header/footer destinations return 200 and service anchors exist");
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

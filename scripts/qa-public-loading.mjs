import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = process.env.PUBLIC_LOADING_QA_OUTPUT || "/tmp/accelerate-public-loading";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const config of [
    { label: "desktop", viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" },
    { label: "mobile", viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" },
    { label: "reduced", viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
  ]) {
    const context = await browser.newContext(config);
    const page = await context.newPage();
    try {
      const errors = [];
      const assets = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if (path.startsWith("/_next/static/") && /\.(js|css)$/.test(path))
          assets.push(response.text().then((body) => ({ path, body })));
      });
      // Keep third-party analytics out of this first-party loading check.
      await page.route("https://plausible.io/**", (route) => route.fulfill({ body: "" }));
      await page.route("**/js/script.js*", (route) => route.fulfill({ body: "" }));
      await page.goto(base, { waitUntil: "networkidle" });
      const initial = await Promise.all(assets);
      const source = (items, extension) =>
        items
          .filter((item) => item.path.endsWith(extension))
          .map((item) => item.body)
          .join("\n");
      assert.ok(
        !source(initial, ".js").includes("Search pages, industries, and articles"),
        `${config.label}: search dialog downloaded before opening`,
      );
      assert.ok(
        !source(initial, ".js").includes("accelerate-chat-v1"),
        `${config.label}: chat panel downloaded before opening`,
      );
      assert.ok(
        !source(initial, ".css").includes(".admin-conversation-layout"),
        `${config.label}: public page downloaded admin component styling`,
      );
      assert.equal(
        await page
          .locator('link[rel="preload"][as="image"][imagesrcset*="slide-today-paper"]')
          .count(),
        0,
        "The lower homepage gallery must not preload its screenshots",
      );

      await page.keyboard.press("/");
      const search = page.getByRole("dialog", { name: "Search", exact: true });
      await search.waitFor();
      const input = search.getByRole("textbox", { name: "Search query" });
      await input.fill("Site Studio");
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("aria-label") === "Search query",
      );
      await search
        .getByRole("button")
        .filter({ hasText: "Draft public pages with Site Studio" })
        .first()
        .waitFor();
      assert.ok(
        source(await Promise.all(assets), ".js").includes("Search pages, industries, and articles"),
      );
      await page.screenshot({ path: `${output}/${config.label}-search.png` });
      await page.keyboard.press("Escape");
      await search.waitFor({ state: "detached" });
      await page.keyboard.press("Control+k");
      await search.waitFor();
      await page.keyboard.press("Escape");
      await search.waitFor({ state: "detached" });

      await page.evaluate(() => window.scrollTo(0, 300));
      const bubble = page.getByRole("button", { name: "Open chat", exact: true });
      await bubble.click();
      const chat = page.locator(".chat-panel");
      await chat.waitFor();
      await page.waitForFunction(() => document.activeElement?.hasAttribute("data-chat-close"));
      assert.ok(source(await Promise.all(assets), ".js").includes("accelerate-chat-v1"));
      await page.keyboard.press("Shift+Tab");
      assert.ok(
        await chat.evaluate((node) => node.contains(document.activeElement)),
        "Chat must trap keyboard focus",
      );
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${output}/${config.label}-chat.png` });
      await page.keyboard.press("Escape");
      await chat.waitFor({ state: "detached" });
      await page.waitForFunction(
        () => document.activeElement?.getAttribute("aria-label") === "Open chat",
      );

      await page.goto(`${base}/changelog`, { waitUntil: "networkidle" });
      const field = page.locator(".admin-field").first();
      await field.waitFor();
      const fieldStyle = await field.evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        border: getComputedStyle(node).borderStyle,
      }));
      assert.ok(
        fieldStyle.height >= 40 && fieldStyle.border === "solid",
        "Public fields retain their shared styles",
      );
      await page.screenshot({ path: `${output}/${config.label}-changelog.png` });
      await page.goto(`${base}/docs/plugins/site-studio`, { waitUntil: "networkidle" });
      await page
        .getByRole("heading", { name: "Draft public pages with Site Studio", exact: true })
        .waitFor();
      await page.screenshot({ path: `${output}/${config.label}-docs.png` });
      await page.goto(`${base}/demo/command-center/northline-roofing/today`, {
        waitUntil: "networkidle",
      });
      await page.locator(".admin-shell").waitFor();
      assert.ok(
        source(await Promise.all(assets), ".css").includes(".admin-conversation-layout"),
        "Admin routes load their component stylesheet",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2),
        false,
      );
      await page.screenshot({ path: `${output}/${config.label}-admin.png` });
      assert.deepEqual(errors, [], `${config.label}: browser errors`);
      results.push({
        label: config.label,
        initialAssets: initial.length,
        deferredDialogs: true,
        styles: true,
        keyboard: true,
      });
    } catch (error) {
      await page.screenshot({ path: `${output}/${config.label}-failure.png` }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = { result: "passed", results, screenshots: output };
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

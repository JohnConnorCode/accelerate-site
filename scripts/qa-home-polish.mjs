import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.HOME_POLISH_OUTPUT || "/tmp/accelerate-home-polish";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    for (const colorScheme of ["light", "dark"]) {
      const label = `${width}-${colorScheme}`;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme,
        reducedMotion: width === 390 ? "reduce" : "no-preference",
        hasTouch: width < 1000,
      });
      await context.addInitScript((theme) => localStorage.setItem("theme", theme), colorScheme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".home-hero-cta").waitFor();
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        colorScheme,
      );
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const order = await page
        .locator("#selected-work, #systems, #trades, #how, #plan")
        .evaluateAll((sections) => sections.map((section) => section.id));
      assert.deepEqual(order, ["selected-work", "systems", "trades", "how", "plan"]);
      assert.equal(await page.locator("#selected-work [data-work-card]").count(), 1);
      assert.equal(await page.locator(".home-work-link").count(), 3);
      await page.screenshot({ path: `${output}/${label}-hero.png` });
      for (const selector of ["#selected-work", "#systems", "#how", "#plan", "#call"]) {
        await page.locator(selector).evaluate((section) => section.scrollIntoView());
        await page.waitForTimeout(650);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${label} ${selector}: horizontal overflow`,
        );
        await page.screenshot({ path: `${output}/${label}-${selector.slice(1)}.png` });
      }
      // A call already in view replaces the floating call bar and clears the
      // chat's mobile offset. Test both re-entry and disappearance on scroll.
      await page.locator("#selected-work").evaluate((section) => section.scrollIntoView());
      await page.waitForFunction(() => document.body.dataset.mcta === "on");
      await page
        .locator("#plan [data-booking-cta]")
        .evaluate((cta) => cta.scrollIntoView({ block: "center" }));
      await page.waitForFunction(() => !document.body.hasAttribute("data-mcta"));
      await page.waitForFunction(() => !document.querySelector("[data-dock]"));
      await page.locator("#selected-work").evaluate((section) => section.scrollIntoView());
      await page.waitForFunction(() => document.body.dataset.mcta === "on");
      const project = page.locator(".home-work-link").first();
      const href = await project.getAttribute("href");
      await project.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`${base}${href}`);
      await page.goBack({ waitUntil: "networkidle" });
      await page.locator("#selected-work").waitFor();
      if (width === 390) {
        await page.locator("#plan").evaluate((section) => section.scrollIntoView());
        assert.equal(
          await page
            .locator("#plan .rv")
            .evaluateAll(
              (nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length,
            ),
          0,
          "Reduced motion content is immediately readable",
        );
      }
      assert.deepEqual(errors, [], `${label}: runtime errors`);
      results.push({ width, colorScheme, order, status: "passed" });
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify({ status: "passed", results }, null, 2));
  console.log(
    `PASS homepage composition, booking clearance, keyboard and navigation: ${results.length} viewports`,
  );
} finally {
  await browser.close();
}

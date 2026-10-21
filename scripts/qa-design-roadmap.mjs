// Run against a production server through resources:run; all admin records are fictional.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { verticals } from "../src/content/verticals.ts";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated.ts";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3015";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = resolve("output/playwright/design-roadmap");
mkdirSync(output, { recursive: true });
const marketing = [
  ...new Set([
    "/",
    "/services",
    "/industries",
    "/command-center",
    "/about",
    "/contact",
    "/roofing",
    "/style-guide",
    ...verticals.map((vertical) => `/industries/${vertical.slug}`),
  ]),
];
const admin = [
  "analytics",
  "campaigns",
  "chat-leads",
  "clients",
  "contact-imports",
  "contacts",
  "conversations",
  "email-sequences",
  "identity-review",
  "inbox",
  "integrations",
  "integrations?tab=modules",
  "leads",
  "pipeline",
  "plugins",
  "proposals",
  "resources",
  "subscribers",
  "website-grades",
  "work",
  "today",
  "settings",
];
const cases = [];
const browser = await chromium.launch({ headless: true });

async function inspect(route, theme, width, isAdmin) {
  const id = `${isAdmin ? "admin" : "site"}-${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}-${theme}-${width}`;
  const result = { id, route, theme, width, errors: [], screenshots: [] };
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ theme, isAdmin }) => {
      localStorage.setItem("theme", isAdmin ? "light" : theme);
      if (isAdmin) {
        sessionStorage.setItem("accelerate:admin-demo:northline-roofing:appearance:v1", theme);
        localStorage.setItem("accelerate:demo-theme:northline-roofing", theme);
      }
    },
    { theme, isAdmin },
  );
  // The shared demo engine handles these operations in session storage.
  await context.route("**/api/admin/**", (request) => request.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") result.errors.push(message.text());
  });
  try {
    const href = isAdmin ? `/demo/command-center/northline-roofing/${route}` : route;
    const response = await page.goto(base + href, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200, href);
    await page
      .locator(isAdmin ? ".admin-main h1" : "h1")
      .first()
      .waitFor();
    await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
    await page.evaluate(() => document.fonts.ready);
    if (isAdmin) {
      await page.waitForFunction(() => document.documentElement.dataset.motionHydrated === "true");
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.admin-main [aria-busy="true"]')].every(
          (element) => !element.getClientRects().length,
        ),
      );
    } else {
      // Visit the whole document so lazy images and shared reveals reach their rendered state.
      for (
        let y = 0;
        y < (await page.evaluate(() => document.documentElement.scrollHeight));
        y += 800
      ) {
        await page.evaluate((y) => scrollTo(0, y), y);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      }
      await page.evaluate(() => scrollTo(0, 0));
    }
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
      `${id}: horizontal overflow`,
    );
    if (route.startsWith("/industries/")) {
      const stream = page.locator(".activity-stream");
      assert.equal(await stream.count(), 1);
      assert.equal(await stream.locator("li").count(), 6);
      assert((await stream.locator("li[data-system]").count()) >= 2);
      assert((await stream.locator("li:not([data-system])").count()) >= 2);
      assert.match(await stream.locator("figcaption").innerText(), /Illustrative/);
      const straySignal = await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .filter((element) => {
            if (element.closest(".activity-stream")) return false;
            const style = getComputedStyle(element);
            return [style.color, style.backgroundColor, style.borderTopColor].some(
              (color) => color === "rgb(255, 90, 31)",
            );
          })
          .map((element) => element.tagName + "." + element.className),
      );
      assert.deepEqual(straySignal, [], `${id}: signal outside the stream`);
    }
    if (route === "/style-guide") {
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-token]")].every(
          (element) => element.textContent.trim() && !element.textContent.includes("Reading"),
        ),
      );
      assert.doesNotMatch(await page.locator("main").innerText(), /gold|italic|retired themes/i);
      const styles = await page
        .locator("main")
        .locator('.btn[data-ui-button="primary"], a.btn')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const style = getComputedStyle(element);
            return [
              style.fontFamily,
              style.fontSize,
              style.letterSpacing,
              style.backgroundColor,
              style.color,
              style.padding,
              style.borderRadius,
            ];
          }),
        );
      assert.deepEqual(styles[0], styles[1], `${id}: component and link button recipes differ`);
    }
    if (route === "plugins" || route === "integrations?tab=modules") {
      const cards = page.locator("[data-module-card]");
      if (route === "plugins") assert.equal(await cards.count(), EXTENSION_MODULES.length);
      for (const definition of EXTENSION_MODULES) {
        const card = page.locator(`[data-module-card="${definition.id}"]`);
        assert.equal(await card.count(), 1, `${id}: ${definition.id}`);
        assert.match(await card.innerText(), /Owner/);
        assert.match(await card.innerText(), /Autonomy/);
        assert.equal(await card.locator("[data-module-activity]").count(), 1);
      }
    }
    if (route === "pipeline" || route === "clients")
      assert.equal(
        await page.locator('[data-stat-density="compact"]').count(),
        route === "pipeline" ? 4 : 3,
      );
    const filename = `${output}/${id}.png`;
    await page.screenshot({ path: filename, fullPage: !isAdmin });
    result.screenshots.push(filename);
    if (route === "plugins" && theme === "accelerate" && width === 1440) {
      mkdirSync("public/images/docs/workspace", { recursive: true });
      await page.screenshot({ path: "public/images/docs/workspace/module-cards-20261020.png" });
    }
    if (route === "contacts") {
      assert.equal(await page.getByRole("link", { name: "Open history", exact: true }).count(), 0);
      const first = page.locator("[data-record-row] a").first();
      const href = await first.getAttribute("href");
      await page.keyboard.press("Tab");
      await first.focus();
      assert(await first.evaluate((element) => element.matches(":focus-visible")));
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.pathname === href);
      await page.locator(".admin-main h1").waitFor();
    }
    if (route === "plugins" && theme === "light" && width === 1440) {
      const definition = EXTENSION_MODULES.find((entry) => entry.report);
      const card = page.locator(`[data-module-card="${definition.id}"]`);
      const enable = card.getByRole("button", { name: `Enable ${definition.name}`, exact: true });
      if (await enable.count()) await enable.click();
      await card.getByRole("button", { name: "Run report", exact: true }).click();
      await card
        .locator("[data-module-activity]")
        .getByText("System:", { exact: true })
        .waitFor({ state: "attached" });
      assert.doesNotMatch(
        await card.locator("[data-module-activity]").innerText(),
        /No execution receipt/,
      );
    }
    assert.deepEqual(result.errors, [], `${id}: console or runtime errors`);
    result.passed = true;
  } catch (error) {
    result.failure = error.message;
    const filename = `${output}/${id}-failure.png`;
    await page
      .screenshot({ path: filename })
      .then(() => result.screenshots.push(filename))
      .catch(() => {});
    console.error(`${id}: ${error.message.slice(0, 220)}`);
  } finally {
    cases.push(result);
    if (cases.length % 16 === 0) console.log(`Checked ${cases.length} design cases`);
    writeFileSync(`${output}/results.json`, JSON.stringify(cases, null, 2) + "\n");
    await context.close();
  }
}

try {
  for (const theme of ["light", "dark"])
    for (const width of [1440, 390])
      for (const route of marketing) await inspect(route, theme, width, false);
  for (const theme of ["accelerate", "light", "dark", "operator"])
    for (const width of [1440, 390])
      for (const route of admin) await inspect(route, theme, width, true);
} finally {
  await browser.close();
}
const failures = cases.filter((entry) => !entry.passed);
console.log(
  JSON.stringify({
    cases: cases.length,
    passed: cases.length - failures.length,
    failed: failures.length,
    output,
  }),
);
if (failures.length) process.exitCode = 1;

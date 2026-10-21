// Run against a production server through resources:run; all admin records are fictional.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { verticals } from "../src/content/verticals.ts";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated.ts";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3015";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = resolve(process.env.DESIGN_ROADMAP_QA_OUTPUT || "output/playwright/design-roadmap");
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
  const result = { id, route, theme, width, errors: [], warnings: [], screenshots: [] };
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.addInitScript(
    ({ theme, isAdmin }) => {
      if (window.top !== window) return;
      localStorage.setItem("theme", isAdmin ? "light" : theme);
      if (isAdmin) {
        sessionStorage.setItem("accelerate:admin-demo:northline-roofing:appearance:v1", theme);
        localStorage.setItem("accelerate:demo-theme:northline-roofing", theme);
      }
    },
    { theme, isAdmin },
  );
  // Visual QA does not send public analytics to a connected database.
  await context.route("**/api/analytics/events", (request) => request.fulfill({ status: 204 }));
  // The shared demo engine handles these operations in session storage.
  await context.route("**/api/admin/**", (request) => request.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => result.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      route === "/contact" &&
      [
        "requestStorageAccess: Permission denied.",
        `Framing 'https://www.recaptcha.net/' violates the following report-only Content Security Policy directive: "frame-ancestors 'self'". The violation has been logged, but no further action has been taken.`,
      ].includes(message.text().trim()) &&
      page.frames().some((frame) => frame.url().startsWith("https://calendly.com/"))
    ) {
      result.warnings.push({ message: message.text(), provider: "Calendly embed" });
      return;
    }
    result.errors.push(message.text());
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
      assert.match(await stream.locator("figcaption").innerText(), /\billustrative\b/i);
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
      const guide = await page.evaluate(() => {
        const title = document.querySelector("main h1").getBoundingClientRect();
        const header = document.querySelector(".site-header").getBoundingClientRect();
        const stage = document.querySelector("[data-style-guide-artwork]");
        const wrapper = stage.getBoundingClientRect();
        const artwork = stage.querySelector(".home-hero-artwork").getBoundingClientRect();
        const proof = document
          .getElementById("guide-proof")
          .closest("section")
          .getBoundingClientRect();
        return {
          titleTop: title.top,
          headerBottom: header.bottom,
          display: getComputedStyle(stage).display,
          wrapper: {
            top: wrapper.top,
            bottom: wrapper.bottom,
            left: wrapper.left,
            right: wrapper.right,
            height: wrapper.height,
          },
          artwork: {
            top: artwork.top,
            bottom: artwork.bottom,
            left: artwork.left,
            right: artwork.right,
          },
          proof: { top: proof.top, bottom: proof.bottom },
        };
      });
      assert(guide.titleTop >= guide.headerBottom, `${id}: title is behind the header`);
      if (width < 641) {
        assert.equal(guide.display, "none");
        assert.equal(guide.wrapper.height, 0);
      } else {
        assert(
          guide.artwork.top >= guide.wrapper.top - 1 &&
            guide.artwork.bottom <= guide.wrapper.bottom + 1,
          `${id}: artwork escapes its stage vertically`,
        );
        assert(
          guide.artwork.left >= guide.wrapper.left - 1 &&
            guide.artwork.right <= guide.wrapper.right + 1,
          `${id}: artwork escapes its stage horizontally`,
        );
        assert(
          guide.artwork.top >= guide.proof.top && guide.artwork.bottom <= guide.proof.bottom,
          `${id}: artwork overlays another section`,
        );
      }
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-token]")].every(
          (element) => element.textContent.trim() && !element.textContent.includes("Reading"),
        ),
      );
      assert.doesNotMatch(await page.locator("main").innerText(), /gold|italic|retired themes/i);
      const button = page.locator('main button.btn[data-ui-button="primary"]:not(:disabled)');
      const link = page.locator("main a.btn");
      assert.equal(await button.count(), 1);
      assert.equal(await link.count(), 1);
      const styles = await page
        .locator("main")
        .locator('button.btn[data-ui-button="primary"]:not(:disabled), a.btn')
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
      if (width >= 641) {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.locator("[data-style-guide-artwork]").scrollIntoViewIfNeeded();
        const restingSculpture = await page
          .locator("[data-style-guide-artwork] .home-sculpture")
          .evaluate((root) => ({
            layers: root.querySelectorAll(".home-sculpture-layer").length,
            running: root
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
            controls: root.querySelectorAll("a, button, input, [tabindex]").length,
          }));
        assert.equal(restingSculpture.layers, 3, `${id}: brand sculpture is missing`);
        assert.equal(restingSculpture.running, 0, `${id}: brand sculpture has ambient motion`);
        assert.equal(restingSculpture.controls, 0, `${id}: decorative artwork exposes controls`);
        const motionFrame = `${output}/${id}-ordinary-motion.png`;
        await page.screenshot({ path: motionFrame });
        result.screenshots.push(motionFrame);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.evaluate(() => scrollTo(0, 0));
      }
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
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("main tbody tr")].every(
          (row) => !row.style.opacity || Number(row.style.opacity) >= 0.99,
        ) &&
        document
          .querySelector("main")
          .getAnimations({ subtree: true })
          .every(
            (animation) =>
              animation.playState !== "running" ||
              animation.effect?.getTiming().iterations === Infinity,
          ),
    );
    await page.screenshot({ path: filename, fullPage: !isAdmin });
    result.screenshots.push(filename);
    if (route === "leads" && theme === "light" && width === 1440) {
      await page.getByRole("button", { name: "New Lead", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const style = await dialog
        .locator("[data-ui-button]")
        .first()
        .evaluate((element) => {
          const computed = getComputedStyle(element);
          return {
            transform: computed.textTransform,
            tracking: computed.letterSpacing,
            gap: computed.columnGap,
          };
        });
      assert.deepEqual(style, { transform: "none", tracking: "normal", gap: "8px" });
      const modalFrame = `${output}/shared-button-dialog-paper.png`;
      await page.screenshot({ path: modalFrame });
      result.screenshots.push(modalFrame);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
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
    if (route === "plugins" && width === 1440) {
      const definition = EXTENSION_MODULES.find((entry) => entry.report);
      const card = page.locator(`[data-module-card="${definition.id}"]`);
      const enable = card.getByRole("button", { name: `Enable ${definition.name}`, exact: true });
      if (await enable.count()) await enable.click();
      const run = card.getByRole("button", { name: "Run report", exact: true });
      await run.hover();
      const hoverAccessibility = await new AxeBuilder({ page })
        .include(`[data-module-card="${definition.id}"]`)
        .withRules(["color-contrast"])
        .analyze();
      assert.deepEqual(
        hoverAccessibility.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        })),
        [],
        `${id}: report controls must remain readable while hovered`,
      );
      const hoverFrame = `${output}/${id}-report-hover.png`;
      await page.screenshot({ path: hoverFrame });
      result.screenshots.push(hoverFrame);
      await run.click();
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

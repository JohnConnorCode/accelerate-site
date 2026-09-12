import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { auditAdminLanguage } from "./audit-admin-language.mjs";

// Run against this candidate's existing isolated CI server. No server or build is started here.
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = process.env.ADMIN_LANGUAGE_QA_OUTPUT || "/tmp/accelerate-admin-language";
const inventory = auditAdminLanguage();
assert.deepEqual(inventory.problems, []);
const themes = JSON.parse(readFileSync("src/lib/admin/themes.json", "utf8"));
const scenario = "northline-roofing";
const demo = `/demo/command-center/${scenario}`;
const results = [],
  failures = [];
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 900, 390]) {
    for (const theme of themes) {
      const reducedMotion = width === 390 ? "reduce" : "no-preference";
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion,
      });
      await context.addInitScript(
        ({ scenario, appearance }) => {
          // Sandbox previews have no storage authority; configure only the app document.
          if (window === window.top)
            sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, appearance);
        },
        { scenario, appearance: theme.id },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("**/api/admin/**", async (route) => {
        errors.push(
          `Protected API escaped fictional runtime: ${new URL(route.request().url()).pathname}`,
        );
        await route.abort();
      });
      const destinations =
        width === 1440 && theme.id === "light"
          ? inventory.destinations
          : inventory.destinations.filter((d) =>
              ["architect", "blueprints", "learning", "contacts"].includes(d.id),
            );
      for (const destination of destinations) {
        const label = `${width}-${theme.id}-${destination.id}`;
        try {
          await page.goto(`${base}${destination.href.replace("/admin", demo)}`, {
            waitUntil: "networkidle",
            timeout: 60_000,
          });
          await page
            .getByRole("heading", { name: destination.label, exact: true })
            .first()
            .waitFor();
          assert(
            (await page.title()).startsWith(destination.label),
            "document title differs from root heading",
          );
          await page.waitForFunction(
            (appearance) => document.documentElement.dataset.theme === appearance,
            theme.id,
          );
          const main = page.locator(".admin-main");
          assert(
            await main.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
            "page escapes horizontal viewport",
          );
          const help = page.locator(".admin-help-trigger").first();
          await help.focus();
          await page.keyboard.press("Enter");
          const panel = page.getByRole("dialog", {
            name: `How ${destination.label} works`,
            exact: true,
          });
          await panel.waitFor();
          await panel.evaluate(async (node) => {
            await Promise.all(node.getAnimations().map((animation) => animation.finished));
          });
          assert((await panel.locator("li").count()) >= 2, "workflow steps absent");
          assert.equal(await panel.locator('a[href*="/docs/"]').count(), 1);
          const box = await panel.boundingBox();
          assert(
            box &&
              box.x >= 0 &&
              box.x + box.width <= width + 1 &&
              box.y >= 0 &&
              box.y + box.height <= 1001,
            "help escapes viewport",
          );
          await page.screenshot({ path: `${output}/${label}-help.png` });
          await page.keyboard.press("Escape");
          await panel.waitFor({ state: "hidden" });
          assert(
            await help.evaluate((node) => document.activeElement === node),
            "Escape did not restore help focus",
          );
          if (destination.id === "contacts") {
            // Read only fictional in-page data; the protected-request guard stays active.
            const email = await page.evaluate(
              async () =>
                (await fetch("/api/admin/contacts").then((r) => r.json())).contacts?.[0]?.email,
            );
            assert(email, "fictional contact fixture absent");
            await page.goto(`${base}${demo}/contacts/${encodeURIComponent(email)}`, {
              waitUntil: "networkidle",
            });
            await page
              .locator('.admin-breadcrumbs a, nav[aria-label="Breadcrumb"] a')
              .filter({ hasText: destination.label })
              .first()
              .waitFor();
            await page.screenshot({ path: `${output}/${label}-detail.png` });
          }
          results.push({
            width,
            theme: theme.id,
            reducedMotion,
            id: destination.id,
            result: "passed",
          });
        } catch (error) {
          failures.push(`${label}: ${error.message}`);
          await page.screenshot({ path: `${output}/${label}-failed.png` }).catch(() => {});
        }
      }
      failures.push(...errors.map((error) => `${width}-${theme.id}: ${error}`));
      await context.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(
    `${output}/summary.json`,
    JSON.stringify(
      {
        result: failures.length ? "failed" : "passed",
        sourceInventory: inventory,
        results,
        failures,
        evidenceBoundary:
          "Direct root identity/help and contact breadcrumb geometry. Existing shell-motion, contact states and theme-persistence suites remain separate; screenshots require human inspection.",
      },
      null,
      2,
    ),
  );
}
assert.deepEqual(failures, []);
console.log(
  `Admin language browser matrix passed (${results.length} route/width/theme cases). Screenshots: ${output}`,
);

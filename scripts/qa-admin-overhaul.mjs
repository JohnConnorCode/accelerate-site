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
            if (width < 640) {
              // Mobile details use the visible back link instead of desktop breadcrumbs.
              await page
                .getByRole("link", { name: "Back to contact intake", exact: true })
                .waitFor();
            } else {
              await page
                .locator('nav[aria-label="Breadcrumb"] a')
                .filter({ hasText: destination.label })
                .first()
                .waitFor();
            }
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
  // Discover the actual launcher registry instead of maintaining a seventh copy of its list.
  const launcher = await browser.newPage();
  launcher.on("pageerror", (error) => failures.push(`launcher: ${error.message}`));
  launcher.on("console", (message) => {
    if (message.type() === "error") failures.push(`launcher: ${message.text()}`);
  });
  await launcher.route("**/api/admin/**", async (route) => {
    failures.push(`launcher: Protected API escaped: ${new URL(route.request().url()).pathname}`);
    await route.abort();
  });
  await launcher.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
  const scenarioIds = await launcher
    .locator('a[href^="/demo/command-center/"]')
    .evaluateAll((links) => [
      ...new Set(links.map((link) => new URL(link.href).pathname.split("/")[3])),
    ]);
  assert.equal(scenarioIds.length, 6, "launcher must expose all six registered scenarios");
  await launcher.close();
  for (const width of [1440, 390]) {
    for (const scenarioId of scenarioIds) {
      const label = `routes-${width}-${scenarioId}`;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
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
      const prefix = `/demo/command-center/${scenarioId}`;
      async function assertIdentity(name, group) {
        await page.getByRole("heading", { name, exact: true }).first().waitFor();
        await page.waitForFunction((title) => document.title.startsWith(title), name);
        if (width === 390)
          await page.getByRole("button", { name: "Open More", exact: true }).click();
        const disclosure = page.getByRole("button", { name: group, exact: true });
        if ((await disclosure.getAttribute("aria-expanded")) === "false") await disclosure.click();
        const link = page.getByRole("link", { name, exact: true }).first();
        await link.waitFor({ state: "visible" });
        assert.equal(
          await link.getAttribute("aria-current"),
          "page",
          "visible navigation is not current",
        );
        if (width === 390) {
          await page.getByRole("button", { name: "Close navigation", exact: true }).click();
          await page.locator("#admin-mobile-navigation").waitFor({ state: "detached" });
        }
        assert(
          await page
            .locator(".admin-main")
            .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
        );
      }
      async function search(name) {
        await page.keyboard.press("Control+k");
        const palette = page.getByRole("dialog", { name: "Admin command palette", exact: true });
        await palette.waitFor();
        await palette.getByRole("textbox").fill(name);
        return palette;
      }
      async function setCampaigns(enabled) {
        const result = await page.evaluate(async (value) => {
          const response = await fetch("/api/admin/tenant/modules", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ moduleId: "campaigns", enabled: value }),
          });
          return { ok: response.ok, value: await response.json() };
        }, enabled);
        assert(result.ok && result.value.enabled === enabled, "fictional module update failed");
      }
      try {
        await page.goto(`${base}${prefix}/email-sequences`, {
          waitUntil: "networkidle",
          timeout: 60000,
        });
        await assertIdentity("Email Sequences", "Marketing");
        const palette = await search("Architect");
        const result = palette
          .getByRole("button")
          .filter({ has: page.getByText("Architect", { exact: true }) });
        await result.focus();
        await page.keyboard.press("Enter");
        await page.waitForURL(
          (url) =>
            url.pathname === `${prefix}/ai` && url.searchParams.get("purpose") === "architect",
        );
        await assertIdentity("Architect", "Insights & AI");
        await page.screenshot({ path: `${output}/${label}-architect.png` });
        await page.goBack({ waitUntil: "networkidle" });
        await assertIdentity("Email Sequences", "Marketing");
        await setCampaigns(false);
        await page.waitForFunction(
          () => !document.querySelector('a.admin-nav-link[href$="/email-sequences"]'),
        );
        const disabledPalette = await search("Email Sequences");
        assert.equal(
          await disabledPalette.getByText("Email Sequences", { exact: true }).count(),
          0,
        );
        await page.keyboard.press("Escape");
        await disabledPalette.waitFor({ state: "detached" });
        await setCampaigns(true);
        await page.reload({ waitUntil: "networkidle" });
        await assertIdentity("Email Sequences", "Marketing");
        const restoredPalette = await search("Email Sequences");
        await restoredPalette.getByText("Email Sequences", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        await restoredPalette.waitFor({ state: "detached" });
        await page.screenshot({ path: `${output}/${label}-sequences.png` });
        results.push({
          width,
          scenario: scenarioId,
          id: "scenario-route-parity",
          result: "passed",
        });
      } catch (error) {
        failures.push(`${label}: ${error.message}`);
        await page.screenshot({ path: `${output}/${label}-failed.png` }).catch(() => {});
      } finally {
        failures.push(...errors.map((error) => `${label}: ${error}`));
        await context.close();
      }
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

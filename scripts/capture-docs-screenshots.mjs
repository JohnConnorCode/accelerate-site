#!/usr/bin/env node
/**
 * Capture docs screenshots from the fictional demo, the same way the
 * existing public/images/docs/plugins/*.png were made by hand (see
 * docs/verification/PUBLIC-DOCS-PRODUCT-STORY-2026-09-06.md): 1440x1000,
 * dpr 1, reduced motion, external origins and /api/ blocked, dev-tools
 * overlay hidden.
 *
 * Usage:
 *   npm run dev -- --port 3019          # in one terminal
 *   PLAYWRIGHT_BASE_URL=http://localhost:3019 node scripts/capture-docs-screenshots.mjs [--only <id>] [--dry-run]
 *
 * Re-run this whenever the admin UI changes meaningfully; it always
 * overwrites the same file per shot id, so a re-run is a clean refresh.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3019";
const baseUrl = new URL(base);
if (baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  throw new Error(`Refusing non-loopback base URL: ${base}`);
}

const OUT_ROOT = path.resolve("public/images/docs");
const dryRun = process.argv.includes("--dry-run");
const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only = onlyArg ? process.argv[process.argv.indexOf(onlyArg) + 1] : null;

/**
 * One row per shot. `id` becomes public/images/docs/<id>.png.
 * `route` is appended to /demo/command-center/<scenario>/.
 * `wait` is a Playwright locator description used to confirm the page
 * actually loaded its content before the shot is taken.
 */
const SHOTS = [
  { id: "command-center/today", scenario: "northline-roofing", route: "today", wait: { role: "heading", name: "Today" } },
  { id: "command-center/inbox", scenario: "northline-roofing", route: "inbox", wait: { role: "heading", name: "Inbox" } },
  { id: "command-center/work", scenario: "northline-roofing", route: "work", wait: { role: "heading", name: "Work" } },
  { id: "command-center/activity", scenario: "northline-roofing", route: "activity", wait: { role: "heading", name: "Activity" } },
  { id: "contacts/overview", scenario: "northline-roofing", route: "contacts", wait: { role: "heading", name: /contact/i } },
  { id: "contacts/import", scenario: "northline-roofing", route: "contact-imports", wait: { role: "heading", name: /import/i } },
  { id: "conversations/overview", scenario: "northline-roofing", route: "conversations", wait: { role: "heading", name: "Conversations" } },
  { id: "pipeline/overview", scenario: "northline-roofing", route: "pipeline", wait: { role: "heading", name: "Pipeline" } },
  { id: "pipeline/revenue", scenario: "northline-roofing", route: "revenue", wait: { role: "heading", name: /revenue/i } },
  { id: "proposals/overview", scenario: "northline-roofing", route: "proposals", wait: { role: "heading", name: "Proposals" } },
  { id: "outreach/campaigns", scenario: "northline-roofing", route: "campaigns", wait: { role: "heading", name: "Campaigns" } },
  { id: "outreach/email-studio", scenario: "northline-roofing", route: "emails", wait: { role: "heading", name: /email/i } },
  { id: "outreach/recovery", scenario: "northline-roofing", route: "recovery", wait: { role: "heading", name: /recovery/i } },
  { id: "delivery/clients", scenario: "northline-roofing", route: "clients", wait: { role: "heading", name: /client/i } },
  { id: "delivery/bookings", scenario: "northline-roofing", route: "bookings", wait: { role: "heading", name: /booking/i } },
  { id: "delivery/content", scenario: "northline-roofing", route: "content", wait: { role: "heading", name: /content/i } },
  { id: "delivery/resources", scenario: "northline-roofing", route: "resources", wait: { role: "heading", name: /resource/i } },
  { id: "sources/leads", scenario: "northline-roofing", route: "leads", wait: { role: "heading", name: /lead/i } },
  { id: "workspace/settings", scenario: "northline-roofing", route: "settings", wait: { role: "heading", name: /setting/i } },
  { id: "workspace/setup", scenario: "northline-roofing", route: "setup", wait: { role: "heading", name: /setup/i } },
  { id: "workspace/integrations", scenario: "northline-roofing", route: "integrations", wait: { role: "heading", name: /integration/i } },
  { id: "intelligence/workspace", scenario: "northline-roofing", route: "ai", wait: { role: "heading", name: /ai|ask/i } },
  { id: "plugins/stripe-invoicing", scenario: "northline-roofing", route: "invoicing", wait: { role: "heading", name: /invoic/i } },
  { id: "plugins/example-inventory", scenario: "northline-roofing", route: "example-inventory", wait: { role: "heading", name: /inventory/i } },
  { id: "start/agencies", scenario: "northline-roofing", route: "tenants", wait: { role: "heading", name: /workspace|tenant/i } },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  const escaped = [];
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== baseUrl.origin || u.pathname.startsWith("/api/")) {
      escaped.push(u.origin + u.pathname);
      return route.abort();
    }
    return route.continue();
  });

  await page.addInitScript(() => {
    const removeDevelopmentPortal = () =>
      document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    document.addEventListener("DOMContentLoaded", removeDevelopmentPortal);
    new MutationObserver(removeDevelopmentPortal).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });

  const results = [];
  for (const shot of SHOTS) {
    if (only && shot.id !== only) continue;
    const url = `${base}/demo/command-center/${shot.scenario}/${shot.route}`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.locator(".admin-shell").waitFor({ timeout: 15_000 });
      await page
        .waitForFunction(() => document.documentElement.dataset.motionHydrated === "true", {
          timeout: 10_000,
        })
        .catch(() => {});
      await page.getByRole(shot.wait.role, { name: shot.wait.name }).first().waitFor({ timeout: 15_000 });
      await page.waitForTimeout(400);

      const outPath = path.join(OUT_ROOT, `${shot.id}.png`);
      if (dryRun) {
        console.log(`[dry-run] would capture ${shot.id} -> ${outPath}`);
        results.push({ id: shot.id, ok: true, dryRun: true });
        continue;
      }
      mkdirSync(path.dirname(outPath), { recursive: true });
      const buffer = await page.screenshot({ path: outPath });
      results.push({ id: shot.id, ok: true, bytes: buffer.length, path: outPath });
      console.log(`OK   ${shot.id}  (${Math.round(buffer.length / 1024)} KB)`);
    } catch (err) {
      results.push({ id: shot.id, ok: false, error: String(err?.message || err) });
      console.log(`FAIL ${shot.id}: ${String(err?.message || err).split("\n")[0]}`);
    }
  }

  await browser.close();

  if (escaped.length) {
    console.log(`\nBlocked ${escaped.length} non-origin/API request(s):`);
    for (const u of [...new Set(escaped)].slice(0, 20)) console.log(`  - ${u}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} captured.`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.id).join(", "));
    process.exitCode = 1;
  }

  writeFileSync("/tmp/docs-screenshot-results.json", JSON.stringify(results, null, 2));
}

main();

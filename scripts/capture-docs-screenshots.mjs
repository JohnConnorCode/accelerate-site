#!/usr/bin/env node
/**
 * Refresh documentation and demo chooser screenshots from the actual demo UI.
 * Uses isolated browser sessions, bundled fonts, reduced motion and a network
 * fence. Only local demo controls are used; no provider action is approved.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3019 node scripts/capture-docs-screenshots.mjs [--only <id>] [--group docs|demo] [--dry-run]
 *
 * Re-run this whenever the admin UI changes meaningfully; it always
 * overwrites the same file per shot id, so a re-run is a clean refresh.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3019";
const baseUrl = new URL(base);
if (baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  throw new Error(`Refusing non-loopback base URL: ${base}`);
}

const dryRun = process.argv.includes("--dry-run");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex < 0 ? null : process.argv[onlyIndex + 1];
const groupIndex = process.argv.indexOf("--group");
const group = groupIndex < 0 ? null : process.argv[groupIndex + 1];
assert.ok(onlyIndex < 0 || only, "--only requires a screenshot id");
assert.ok(groupIndex < 0 || ["docs", "demo"].includes(group), "--group must be docs or demo");

/**
 * One row per shot. `id` becomes public/images/docs/<id>.png.
 * `route` is appended to /demo/command-center/<scenario>/.
 * `wait` is a Playwright locator description used to confirm the page
 * actually loaded its content before the shot is taken.
 */
const SHOTS = [
  {
    id: "plugins/client-onboarding",
    scenario: "northline-roofing",
    route: "client-onboarding",
    wait: { role: "heading", name: "Client onboarding" },
  },
  {
    id: "plugins/collections",
    scenario: "northline-roofing",
    route: "collections",
    wait: { role: "heading", name: "Collections" },
  },
  {
    id: "plugins/site-studio",
    scenario: "northline-roofing",
    route: "site",
    wait: { role: "heading", name: "Website & pages" },
  },
  {
    id: "command-center/today",
    scenario: "northline-roofing",
    route: "today",
    wait: { role: "heading", name: "Today" },
  },
  {
    id: "command-center/inbox",
    scenario: "northline-roofing",
    route: "inbox",
    wait: { role: "heading", name: "Intake review" },
  },
  {
    id: "command-center/work",
    scenario: "northline-roofing",
    route: "work",
    wait: { role: "heading", name: "Work" },
  },
  {
    id: "command-center/activity",
    scenario: "northline-roofing",
    route: "activity",
    wait: { role: "heading", name: "Activity" },
  },
  {
    id: "contacts/overview",
    scenario: "northline-roofing",
    route: "contacts",
    wait: { role: "heading", name: /contact/i },
  },
  {
    id: "contacts/record",
    scenario: "northline-roofing",
    route: "contacts/lena.walsh@northlineroofing.example",
    wait: { role: "heading", name: "Lena Walsh" },
  },
  {
    id: "contacts/import",
    scenario: "northline-roofing",
    route: "contact-imports",
    wait: { role: "heading", name: /import/i },
  },
  {
    id: "conversations/overview",
    scenario: "northline-roofing",
    route: "conversations",
    wait: { role: "heading", name: "Conversations" },
  },
  {
    id: "pipeline/overview",
    scenario: "northline-roofing",
    route: "pipeline",
    wait: { role: "heading", name: "Pipeline" },
  },
  {
    id: "proposals/overview",
    scenario: "northline-roofing",
    route: "proposals",
    wait: { role: "heading", name: "Proposals" },
  },
  {
    id: "outreach/campaigns",
    scenario: "northline-roofing",
    route: "campaigns",
    wait: { role: "heading", name: "Campaigns" },
  },
  {
    id: "outreach/email-studio",
    scenario: "northline-roofing",
    route: "emails",
    wait: { role: "heading", name: /email/i },
  },
  {
    id: "outreach/recovery",
    scenario: "northline-roofing",
    route: "recovery",
    wait: { role: "heading", name: /recovery/i },
  },
  {
    id: "delivery/clients",
    scenario: "northline-roofing",
    route: "clients",
    wait: { role: "heading", name: /client/i },
  },
  {
    id: "delivery/bookings",
    scenario: "northline-roofing",
    route: "bookings",
    wait: { role: "heading", name: /booking/i },
  },
  {
    id: "delivery/content",
    scenario: "northline-roofing",
    route: "content",
    wait: { role: "heading", name: /content/i },
  },
  {
    id: "delivery/resources",
    scenario: "northline-roofing",
    route: "resources",
    wait: { role: "heading", name: /resource/i },
  },
  {
    id: "sources/leads",
    scenario: "northline-roofing",
    route: "leads",
    wait: { role: "heading", name: "Website inquiries" },
  },
  {
    id: "workspace/settings",
    scenario: "northline-roofing",
    route: "settings",
    wait: { role: "heading", name: /setting/i },
  },
  {
    id: "workspace/setup",
    scenario: "northline-roofing",
    route: "setup",
    wait: { role: "heading", name: /setup/i },
  },
  {
    id: "workspace/integrations",
    scenario: "northline-roofing",
    route: "integrations",
    wait: { role: "heading", name: /integration/i },
  },
  {
    id: "intelligence/workspace",
    scenario: "northline-roofing",
    route: "ai",
    wait: { role: "heading", name: /ai|ask/i },
  },
  {
    id: "plugins/example-inventory",
    scenario: "northline-roofing",
    route: "example-inventory",
    module: "example-inventory",
    wait: { role: "heading", name: /inventory/i },
  },
  {
    id: "start/agencies",
    scenario: "northline-roofing",
    route: "tenants",
    wait: { role: "heading", name: /workspace|tenant/i },
  },
  {
    id: "billing/payments-workspace-2026-10-18",
    route: "invoicing?view=payments",
    wait: { role: "heading", name: "Payment activity" },
  },
  {
    id: "billing/refund-review-2026-10-18",
    route: "invoicing?view=payments",
    wait: { role: "heading", name: "Payment activity" },
    state: "refund-review",
  },
  {
    id: "billing/revenue-chart-2026-10-18",
    route: "revenue",
    wait: { role: "heading", name: "Active Contracts by Start Month" },
    target: "revenue-chart",
  },
  {
    id: "command-center/today-owner-review",
    route: "today",
    wait: { role: "heading", name: "Today" },
  },
  {
    id: "intelligence/cost-controls",
    route: "ai?view=costs",
    wait: { role: "heading", name: "Control AI spending" },
    state: "cost-controls",
    target: "cost-controls",
  },
  {
    id: "intelligence/learning",
    route: "learning",
    wait: { role: "heading", name: "Learning Inbox" },
  },
  {
    id: "plugins/forms",
    route: "forms",
    module: "form-builder",
    wait: { role: "heading", name: "Forms" },
  },
  {
    id: "plugins/meeting-commitments",
    route: "meeting-commitments",
    wait: { role: "heading", name: "Meeting commitments" },
    state: "meeting-commitments",
  },
  { id: "plugins/radar", route: "radar", wait: { role: "heading", name: /radar/i } },
  {
    id: "plugins/reports",
    route: "plugins",
    module: "business-pulse",
    wait: { role: "heading", name: "Plugins" },
    state: "business-pulse",
  },
  {
    id: "plugins/social-marketing",
    route: "social",
    wait: { role: "heading", name: "Social Marketing" },
    state: "social-draft",
  },
  {
    id: "plugins/subscriptions",
    route: "subscriptions",
    wait: { role: "heading", name: "Subscriptions" },
  },
  {
    id: "start/first-use",
    route: "get-started",
    wait: { role: "heading", name: "Get started" },
    state: "first-use",
  },
  ...[
    ["northline-roofing", "conversations", "northline-conversations", "Conversations"],
    ["alder-ridge-law", "pipeline", "alder-pipeline", "Pipeline"],
    ["ledgerstone-advisory", "client-onboarding", "ledgerstone-onboarding", "Client onboarding"],
    ["hearthline-realty", "pipeline", "hearthline-pipeline", "Pipeline"],
    [
      "common-table-network",
      "meeting-commitments",
      "common-table-commitments",
      "Meeting commitments",
    ],
    ["superdebate", "invoicing", "superdebate-invoicing", "Invoices"],
  ].map(([scenario, route, file, heading]) => ({
    id: `demo/${file}`,
    file: `public/images/demo/${file}-20261020-r2.png`,
    group: "demo",
    theme: "accelerate",
    scenario,
    route,
    wait: { role: "heading", name: heading },
    state: route,
  })),
];

const shots = SHOTS.filter(
  (shot) => (!only || shot.id === only) && (!group || (shot.group || "docs") === group),
);
assert.ok(shots.length, "No screenshots match the selected id/group");

async function prepareState(page, shot) {
  if (["meeting-commitments", "client-onboarding"].includes(shot.state)) {
    const source = page.getByRole("combobox", {
      name: shot.state === "client-onboarding" ? "Won opportunity" : "Stored meeting",
    });
    await source.locator("option").nth(1).waitFor({ state: "attached" });
    await source.selectOption({ index: 1 });
  } else if (shot.state === "refund-review") {
    await page.getByRole("button", { name: "Refund payment", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Refund payment", exact: true });
    await form.getByLabel("Refund amount (USD)", { exact: true }).fill("25.00");
    await form.getByLabel("Reason", { exact: true }).selectOption("duplicate");
    await form.getByRole("button", { name: "Review refund", exact: true }).click();
    const review = page.getByRole("dialog");
    await review.getByRole("region", { name: "Exact billing operation" }).waitFor();
    assert.match(await review.innerText(), /\$25\.00/);
    // Stop at review. Never approve a refund to manufacture a screenshot.
  } else if (shot.state === "business-pulse") {
    const report = page.locator('[data-plugin="business-pulse"]');
    await report.getByRole("button", { name: "Run report", exact: true }).click();
    await report.getByText(/records inspected/).waitFor();
    await report.scrollIntoViewIfNeeded();
  } else if (shot.state === "cost-controls") {
    const controls = page.getByRole("region", { name: "AI cost controls", exact: true });
    for (const label of ["Allow model requests", "Run recurring AI and coworker work"]) {
      assert.equal(
        await controls
          .getByRole("switch", { name: label, exact: true })
          .getAttribute("aria-checked"),
        "false",
      );
    }
    for (const [label, value] of [
      ["Daily budget (USD)", "1"],
      ["Monthly budget (USD)", "10"],
      ["Maximum per request (USD)", "0.10"],
      ["Maximum requests per day", "20"],
    ])
      await controls.getByLabel(label, { exact: true }).fill(value);
    await controls.getByRole("button", { name: "Save AI controls", exact: true }).click();
    await controls.getByRole("status").filter({ hasText: "AI controls saved." }).waitFor();
  } else if (shot.state === "first-use") {
    await page.getByRole("button", { name: "Refresh progress", exact: true }).waitFor();
  } else if (shot.state === "social-draft") {
    await page.getByRole("button", { name: "New draft", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit social draft" });
    await dialog.getByLabel("Title", { exact: true }).fill("Spring roof maintenance");
    const text = "Keep drainage routes clear and record maintenance work.";
    await dialog.getByLabel("Post text", { exact: true }).fill(text);
    const source = dialog.getByRole("group", { name: "Source supporting this post" });
    await source.getByLabel("title", { exact: true }).fill("Northline maintenance guide");
    await source.getByLabel("url", { exact: true }).fill("https://northline.example/maintenance");
    await source.getByLabel("excerpt", { exact: true }).fill(text);
    await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 draft saved" }).waitFor();
  }
}

async function ready(page, theme) {
  await page.waitForFunction(
    (theme) =>
      document.documentElement.dataset.theme === theme &&
      document.documentElement.dataset.motionHydrated === "true",
    theme,
  );
  await page.waitForFunction(() => {
    const visible = (node) =>
      node.getClientRects().length && getComputedStyle(node).visibility !== "hidden";
    return (
      [...document.querySelectorAll('main [aria-busy="true"]')].every((node) => !visible(node)) &&
      [...document.querySelectorAll('main p, main [role="status"]')].every(
        (node) =>
          !visible(node) || !/^(?:Loading(?:[ .…]|$)|Checking…$)/.test(node.textContent.trim()),
      ) &&
      [...document.querySelectorAll("main img")].every(
        (node) => node.complete && node.naturalWidth > 0,
      )
    );
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  assert.doesNotMatch(await page.locator("main").first().innerText(), /fictional\s+workspaces?/i);
  const labels = await page.getByText(/^Demo(?: workspace)?$/i).all();
  assert.ok(
    (await Promise.all(labels.map((label) => label.isVisible()))).some(Boolean),
    "Compact demo identity must remain visible",
  );
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Workspace overflows the capture viewport",
  );
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function main() {
  if (dryRun) {
    console.log(
      JSON.stringify(
        shots.map((shot) => ({
          id: shot.id,
          file: shot.file || `public/images/docs/${shot.id}.png`,
          route: `/demo/command-center/${shot.scenario || "northline-roofing"}/${shot.route}`,
          theme: shot.theme || "light",
        })),
        null,
        2,
      ),
    );
    return;
  }
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const shot of shots) {
      const scenario = shot.scenario || "northline-roofing";
      const theme = shot.theme || "light";
      const url = `${base}/demo/command-center/${scenario}/${shot.route}`;
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: shot.group === "demo" ? 2 : 1,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      context.setDefaultTimeout(20_000);
      await context.addInitScript(
        ({ scenario, theme }) => {
          if (window.top !== window) return;
          sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, theme);
          localStorage.setItem(`accelerate:demo-theme:${scenario}`, theme);
        },
        { scenario, theme },
      );
      const page = await context.newPage();
      const errors = [],
        escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().includes("favicon"))
          errors.push(message.text());
      });
      await context.route("**/*", (route) => {
        const requestUrl = new URL(route.request().url());
        if (["data:", "blob:"].includes(requestUrl.protocol)) return route.continue();
        if (
          requestUrl.origin === baseUrl.origin &&
          requestUrl.pathname === "/api/analytics/events"
        ) {
          return route.fulfill({ status: 204 });
        }
        if (requestUrl.origin !== baseUrl.origin || requestUrl.pathname.startsWith("/api/")) {
          escaped.push(requestUrl.origin + requestUrl.pathname);
          return route.abort();
        }
        return route.continue();
      });
      try {
        if (shot.module) {
          // Enable this optional example through the same simulated settings operation as the UI.
          await page.goto(`${base}/demo/command-center/${scenario}/today`, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
          await page.waitForFunction(
            (scenario) => window.__accelerateAdminDemoRuntime === scenario,
            scenario,
          );
          const enabled = await page.evaluate(async (moduleId) => {
            const response = await fetch("/api/admin/tenant/modules", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ moduleId, enabled: true }),
            });
            return response.ok;
          }, shot.module);
          if (!enabled) throw new Error(`Could not enable demo module ${shot.module}`);
        }
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.locator(".admin-shell").waitFor({ timeout: 15_000 });
        await page
          .getByRole(shot.wait.role, { name: shot.wait.name })
          .first()
          .waitFor({ timeout: 15_000 });
        await prepareState(page, shot);
        await ready(page, theme);
        assert.deepEqual(escaped, [], "A demo request reached the protected network fence");
        assert.deepEqual(errors, [], "Runtime or console errors prevent a publishable capture");
        const outPath = path.resolve(shot.file || `public/images/docs/${shot.id}.png`);
        mkdirSync(path.dirname(outPath), { recursive: true });
        let target = page;
        if (shot.target === "revenue-chart")
          target = page.getByRole("group", {
            name: "Active Contracts by Start Month",
            exact: true,
          });
        if (shot.target === "cost-controls")
          target = page
            .getByRole("region", { name: "AI cost controls", exact: true })
            .locator(".admin-surface")
            .first();
        const buffer = await target.screenshot({ path: outPath });
        assert.deepEqual(escaped, [], "A request escaped during capture");
        assert.deepEqual(errors, [], "A runtime error occurred during capture");
        results.push({
          id: shot.id,
          ok: true,
          url,
          theme,
          bytes: buffer.length,
          path: outPath,
          width: buffer.readUInt32BE(16),
          height: buffer.readUInt32BE(20),
          deviceScaleFactor: shot.group === "demo" ? 2 : 1,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        });
        console.log(`OK   ${shot.id}  (${Math.round(buffer.length / 1024)} KB)`);
      } catch (err) {
        results.push({
          id: shot.id,
          ok: false,
          url,
          errors,
          escaped,
          error: String(err?.message || err),
        });
        console.log(`FAIL ${shot.id}: ${String(err?.message || err).split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} captured.`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.id).join(", "));
    process.exitCode = 1;
  }

  const receipt = path.resolve(
    process.env.DOCS_SCREENSHOT_RECEIPT || "/tmp/docs-screenshot-results.json",
  );
  mkdirSync(path.dirname(receipt), { recursive: true });
  writeFileSync(
    receipt,
    JSON.stringify(
      { sourceCommit, baseUrl: base, capturedAt: new Date().toISOString(), results },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

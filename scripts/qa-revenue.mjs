import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expect } from "playwright/test";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3018";
const output = process.env.REVENUE_QA_OUTPUT ?? "/tmp/accelerate-revenue-qa";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a controlled local server",
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const proof = [],
  errors = [],
  escaped = [];
let currentPage;
const guardRequest = (route) => {
  const url = new URL(route.request().url());
  if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
    escaped.push(url.origin + url.pathname);
    return route.abort();
  }
  return route.continue();
};
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
      timezoneId: "America/Chicago",
    });
    await context.route("**/*", guardRequest);
    // Wrap each assigned fetch without replacing the fictional runtime or its source rules.
    // Faults are controlled transport outcomes; no backend/provider request is allowed.
    await context.addInitScript(() => {
      let implementation = window.fetch;
      window.__revenueFault = "error";
      Object.defineProperty(window, "fetch", {
        configurable: true,
        set(value) {
          implementation = value;
        },
        get() {
          const fetch = implementation;
          return async (input, init) => {
            const raw =
              typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const revenue = new URL(raw, location.origin).pathname === "/api/admin/revenue";
            if (revenue && window.__revenueFault === "error")
              return Response.json(
                {
                  error:
                    "Revenue could not be read completely. Retry, or ask your workspace owner to check reporting access and limits.",
                  retryable: true,
                },
                { status: 503 },
              );
            const response = await fetch(input, init);
            if (revenue && window.__revenueFault === "empty") {
              const data = await response.json();
              return Response.json({
                ...data,
                totalMRR: 0,
                totalOneTime: 0,
                proposalRevenue: 0,
                activeCount: 0,
                avgClientValue: 0,
                churnRate: 0,
                byClient: [],
                industryBreakdown: [],
                mrrTimeline: [],
                timelineDates: { creationDateFallbackCount: 0, unknownDateCount: 0 },
                canonical: {
                  opportunityCount: 0,
                  openOpportunities: 0,
                  pipelineValue: 0,
                  weightedValue: 0,
                  wonRevenue: 0,
                },
              });
            }
            return response;
          };
        },
      });
    });
    const page = await context.newPage();
    currentPage = page;
    const metrics = page.locator(".admin-grid--metrics");
    const alerts = page.locator('.admin-surface[role="alert"]');
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${base}/demo/command-center/northline-roofing/revenue`, { timeout: 60000 });
    await expect(page.getByRole("heading", { name: "Revenue", exact: true })).toBeVisible();
    await expect(alerts).toContainText("We couldn’t load this information");
    await expect(page.getByText("Monthly Recurring", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `${output}/${width}-initial-error.png`, fullPage: true });
    await page.evaluate(() => {
      window.__revenueFault = "healthy";
    });
    await page.getByRole("button", { name: "Retry", exact: true }).focus();
    await page.keyboard.press("Enter");
    const chart = page.getByRole("heading", {
      name: "Active Contracts by Start Month",
      exact: true,
    });
    await chart.waitFor();
    await expect(alerts).toHaveCount(0);
    if (width === 390) {
      const motionState = await page
        .locator(".admin-grid--panels .h-2 > div")
        .evaluateAll((bars) => ({
          reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
          widths: bars.map((bar) => ({
            fill: bar.getBoundingClientRect().width,
            track: bar.parentElement.getBoundingClientRect().width,
          })),
        }));
      assert.equal(motionState.reduced, true);
      assert.ok(motionState.widths.length > 0);
      for (const bar of motionState.widths)
        assert.ok(
          Math.abs(bar.fill - bar.track) <= 1,
          "Reduced-motion industry bars render their complete value",
        );
      proof.push({ width, reducedMotionComputed: motionState });
    }
    await expect(page.getByText("Churned Share", { exact: true })).toBeVisible();
    await expect(page.getByText("Accepted Proposal Monthly Value", { exact: true })).toBeVisible();
    const values = await page.evaluate(async () => {
      const get = async (path) => await (await fetch(path)).json();
      return {
        report: await get("/api/admin/revenue"),
        clients: (await get("/api/admin/clients")).clients,
        proposals: (await get("/api/admin/proposals")).proposals,
      };
    });
    const expected =
      values.clients
        .filter((row) => row.status === "active")
        .reduce((sum, row) => sum + Math.round(Number(row.monthly_value) * 100), 0) / 100;
    assert.equal(values.report.totalMRR, expected);
    assert.equal(values.report.mrrTimeline.at(-1).mrr, expected);
    assert.equal(
      values.report.proposalRevenue,
      values.proposals
        .filter((row) => row.status === "accepted")
        .reduce((sum, row) => sum + row.total_monthly, 0),
    );
    await expect(
      metrics.getByText(`$${expected.toLocaleString()}/mo`, { exact: true }),
    ).toBeVisible();
    await page.locator(".admin-content-stack").evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".admin-grid--metrics > div")].every(
        (element) => Number(getComputedStyle(element).opacity) >= 0.99,
      ),
    );
    await page.screenshot({ path: `${output}/${width}-recovered.png`, fullPage: true });
    if (width === 1440) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await page.addStyleTag({
        content: "[data-dev-tools-overlay], nextjs-portal { display: none !important; }",
      });
      await page.screenshot({ path: `${output}/revenue-guide.png` });
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    await page
      .getByRole("heading", { name: "Active Monthly Value by Client", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${width}-contract-breakdown.png` });
    await page
      .getByText("Accepted Proposal Monthly Value", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${width}-agreement-values.png` });
    await page.getByRole("heading", { name: "Revenue", exact: true }).scrollIntoViewIfNeeded();
    const edit = await page.evaluate(async () => {
      const response = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "client-0", status: "churned" }),
      });
      if (!response.ok) throw new Error("Demo edit failed");
      window.dispatchEvent(new Event("admin:priority-refresh"));
      return await (await fetch("/api/admin/revenue")).json();
    });
    assert.equal(edit.totalMRR, expected - values.clients[0].monthly_value);
    assert.equal(edit.mrrTimeline.at(-1).mrr, edit.totalMRR);
    await expect(
      metrics.getByText(`$${edit.totalMRR.toLocaleString()}/mo`, { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      window.__revenueFault = "error";
      window.dispatchEvent(new Event("admin:priority-refresh"));
    });
    await expect(alerts).toContainText("Showing previously loaded information");
    await expect(chart).toBeVisible();
    await expect(
      metrics.getByText(`$${edit.totalMRR.toLocaleString()}/mo`, { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `${output}/${width}-stale-warning.png`, fullPage: true });
    await page.evaluate(() => {
      window.__revenueFault = "healthy";
    });
    await page.getByRole("button", { name: "Retry", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(alerts).toHaveCount(0);
    await page.evaluate(() => {
      window.__revenueFault = "empty";
      window.dispatchEvent(new Event("admin:priority-refresh"));
    });
    await expect(page.getByText("No active client contracts yet", { exact: true })).toHaveCount(2);
    await expect(chart).toHaveCount(0);
    await expect(alerts).toHaveCount(0);
    await page.screenshot({ path: `${output}/${width}-empty.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    proof.push({
      width,
      keyboardRetry: true,
      cachedWarning: true,
      emptyDistinct: true,
      clientEditReconciles: true,
      reducedMotion: width === 390,
    });
    await page.evaluate(() => {
      window.__revenueFault = "healthy";
    });
    for (const slug of ["/docs/pipeline/revenue", "/docs/pipeline"]) {
      await page.goto(`${base}${slug}`);
      await page.locator("main h1").waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.screenshot({ path: `${output}/${width}-${slug.replaceAll("/", "_")}.png` });
      if (slug.endsWith("revenue")) {
        await page
          .getByRole("heading", { name: "What to check", exact: true })
          .scrollIntoViewIfNeeded();
        await expect(page.locator("main")).toContainText("Retry");
        await page.screenshot({ path: `${output}/${width}-docs-recovery.png` });
      }
    }
    await page.goto(`${base}/command-center`);
    const reportingAnswer = page
      .locator("summary")
      .filter({ hasText: "What do the Revenue figures measure?" });
    await reportingAnswer.scrollIntoViewIfNeeded();
    await reportingAnswer.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details[open]")).toContainText(
      "Monthly Recurring sums current active client agreements",
    );
    await page.screenshot({ path: `${output}/${width}-product-revenue-faq.png` });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await context.close();
  }
  // Every fictional business derives Revenue from its own saved client records.
  for (const scenario of [
    "northline-roofing",
    "alder-ridge-law",
    "ledgerstone-advisory",
    "hearthline-realty",
    "common-table-network",
    "superdebate",
  ]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", guardRequest);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/demo/command-center/${scenario}/revenue`, { timeout: 60000 });
    await page
      .getByRole("heading", { name: "Active Contracts by Start Month", exact: true })
      .waitFor();
    const data = await page.evaluate(async () => ({
      report: await (await fetch("/api/admin/revenue")).json(),
      clients: (await (await fetch("/api/admin/clients")).json()).clients,
    }));
    assert.equal(
      data.report.totalMRR,
      data.clients
        .filter((row) => row.status === "active")
        .reduce((sum, row) => sum + row.monthly_value, 0),
    );
    assert.equal(data.report.mrrTimeline.at(-1).mrr, data.report.totalMRR);
    proof.push({ scenario, clientTotalsAgree: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(escaped, []);
  await writeFile(`${output}/proof.json`, JSON.stringify({ proof, errors, escaped }, null, 2));
  console.log(
    "PASS: Revenue desktop/mobile totals, demo edit, initial failure, keyboard retry, cached warning, empty state, six scenarios and docs.",
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed())
    await currentPage.screenshot({ path: `${output}/failure.png`, fullPage: true });
  throw error;
} finally {
  await browser.close();
}

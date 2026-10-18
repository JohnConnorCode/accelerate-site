import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3046";
const output = process.env.QA_OUTPUT_DIR || "/tmp/accelerate-billing-workspace";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const errors = [],
  escaped = [],
  results = [];
let active;
let passed = false;
async function clean(page, label) {
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
  const scope = (await page.getByRole("dialog").count()) ? '[role="dialog"]' : "main";
  const issues = (await new AxeBuilder({ page }).include(scope).analyze()).violations;
  assert.deepEqual(
    issues.map((issue) => ({ id: issue.id, nodes: issue.nodes.length })),
    [],
    `${label}: accessibility`,
  );
  await page.screenshot({ path: `${output}/${label}.png` });
}
async function visit(page, path) {
  await page.goto(base + path);
  await page.waitForFunction(() => window.__accelerateAdminDemoRuntime);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
}
try {
  for (const config of [
    { width: 1440, height: 1000, reducedMotion: "no-preference", scenario: "northline-roofing" },
    { width: 390, height: 844, reducedMotion: "no-preference", scenario: "superdebate" },
    { width: 320, height: 844, reducedMotion: "reduce", scenario: "northline-roofing" },
  ]) {
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      reducedMotion: config.reducedMotion,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    active = page;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("favicon"))
        errors.push(message.text());
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const root = `/demo/command-center/${config.scenario}`;
    const label = `${config.scenario}-${config.width}-${config.reducedMotion}`;
    await visit(page, root + "/invoicing");
    const invoices = page.getByRole("list", { name: "Invoice results" });
    await invoices.getByRole("listitem").nth(2).waitFor();
    await clean(page, label + "-invoices");
    const nav = page.getByRole("navigation", { name: "Billing areas" });
    assert.equal(await nav.getByRole("link").count(), 6);
    await page.getByLabel("Status", { exact: true }).selectOption("overdue");
    assert.equal(await invoices.getByRole("listitem").count(), 1);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    const firstEmail = await invoices
      .getByRole("listitem")
      .first()
      .locator("p")
      .filter({ hasText: /@/ })
      .innerText();
    await page.getByRole("searchbox", { name: "Search loaded invoices" }).fill(firstEmail);
    assert.equal(await invoices.getByRole("listitem").count(), 1);
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    const cancel = page.getByRole("button", { name: "Void unpaid invoice", exact: true });
    await cancel.focus();
    await page.keyboard.press("Enter");
    let review = page.getByRole("dialog");
    await review.getByRole("region", { name: "Exact billing operation" }).waitFor();
    await clean(page, label + "-void-review");
    await page.keyboard.press("Escape");
    await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "detached" });
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "Void unpaid invoice",
    );
    assert.ok(
      await cancel.evaluate((node) => node === document.activeElement),
      "Closing review restores its opener",
    );
    await cancel.click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "detached" });
    await page.getByLabel("Status", { exact: true }).selectOption("void");
    await invoices.getByRole("listitem").first().waitFor();
    assert.equal(await invoices.getByRole("listitem").count(), 1);
    await nav.getByRole("link", { name: "Payments & refunds", exact: true }).click();
    await page.getByRole("heading", { name: "Payment activity", exact: true }).waitFor();
    const payments = page.getByRole("list", { name: "Payment results" });
    await payments.getByRole("listitem").nth(2).waitFor();
    await clean(page, label + "-payments");
    assert.ok((await page.locator('[data-payment-metric="captured"]').innerText()).includes("EUR"));
    assert.ok((await page.locator('[data-payment-metric="captured"]').innerText()).includes("USD"));
    await page.getByRole("button", { name: "Refund payment", exact: true }).focus();
    await page.keyboard.press("Enter");
    const refundForm = page.getByRole("dialog", { name: "Refund payment", exact: true });
    await refundForm.getByLabel("Refund amount (USD)", { exact: true }).fill("25.00");
    await page.keyboard.press("Tab");
    assert.ok(
      await refundForm
        .getByLabel("Reason", { exact: true })
        .evaluate((node) => node === document.activeElement),
    );
    await refundForm.getByLabel("Reason", { exact: true }).selectOption("duplicate");
    await refundForm.getByRole("button", { name: "Review refund", exact: true }).focus();
    await page.keyboard.press("Enter");
    review = page.getByRole("dialog");
    await review.getByRole("region", { name: "Exact billing operation" }).waitFor();
    assert.ok((await review.innerText()).includes("$25.00"));
    assert.equal(await review.getByText(/This proposal recorded no payload/).count(), 0);
    await review.getByText("External Action", { exact: true }).waitFor();
    assert.ok(
      await review.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
      "The exact billing review must fit its panel",
    );
    await clean(page, label + "-refund-review");
    await review.getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "detached" });
    await payments
      .getByRole("listitem")
      .filter({ hasText: "ch_demopayment1" })
      .getByText("Partially refunded", { exact: true })
      .waitFor();
    await page.getByRole("heading", { name: "Recent billing actions", exact: true }).waitFor();
    assert.ok((await page.locator("main").innerText()).includes("No provider effect occurred"));
    await page
      .getByRole("heading", { name: "Recent billing actions", exact: true })
      .locator("..")
      .getByRole("button", { name: "Check provider result", exact: true })
      .first()
      .click();
    await page.getByText(/Latest provider check: succeeded/).waitFor();
    await page.getByLabel("Payment status", { exact: true }).selectOption("refunded");
    assert.equal(await payments.getByRole("listitem").count(), 2);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export selected payments", exact: true }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^payments-test-/);
    const saved = `${output}/${label}-payments.csv`;
    await download.saveAs(saved);
    await clean(page, label + "-refunded");
    // Shared navigation and scenario state remain intact across the other money surfaces.
    for (const [name, heading] of [
      ["Subscriptions", "Subscriptions"],
      ["Revenue", "Revenue"],
      ["Collections", "Collections Action Desk"],
    ]) {
      await page
        .getByRole("navigation", { name: "Billing areas" })
        .getByRole("link", { name, exact: true })
        .click();
      await page.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor();
      assert.ok(page.url().includes(root));
      await clean(page, label + "-" + name.toLowerCase());
    }
    await page
      .getByRole("navigation", { name: "Billing areas" })
      .getByRole("link", { name: "Invoices", exact: true })
      .click();
    await page.getByRole("heading", { level: 1, name: "Invoices", exact: true }).waitFor();
    await page.locator("main").getByRole("link", { name: "Create invoice", exact: true }).click();
    const contactSelect = page.getByLabel("CRM customer", { exact: true });
    await contactSelect.locator("option").nth(4).waitFor();
    await contactSelect.selectOption(
      await contactSelect.locator("option").nth(4).getAttribute("value"),
    );
    await page.getByRole("button", { name: "Create billing customer", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("region", { name: "Exact billing operation" })
      .waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "detached" });
    await page
      .getByLabel("Stripe billing customer", { exact: true })
      .locator("option")
      .nth(1)
      .waitFor();
    await clean(page, label + "-customer-created");
    results.push({
      ...config,
      checks:
        "Invoice search/status, exact cancellation review and focus recovery, partial refund/reason/approval/receipt, separate currencies, scoped CSV export, shared billing navigation, accessibility and overflow",
    });
    await context.close();
  }
  // Controlled pagination failures use the actual compiled invoice surface and query cache.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  active = page;
  await visit(page, "/demo/command-center/northline-roofing/invoicing");
  await page.getByRole("list", { name: "Invoice results" }).waitFor();
  await page.evaluate(() => {
    const original = window.fetch;
    window.__billingFixture = { fail: true, reset: false };
    window.fetch = async (input, init) => {
      const url = new URL(String(input), location.origin);
      if (url.pathname !== "/api/admin/invoicing/list") return original(input, init);
      if (url.searchParams.get("starting_after") && window.__billingFixture.fail)
        return Response.json({ error: "Controlled older invoice failure" }, { status: 503 });
      const base = {
        number: "EXAMPLE-1001",
        status: "open",
        currency: "usd",
        amountDue: 10000,
        amountPaid: 0,
        remaining: 10000,
        contactName: "Fictional Customer",
        contactEmail: "billing@customer.example",
        createdAt: "2026-10-18T12:00:00.000Z",
        dueDate: "2026-10-01T12:00:00.000Z",
        hostedInvoiceUrl: null,
        managed: false,
      };
      const first = { ...base, id: "in_control1" };
      const more = Boolean(url.searchParams.get("starting_after"));
      const invoices = window.__billingFixture.reset
        ? [{ ...base, id: "in_replaced", number: "REPLACED-1001" }]
        : more
          ? [first, { ...base, id: "in_control2", number: "EXAMPLE-1002" }]
          : [first];
      return Response.json({
        invoices,
        hasMore: !more && !window.__billingFixture.reset,
        nextCursor: invoices.at(-1).id,
        connection: "fixture:1:test",
        testMode: true,
      });
    };
  });
  await page.getByRole("button", { name: "Refresh invoices", exact: true }).click();
  const list = page.getByRole("list", { name: "Invoice results" });
  await list.getByText("EXAMPLE-1001", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Load more invoices", exact: true }).click();
  await page.getByRole("button", { name: "Retry older invoices", exact: true }).waitFor();
  assert.equal(
    await list.getByRole("listitem").count(),
    1,
    "An older-page failure must retain current invoices",
  );
  await page.evaluate(() => {
    window.__billingFixture.fail = false;
  });
  await page.getByRole("button", { name: "Retry older invoices", exact: true }).click();
  await list.getByText("EXAMPLE-1002", { exact: true }).waitFor();
  assert.equal(
    await list.getByRole("listitem").count(),
    2,
    "Overlapping provider IDs must be deduplicated",
  );
  await page.evaluate(() => {
    window.__billingFixture.reset = true;
  });
  await page.getByRole("button", { name: "Refresh invoices", exact: true }).click();
  await list.getByText("REPLACED-1001", { exact: true }).waitFor();
  assert.equal(
    await list.getByRole("listitem").count(),
    1,
    "Refreshing must discard obsolete cursor pages",
  );
  await clean(page, "mobile-pagination-recovery");
  await context.close();
  assert.deepEqual(errors, [], "Billing journeys must not produce runtime or console errors");
  assert.deepEqual(escaped, [], "Fictional billing may not call live APIs or providers");
  passed = true;
} catch (error) {
  if (active && !active.isClosed())
    await active.screenshot({ path: output + "/failure.png" }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await writeFile(
    output + "/results.json",
    JSON.stringify(
      {
        passed,
        results,
        errors,
        escaped,
        providerEffects:
          "Fictional browser-session actions and controlled pagination only; no live money moved.",
      },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify({ passed, cases: results.length + 1, output }));

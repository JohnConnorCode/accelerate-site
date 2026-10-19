import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3059";
const output =
  process.env.CUSTOMER_WORKFLOW_QA_OUTPUT || "/tmp/accelerate-customer-workflow-context";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [],
  errors = [],
  escaped = [];
let activePage, activeCase;
let passed = false;
const read = (page, path) =>
  page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Read failed: ${response.status}`);
    return response.json();
  }, path);
async function settled(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector(".admin-main");
    return (
      main &&
      main
        .getAnimations({ subtree: true })
        .every(
          (animation) =>
            animation.playState !== "running" ||
            animation.effect?.getTiming().iterations === Infinity,
        )
    );
  });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    "Page overflow",
  );
}
async function capture(page, name) {
  await settled(page);
  await page.locator("main h1").click();
  await page.locator(".admin-main").evaluate((main) => main.scrollTo({ top: 0 }));
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function keyboardLink(page, link) {
  await link.focus();
  await page.keyboard.press("Enter");
}
async function billingCustomer(page, contactId) {
  const choices = await read(page, `/api/admin/invoicing?contactId=${contactId}`);
  const field = page.getByLabel("Stripe billing customer", { exact: true });
  if (!choices.customers.length) {
    await page.getByRole("button", { name: "Create billing customer", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("region", { name: "Exact billing operation" }).waitFor();
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "detached" });
  }
  await field.locator("option").nth(1).waitFor({ state: "attached" });
  const id = await field.locator("option").nth(1).getAttribute("value");
  await field.selectOption(id);
  return id;
}
try {
  for (const scenario of ["ledgerstone-advisory", "alder-ridge-law"]) {
    for (const mobile of [false, true]) {
      activeCase = `${scenario}-${mobile ? "mobile" : "desktop"}`;
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        reducedMotion: mobile ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      activePage = page;
      await page.addInitScript(() => {
        window.__customerWorkflowDocument = Math.random();
      });
      page.on("pageerror", (error) => errors.push(`${activeCase}: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error" && !message.text().includes("favicon"))
          errors.push(`${activeCase}: ${message.text()}`);
      });
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
          escaped.push(url.origin + url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      const root = `${base}/demo/command-center/${scenario}`;
      await page.goto(`${root}/client-onboarding`);
      await page.getByLabel("Won opportunity", { exact: true }).waitFor();
      const workspace = await read(page, "/api/admin/plugins/tasks?pluginId=client-onboarding");
      assert.ok(workspace.records.length >= 2, "Two won sources required for context switching");
      const [source, otherSource] = workspace.records;
      const beforeActions = workspace.actions.length;
      await page.goto(`${root}/pipeline/${source.id}`);
      const actions = page.getByRole("navigation", { name: "Customer workflow", exact: true });
      await actions.waitFor();
      const onboarding = actions.getByRole("link", {
        name: "Create onboarding checklist",
        exact: true,
      });
      const invoice = actions.getByRole("link", { name: "Create invoice", exact: true });
      const onboardingHref = new URL(await onboarding.getAttribute("href"), root);
      const invoiceHref = new URL(await invoice.getAttribute("href"), root);
      assert.equal(onboardingHref.pathname, new URL(`${root}/client-onboarding`).pathname);
      assert.equal(onboardingHref.searchParams.get("opportunityId"), source.id);
      assert.equal(invoiceHref.pathname, new URL(`${root}/invoicing`).pathname);
      const contactId = invoiceHref.searchParams.get("contactId");
      assert.ok(contactId);
      assert.equal(invoiceHref.searchParams.get("view"), "create");
      await capture(page, `${activeCase}-opportunity`);
      await keyboardLink(page, onboarding);
      const sourceSelect = page.getByLabel("Won opportunity", { exact: true });
      await page.waitForFunction(
        (id) => document.querySelector('select[aria-label="Won opportunity"]')?.value === id,
        source.id,
      );
      assert.ok(await page.getByRole("textbox", { name: "Task 1", exact: true }).inputValue());
      assert.equal(
        (await read(page, "/api/admin/plugins/tasks?pluginId=client-onboarding")).actions.length,
        beforeActions,
        "Opening a workflow must not create a proposal",
      );
      await capture(page, `${activeCase}-onboarding`);
      const title = `Review kickoff context ${scenario}`;
      await page.getByRole("textbox", { name: "Task 1", exact: true }).fill(title);
      await page.getByRole("button", { name: "Review workflow", exact: true }).click();
      await page.getByRole("button", { name: "Request approval", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("textbox", { name: "Task 1", exact: true }).inputValue(),
        title,
        "Refetch must preserve edits",
      );
      await sourceSelect.selectOption(otherSource.id);
      assert.equal(
        await page.getByRole("button", { name: "Request approval", exact: true }).count(),
        0,
        "Changed source must invalidate preview",
      );
      const documentId = await page.evaluate(() => window.__customerWorkflowDocument);
      await page.evaluate(
        (href) => window.history.pushState(null, "", href),
        `${root}/client-onboarding?opportunityId=${otherSource.id}`,
      );
      await page.waitForFunction(
        (id) => document.querySelector('select[aria-label="Won opportunity"]')?.value === id,
        otherSource.id,
      );
      assert.equal(
        await page.evaluate(() => window.__customerWorkflowDocument),
        documentId,
        "Query navigation must keep the mounted document",
      );
      await page.evaluate(
        (href) => window.history.pushState(null, "", href),
        `${root}/client-onboarding?opportunityId=00000000-0000-4000-8000-000000000000`,
      );
      await page
        .getByRole("alert")
        .filter({ hasText: "linked opportunity is unavailable" })
        .waitFor();
      assert.equal(await sourceSelect.inputValue(), "");
      assert.equal(
        await page.getByRole("button", { name: "Review workflow", exact: true }).count(),
        0,
      );
      await page.evaluate(
        (href) => window.history.pushState(null, "", href),
        `${root}/client-onboarding?opportunityId=invalid`,
      );
      await keyboardLink(
        page,
        page.getByRole("link", { name: "Choose another source", exact: true }),
      );
      await sourceSelect.waitFor();
      assert.equal(await sourceSelect.inputValue(), "");
      await sourceSelect.selectOption(source.id);
      await page.getByRole("textbox", { name: "Task 1", exact: true }).fill(title);
      await page.getByRole("button", { name: "Review workflow", exact: true }).click();
      await page.getByRole("button", { name: "Request approval", exact: true }).click();
      await page.getByRole("button", { name: "Approve & create tasks", exact: true }).click();
      await page.getByText("Recorded task results", { exact: true }).waitFor();
      const saved = await read(page, "/api/admin/plugins/tasks?pluginId=client-onboarding");
      const completed = saved.actions.find((action) =>
        action.result?.tasks?.some((task) => task.title === title),
      );
      assert.equal(completed?.result.complete, true);
      assert.ok(completed.result.tasks.every((task) => saved.taskStates[task.id] === "pending"));
      await keyboardLink(page, page.getByRole("link", { name: "Open opportunity", exact: true }));
      await actions.waitFor();
      assert.ok(
        (await page.getByText(title, { exact: true }).count()) > 0,
        "Created tasks must be visible on the source record",
      );
      await keyboardLink(page, actions.getByRole("link", { name: "Create invoice", exact: true }));
      const contact = page.getByLabel("CRM customer", { exact: true });
      await page.waitForFunction(
        (id) => document.querySelector('select[aria-label="CRM customer"]')?.value === id,
        contactId,
      );
      const stripeId = await billingCustomer(page, contactId);
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).click();
      assert.equal(
        await contact.inputValue(),
        contactId,
        "Sample lines must preserve the linked customer",
      );
      assert.equal(
        await page.getByLabel("Stripe billing customer", { exact: true }).inputValue(),
        stripeId,
        "Sample lines must preserve the reviewed billing choice",
      );
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.getByRole("button", { name: "Request draft approval", exact: true }).waitFor();
      const choices = await read(page, `/api/admin/invoicing?contactId=${contactId}`);
      const otherContact = choices.contacts.find((item) => item.id !== contactId);
      assert.ok(otherContact);
      await page.evaluate(
        (href) => window.history.pushState(null, "", href),
        `${root}/invoicing?view=create&contactId=${otherContact.id}`,
      );
      await page.waitForFunction(
        (id) => document.querySelector('select[aria-label="CRM customer"]')?.value === id,
        otherContact.id,
      );
      assert.equal(
        await page.getByRole("button", { name: "Request draft approval", exact: true }).count(),
        0,
      );
      await page.goBack();
      await page.waitForFunction(
        (id) => document.querySelector('select[aria-label="CRM customer"]')?.value === id,
        contactId,
      );
      assert.equal(
        await page.getByRole("button", { name: "Request draft approval", exact: true }).count(),
        0,
        "Back must not restore an unreviewed invoice preview",
      );
      await page.getByRole("button", { name: "Use sample invoice", exact: true }).click();
      await billingCustomer(page, contactId);
      await capture(page, `${activeCase}-invoice`);
      await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
      await page.getByRole("button", { name: "Request draft approval", exact: true }).click();
      const draft = page
        .locator("article")
        .filter({ has: page.getByRole("button", { name: "Approve & create draft", exact: true }) });
      const creationId = await draft.getAttribute("data-action-id");
      await draft.getByRole("button", { name: "Approve & create draft", exact: true }).click();
      const receipt = page.locator(`[data-action-id="${creationId}"]`);
      await receipt
        .getByRole("button", { name: "Request sending approval", exact: true })
        .waitFor();
      const invoices = await read(page, `/api/admin/invoicing?contactId=${contactId}`);
      const created = invoices.actions.find((action) => action.id === creationId);
      assert.equal(created.result.complete, true);
      assert.equal(created.payload.contactId, contactId);
      assert.equal(
        created.result.customerEmail,
        choices.contacts.find((item) => item.id === contactId).primary_email,
      );
      assert.equal(
        created.result.delivery,
        "not_requested",
        "Draft approval must not send an invoice",
      );
      await settled(page);
      results.push({
        scenario,
        mobile,
        reducedMotion: mobile,
        sourceId: source.id,
        contactId,
        creationId,
        checks:
          "Exact source/recipient, no opening write, edit retention, source/URL switch invalidation, missing/invalid recovery, keyboard/back navigation, approved fictional tasks and invoice draft, separate send, no overflow",
      });
      await context.close();
    }
  }
  assert.deepEqual(escaped, [], "Protected/provider request escaped the demo");
  assert.deepEqual(errors, [], "Browser errors");
  passed = true;
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        { activeCase, url: activePage.url(), error: String(error), errors, escaped },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
  await writeFile(
    `${output}/receipt.json`,
    JSON.stringify({ passed, results, errors, escaped }, null, 2),
  );
}
console.log(JSON.stringify({ passed, cases: results.length, output }, null, 2));

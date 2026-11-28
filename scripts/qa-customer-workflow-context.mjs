import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3059";
const output =
  process.env.CUSTOMER_WORKFLOW_QA_OUTPUT || "/tmp/accelerate-customer-workflow-context";
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [],
  errors = [],
  escaped = [];
const frames = new Map();
const screenshots = [];
let activePage, activeCase;
let passed = false;
const read = (page, path) =>
  page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Read failed: ${response.status}`);
    return response.json();
  }, path);
async function settled(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
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
  const layout = await page.evaluate(() => {
    const main = document.querySelector(".admin-main");
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      contentWidth: main.clientWidth,
      contentScrollWidth: main.scrollWidth,
    };
  });
  assert.ok(
    layout.documentWidth <= layout.viewportWidth + 1,
    "Page overflow: " + JSON.stringify(layout),
  );
  assert.ok(
    layout.contentScrollWidth <= layout.contentWidth + 1,
    "Content overflow: " + JSON.stringify(layout),
  );
}
async function capture(page, name) {
  await settled(page);
  await page.locator("main h1").click();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.locator(".admin-main").evaluate((main) => main.scrollTo({ top: 0 }));
  const file = `${output}/${name}.png`;
  await page.screenshot({ path: file });
  frames.set(name, {
    file,
    url: page.url(),
    theme: await page.locator("html").getAttribute("data-theme"),
  });
}
async function keyboardLink(page, link) {
  await link.focus();
  await page.keyboard.press("Enter");
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
      await page.addInitScript(
        ({ scenario, paper }) => {
          if (window.top !== window) return;
          window.__customerWorkflowDocument = Math.random();
          if (paper) {
            sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, "light");
            localStorage.setItem(`accelerate:demo-theme:${scenario}`, "light");
          }
        },
        { scenario, paper: scenario === "ledgerstone-advisory" && !mobile },
      );
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
      const title = `Review kickoff context ${activeCase} ${Date.now()}`;
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
      await page
        .getByRole("article")
        .filter({ has: page.getByText(title, { exact: true }) })
        .getByText("Recorded task results", { exact: true })
        .waitFor();
      const saved = await read(page, "/api/admin/plugins/tasks?pluginId=client-onboarding");
      const matching = saved.actions.filter((action) =>
        action.result?.tasks?.some((task) => task.title === title),
      );
      assert.equal(matching.length, 1, "Exactly one action must create the reviewed task");
      const completed = matching[0];
      assert.equal(completed?.result.complete, true);
      assert.ok(completed.result.tasks.every((task) => saved.taskStates[task.id] === "pending"));
      await keyboardLink(page, page.getByRole("link", { name: "Open opportunity", exact: true }));
      await actions.waitFor();
      const relatedWork = page.locator("details").filter({
        has: page.locator("summary").filter({ hasText: "Related work" }),
      });
      if (!(await relatedWork.evaluate((details) => details.open))) {
        await relatedWork.locator("summary").focus();
        await page.keyboard.press("Enter");
      }
      await relatedWork.getByText(title, { exact: true }).waitFor({ timeout: 10000 });
      const sourceRecord = await read(
        page,
        `/api/admin/revenue-os/records/opportunity/${source.id}`,
      );
      assert.ok(
        sourceRecord.record.tasks.some((task) => task.title === title),
        "The source record must contain its approved tasks",
      );
      await relatedWork.scrollIntoViewIfNeeded();
      await settled(page);
      await page.screenshot({ path: `${output}/${activeCase}-related-work.png` });
      const beforeInvoices = await read(page, "/api/admin/invoicing");
      await keyboardLink(page, actions.getByRole("link", { name: "Create invoice", exact: true }));
      await page.getByRole("heading", { name: "Invoice draft", exact: true }).waitFor();
      const contact = page.getByLabel("Saved contact (optional)", { exact: true });
      await page.waitForFunction(
        (id) => document.querySelector("#invoice-field-contact_id")?.value === id,
        contactId,
      );
      assert.equal(
        (await read(page, "/api/admin/invoicing")).invoices.length,
        beforeInvoices.invoices.length,
        "Opening the invoice editor must not create an invoice",
      );
      await page.getByLabel("Invoice description", { exact: true }).fill("Agreed services");
      await page.getByPlaceholder("Service or deliverable").first().fill("Agreed services");
      await page.getByPlaceholder("0.00").first().fill("1500");
      assert.equal(await contact.inputValue(), contactId, "Editing keeps the linked customer");
      await capture(page, `${activeCase}-invoice`);
      await page.getByRole("button", { name: "Save draft", exact: true }).click();
      await page.getByRole("button", { name: "Save changes", exact: true }).waitFor();
      await page.getByRole("button", { name: "Generate payment link", exact: true }).click();
      await page.getByRole("region", { name: "Payment link" }).waitFor();
      const creationId = new URL(page.url()).searchParams.get("invoiceId");
      assert.ok(creationId, "Issuing selects the issued invoice");
      const listing = await read(page, `/api/admin/invoicing?contactId=${contactId}`);
      const created = listing.invoices.find((invoice) => invoice.id === creationId);
      assert.equal(created.contact_id, contactId);
      assert.equal(
        created.contact_email,
        listing.contacts.find((item) => item.id === contactId).primary_email.toLowerCase(),
      );
      assert.equal(created.status, "open", "Issuing opens a payment link; it is not a payment");
      await settled(page);
      results.push({
        scenario,
        mobile,
        reducedMotion: mobile,
        sourceId: source.id,
        contactId,
        creationId,
        checks:
          "Exact source/recipient, no opening write, edit retention, source/URL switch invalidation, missing/invalid recovery, keyboard/back navigation, approved fictional tasks, invoice issued for the linked customer with payment separate, no overflow",
      });
      await context.close();
    }
  }
  assert.deepEqual(escaped, [], "Protected/provider request escaped the demo");
  assert.deepEqual(errors, [], "Browser errors");
  assert.equal(results.length, 4, "All four customer journeys must pass before publishing images");
  const documentationCase = results.find(
    (result) => result.scenario === "ledgerstone-advisory" && !result.mobile,
  );
  assert.ok(documentationCase);
  for (const [state, file] of [
    ["opportunity", "pipeline/customer-handoff-2026-10-20.png"],
    ["onboarding", "plugins/client-onboarding-context-2026-10-20.png"],
    ["invoice", "plugins/invoicing-context-2026-10-20.png"],
  ]) {
    const frame = frames.get(`ledgerstone-advisory-desktop-${state}`);
    assert.ok(frame, `Missing verified customer workflow frame: ${state}`);
    assert.equal(frame.theme, "light", "Documentation frames use Paper");
    const target = path.resolve(`public/images/docs/${file}`);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(frame.file, target);
    const bytes = await readFile(target);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    assert.equal(width, 1440);
    assert.equal(height, 1000);
    screenshots.push({
      file: `/images/docs/${file}`,
      sourceFile: frame.file,
      url: frame.url,
      theme: frame.theme,
      sourceId: documentationCase.sourceId,
      contactId: documentationCase.contactId,
      width,
      height,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
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
    JSON.stringify({ sourceCommit, passed, results, errors, escaped, screenshots }, null, 2),
  );
}
console.log(
  JSON.stringify(
    { passed, cases: results.length, screenshots: screenshots.length, output },
    null,
    2,
  ),
);

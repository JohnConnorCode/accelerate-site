import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
// Run only against qa-business-fixture-server + Next configured for its local
// Supabase URL. This script never creates a production auth session or writes
// production records. Every browser admin request has a controlled response.
const base = "http://localhost:3023",
  output = "/private/tmp/accelerate-business-workflows";
mkdirSync(output, { recursive: true });
const id = "33333333-3333-4333-8333-333333333333",
  contactId = "22222222-2222-4222-8222-222222222222";
const jwt = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: id,
    aud: "authenticated",
    role: "authenticated",
    email: "qa@example.example",
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  "fixture",
]
  .map((v, i) => (i === 2 ? v : Buffer.from(JSON.stringify(v)).toString("base64url")))
  .join(".");
const session = {
  access_token: jwt,
  refresh_token: "controlled-qa-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id,
    email: "qa@example.example",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  },
};
const revision = (brand) => createHash("sha256").update(JSON.stringify(brand)).digest("hex");
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await context.addCookies([
      {
        name: "sb-127-auth-token",
        value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/admin/invoicing") ||
        request.url().includes("/api/admin/plugins/workflow")
      )
        console.log(request.method(), new URL(request.url()).pathname);
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !/422|409|favicon/.test(message.text()))
        errors.push(message.text());
    });
    let brand = {
      version: 1,
      name: "Example Studio",
      logoMark: "ES",
      logoUrl: "",
      accentColor: "#3055d3",
      inkColor: "#172033",
      backgroundColor: "#f4f5f7",
      tagline: "Thoughtful systems. Better business.",
      legalName: "Example Studio LLC",
      businessAddress: "100 Example Street\nChicago, IL",
      supportEmail: "billing@example.com",
      siteUrl: "https://example.com",
      font: "sans",
    };
    let taskStates = {};
    let actions = [],
      taskActions = [],
      previewInput,
      failDraft = true,
      published = false;
    const receipt = {
      invoiceId: "in_fixture",
      status: "draft",
      currency: "usd",
      amountDue: 50000,
      amountPaid: 0,
      amountRemaining: 50000,
      customerEmail: "billing@example.com",
      testMode: true,
      hostedInvoiceUrl: null,
      providerRequestId: "req_fixture",
      delivery: "not_requested",
      complete: true,
    };
    const invoice = {
      number: "INV-0042",
      customerName: "Sample Customer",
      customerEmail: "billing@example.com",
      currency: "usd",
      lines: [{ description: "Business implementation · 2 units", amount: 50000 }],
      total: 50000,
      amountPaid: 0,
      amountRemaining: 50000,
      status: "open",
      dueLabel: "September 18, 2026",
    };
    const enabled = new Set(["stripe-invoicing", "client-onboarding", "meeting-commitments"]);
    await page.route("**/api/admin/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname,
        body = req.method() === "GET" ? {} : req.postDataJSON();
      const json = (value, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
      if (path === "/api/admin/tenant/branding") {
        if (req.method() === "PUT") {
          assert.equal(body.revision, revision(brand));
          brand = body.brand;
        }
        return json({ brand, revision: revision(brand) });
      }
      if (path === "/api/admin/tenant/modules") {
        if (req.method() === "PATCH") {
          if (body.enabled) enabled.add(body.moduleId);
          else enabled.delete(body.moduleId);
        }
        return json({ modules: [...enabled], overrides: {}, moduleSettings: {} });
      }
      if (path === "/api/admin/tenant/providers")
        return json({ providers: [{ provider: "stripe", status: "connected" }] });
      if (path === "/api/admin/invoicing") {
        if (req.method() === "POST") {
          actions.unshift({
            id: "send",
            action_type: "send_stripe_invoice",
            title: "Send invoice",
            description: "Send the reviewed invoice to billing@example.com",
            status: "pending",
            payload: {},
            result: null,
          });
          return json({ action: actions[0] });
        }
        if (url.searchParams.has("actionId"))
          return json({ ...receipt, status: "paid", amountPaid: 50000, amountRemaining: 0 });
        return json({
          testMode: true,
          truncated: false,
          contacts: [
            { id: contactId, full_name: "Sample Customer", primary_email: "billing@example.com" },
          ],
          customers: [{ id: "cus_fixture", name: "Sample Customer", email: "billing@example.com" }],
          actions,
        });
      }
      if (path === "/api/admin/plugins/workflow") {
        if (body.mode === "preview") {
          previewInput = body.input;
          return json({
            pluginId: body.pluginId,
            title: "Reviewed customer workflow",
            summary: "Review the exact business work before approval.",
            actionType:
              body.pluginId === "stripe-invoicing"
                ? "create_stripe_invoice_draft"
                : "create_task_batch",
            payload:
              body.pluginId === "stripe-invoicing" ? { ...body.input, total: 50000 } : body.input,
            digest: "f".repeat(64),
          });
        }
        assert.deepEqual(body.input, previewInput);
        if (body.pluginId === "stripe-invoicing")
          actions.push({
            id: "draft",
            action_type: "create_stripe_invoice_draft",
            title: "Invoice for Sample Customer",
            description: "USD 500.00 for business implementation",
            status: "pending",
            payload: {},
            result: null,
          });
        else
          taskActions.push({
            id: "task-run",
            title: "Client onboarding: Implementation",
            description: "Create reviewed delivery tasks",
            status: "pending",
            payload: body.input,
            result: null,
          });
        return json({ id: "fixture" });
      }
      if (path === "/api/admin/revenue-os/actions") {
        const action = [...actions, ...taskActions].find((action) => action.id === body.id);
        assert.ok(action);
        if (body.decision === "retry") {
          action.status = "pending";
          action.error = null;
          return json({ id: action.id });
        }
        if (body.decision === "reject") {
          action.status = "rejected";
          return json({ id: action.id });
        }
        if (action.id === "draft" && failDraft) {
          failDraft = false;
          action.status = "failed";
          action.error = "Provider unavailable after draft creation. Retry the same operation.";
          action.result = { ...receipt, complete: false };
          return json({ error: action.error }, 422);
        }
        action.status = "executed";
        if (action.id === "draft") action.result = { ...receipt };
        if (action.id === "send") {
          receipt.status = "open";
          action.result = { ...receipt, delivery: "not_sent_test_mode" };
          actions.find((item) => item.id === "draft").result.status = "open";
        }
        if (action.id === "publication") {
          published = true;
          action.result = { pageId: "page-1", complete: true };
        }
        if (action.id === "task-run") {
          action.result = {
            complete: true,
            tasks: action.payload.tasks.map((task, index) => ({ ...task, id: `task-${index}` })),
          };
          taskStates = Object.fromEntries(action.result.tasks.map((task) => [task.id, "pending"]));
        }
        return json(action.result || {});
      }
      if (path === "/api/admin/invoicing/pages") {
        if (req.method() === "GET")
          return json({
            tenantSlug: "accelerate",
            pages: published
              ? [
                  {
                    id: "page-1",
                    token: "a".repeat(43),
                    expiresAt: "2026-12-01T00:00:00Z",
                    revokedAt: null,
                  },
                ]
              : [],
          });
        if (body.mode === "generate")
          return json({
            design: {
              layout: "editorial",
              heading: "Built for your next chapter",
              introduction: "Thank you for partnering with our team.",
              closing: "We appreciate your business.",
            },
          });
        if (body.mode === "preview")
          return json({
            brand,
            document: invoice,
            design: body.design,
            digest: "f".repeat(64),
            testMode: true,
          });
        if (body.mode === "propose") {
          actions.unshift({
            id: "publication",
            action_type: "publish_invoice_page",
            title: "Publish invoice page",
            description: "Publish reviewed design",
            status: "pending",
            payload: {},
            result: null,
          });
          return json({ action: actions[0] });
        }
        if (body.mode === "revoke") {
          published = false;
          return json({ revoked: true });
        }
      }
      if (path === "/api/admin/revenue-os/tasks") {
        taskStates[body.id] = "completed";
        return json({ task: { id: body.id, status: "completed" } });
      }
      if (path === "/api/admin/plugins/tasks")
        return json({
          taskStates,
          records: [{ id: contactId, name: "Implementation", title: "Kickoff" }],
          members: [{ user_id: id, invited_email: "qa@example.example" }],
          currentUserId: id,
          truncated: false,
          actions: taskActions,
        });
      if (path.includes("notifications")) return json({ notifications: [], unreadCount: 0 });
      if (path.includes("preferences")) return json({});
      return json({});
    });
    await page.goto(base + "/admin/branding", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Branding", exact: true }).waitFor({ timeout: 60000 });
    await page.getByLabel("Display name", { exact: true }).fill("Northwind Studio");
    await page.getByLabel("Accent hex", { exact: true }).fill("#8c3ec6");
    await page.route("https://assets.example.com/logo.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="64"><rect width="180" height="64" rx="8" fill="#8c3ec6"/><text x="90" y="42" text-anchor="middle" fill="white" font-size="30" font-family="sans-serif">Northwind</text></svg>',
      }),
    );
    await page
      .getByLabel("Logo image URL", { exact: true })
      .fill("https://assets.example.com/logo.svg");
    await page.waitForFunction(() => {
      const image = document.querySelector('[aria-label="Invoice design preview"] img');
      return image && image.complete && image.naturalWidth > 0;
    });
    await page.getByRole("button", { name: "Remove logo", exact: true }).click();
    await page.getByLabel("Fallback initials", { exact: true }).fill("NS");

    await page.getByRole("button", { name: "Save branding" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save branding" }).isDisabled();
    await page.getByText("Your shared identity for customer documents", { exact: true }).waitFor();
    assert.equal(brand.name, "Northwind Studio");
    await page.getByLabel("Document text hex", { exact: true }).fill("#ffffff");
    assert.equal(await page.getByRole("button", { name: "Save branding" }).isDisabled(), true);
    await page.getByRole("button", { name: "Reset edits" }).click();
    await page.evaluate(() => document.querySelector(".admin-main")?.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const node = document.querySelector('[aria-label="Invoice design preview"] p');
      return node && getComputedStyle(node).color === "rgb(23, 32, 51)";
    });
    await page.screenshot({ path: `${output}/${name}-branding.png`, fullPage: false });

    await page.goto(base + "/admin/invoicing", { waitUntil: "domcontentloaded" });
    await page.getByLabel("CRM customer", { exact: true }).selectOption(contactId);
    await page.getByLabel("Stripe billing customer", { exact: true }).selectOption("cus_fixture");
    await page.getByLabel("Line 1 description", { exact: true }).fill("Business implementation");
    await page.getByLabel("Line 1 quantity", { exact: true }).fill("2");
    await page.getByLabel("Line 1 unit price", { exact: true }).fill("250.00");
    await page.getByRole("button", { name: "Prepare invoice", exact: true }).click();
    await page.getByRole("button", { name: "Request draft approval" }).click();
    await page.getByRole("button", { name: "Approve & create draft" }).click();
    await page.getByText(/Partial operation: inspect this invoice/).waitFor();
    await page.getByRole("button", { name: "Retry same operation for review" }).click();
    await page.getByRole("button", { name: "Approve & create draft" }).click();
    await page.getByRole("button", { name: "Request sending approval" }).click();
    await page.getByRole("button", { name: "Approve & send invoice" }).click();
    await page.getByText("Stripe accepted the test request. No customer email was sent.").waitFor();
    await page.getByRole("button", { name: "Design customer page" }).click();
    await page.getByRole("button", { name: "Draft with AI" }).click();
    await page.getByRole("button", { name: "Preview page", exact: true }).click();
    await page.getByRole("heading", { name: "Built for your next chapter" }).waitFor();

    await page.getByRole("button", { name: "Request publication approval" }).click();
    await page.getByRole("button", { name: "Approve & publish page" }).click();
    await page.getByRole("button", { name: "Refresh published links" }).click();
    await page.getByRole("button", { name: "Revoke", exact: true }).click();
    await page.getByText("Customer access revoked.").waitFor();
    await page.evaluate(() => document.querySelector(".admin-main")?.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${name}-invoicing.png`, fullPage: false });
    await page.goto(base + "/admin/client-onboarding", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Won opportunity", { exact: true }).selectOption(contactId);
    await page.getByRole("button", { name: "Review workflow" }).click();
    await page.getByRole("button", { name: "Request approval", exact: true }).click();
    await page.getByRole("button", { name: "Approve & create tasks" }).click();
    await page.getByText("Recorded task results").waitFor();
    assert.equal(taskActions[0].result.tasks.length, 4);
    await page.getByRole("button", { name: "Mark complete", exact: true }).first().click();
    await page.getByText("Task marked complete.").waitFor();
    assert.equal(taskStates["task-0"], "completed");
    await page.evaluate(() => document.querySelector(".admin-main")?.scrollTo(0, 0));
    await page.screenshot({ path: `${output}/${name}-onboarding.png`, fullPage: false });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.goto(base + "/t/accelerate/invoice/" + "a".repeat(43), {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("heading", { name: "Built for your next chapter" }).waitFor();
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    await page.getByRole("link", { name: "Pay securely with Stripe" }).waitFor();
    await page.screenshot({ path: `${output}/${name}-public-invoice.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      `${name}: brand save/contrast/reset, invoice partial failure/retry/send/design/publication/revocation, assigned onboarding, keyboard, reduced motion, no overflow or console errors passed`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3046";
const output = process.env.LEAD_QA_OUTPUT || "test-results/leads-write-recovery";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${base}/demo/command-center/superdebate/leads`);
    await page.getByRole("checkbox", { name: "Select all leads", exact: true }).waitFor();
    const names = await page.evaluate(async () => {
      const original = window.fetch.bind(window);
      const initial = await (await original("/api/admin/leads")).json();
      const rows = initial.leads;
      window.__leadWriteQA = { captures: [], updates: [], rows, retry: false };
      window.fetch = async (input, options) => {
        const path = typeof input === "string" ? input.split("?")[0] : String(input);
        if (path !== "/api/admin/leads") return original(input, options);
        const state = window.__leadWriteQA;
        if (!options?.method || options.method === "GET")
          return Response.json({ ...initial, leads: state.rows });
        const body = JSON.parse(options.body);
        if (options.method === "POST") {
          state.captures.push(body);
          const lead = {
            id: body.requestId,
            ...body,
            industry: "other",
            lead_status: "new",
            created_at: new Date().toISOString(),
          };
          const complete = state.captures.length > 1;
          if (!state.rows.some((row) => row.id === lead.id)) state.rows.push(lead);
          return Response.json(
            {
              lead,
              status: complete ? "complete" : "partial",
              canonicalLinked: complete,
              error: complete
                ? undefined
                : "Lead saved. Pipeline setup is incomplete. Retry setup to finish saving this lead.",
            },
            { status: complete ? 200 : 207 },
          );
        }
        if (options.method === "PATCH") {
          state.updates.push(body);
          const ids = body.ids || [body.id];
          const outcomes = ids.map((id, index) => {
            const row = state.rows.find((item) => item.id === id);
            const complete = !body.ids || index === 0;
            row.lead_status = body.lead_status;
            row.intake_data = {
              lead_write_receipt: {
                status: complete ? "complete" : "pending",
                intent: { id, lead_status: body.lead_status },
              },
            };
            return {
              id,
              lead: row,
              status: complete ? "complete" : "partial",
              step: complete ? "complete" : "follow_up",
              error: complete
                ? undefined
                : "Lead stage saved. Follow-up setup is incomplete. Retry this update to finish it.",
            };
          });
          if (!body.ids) return Response.json(outcomes[0]);
          return Response.json(
            { updated: 1, partial: outcomes.length - 1, failed: 0, outcomes },
            { status: 207 },
          );
        }
        return original(input, options);
      };
      return rows.slice(0, 2).map((row) => row.contact_name);
    });
    await page.getByRole("button", { name: "New Lead", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Lead", exact: true });
    await dialog.waitFor();
    await dialog.getByLabel("Contact Name *", { exact: true }).fill("Recovery Customer");
    await dialog.getByLabel("Email *", { exact: true }).fill("recovery@example.test");
    await dialog.getByRole("button", { name: "Create Lead", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("alert").waitFor();
    assert.match(await dialog.getByRole("alert").innerText(), /Lead saved; setup needs attention/);
    assert.equal(await dialog.getByLabel("Contact Name *", { exact: true }).isDisabled(), true);
    await dialog.getByRole("button", { name: "Retry setup", exact: true }).waitFor();
    await page.screenshot({ path: `${output}/capture-partial-${width}.png`, fullPage: true });
    await dialog.getByRole("button", { name: "Retry setup", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    const capture = await page.evaluate(() => window.__leadWriteQA.captures);
    assert.equal(capture.length, 2);
    assert.deepEqual(capture[0], capture[1], "Retry must reuse the source ID and original intent");

    for (const name of names)
      await page.getByRole("checkbox", { name: `Select ${name}`, exact: true }).check();
    await page
      .getByLabel("Set status for selected leads", { exact: true })
      .selectOption("contacted");
    await page.getByRole("button", { name: "Apply", exact: true }).focus();
    await page.keyboard.press("Enter");
    const recovery = page.getByRole("region", {
      name: "Lead updates needing attention",
      exact: true,
    });
    await recovery.waitFor();
    assert.equal(
      await page.getByRole("checkbox", { name: `Select ${names[0]}`, exact: true }).isChecked(),
      false,
    );
    assert.equal(
      await page.getByRole("checkbox", { name: `Select ${names[1]}`, exact: true }).isChecked(),
      true,
    );
    assert.match(await recovery.innerText(), /1 lead update needs attention/);
    assert.match(await recovery.innerText(), /Follow-up setup is incomplete/);
    await page.screenshot({ path: `${output}/bulk-partial-${width}.png`, fullPage: true });
    await recovery.getByRole("button", { name: "Retry incomplete updates", exact: true }).focus();
    await page.keyboard.press("Enter");
    await recovery.waitFor({ state: "hidden" });
    const updates = await page.evaluate(() => window.__leadWriteQA.updates);
    assert.equal(updates.length, 2);
    assert.equal(updates[1].id, updates[0].ids[1], "Retry must target only the incomplete lead");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      reducedMotion: true,
      cases: [
        "partial-capture-preserves-form",
        "keyboard-safe-source-retry",
        "bulk-partial-count-and-selection",
        "targeted-recovery",
        "no-console-errors-or-horizontal-overflow",
      ],
      evidenceType: "controlled API outcomes over the real Leads components",
    });
    await context.close();
  }
  await writeFile(
    `${output}/results.json`,
    JSON.stringify({ result: "passed", results }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ result: "passed", output, results }, null, 2));
} finally {
  await browser.close();
}

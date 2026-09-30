import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3098";
const output = "/tmp/accelerate-policy-browser";
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3098"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "",
  browser;
server.stdout.on("data", (v) => {
  serverLog += v;
});
server.stderr.on("data", (v) => {
  serverLog += v;
});
const checks = [];
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      if ((await fetch(base + "/docs/outreach/collections")).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for our server. */
    }
    await delay(500);
  }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ headless: true });
  const scenarios = [
    "northline-roofing",
    "alder-ridge-law",
    "ledgerstone-advisory",
    "hearthline-realty",
    "common-table-network",
    "superdebate",
  ];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    context.setDefaultTimeout(30_000);
    const page = await context.newPage(),
      errors = [],
      escaped = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("**/*", async (route) => {
      if (new URL(route.request().url()).pathname === "/api/demo/agent") {
        const input = route.request().postDataJSON();
        const matches = input.snapshot.collections.filter((c) => input.text.includes(c.name));
        assert.equal(matches.length, 1);
        const c = matches[0];
        const patch = /owner/i.test(input.text)
          ? { ownerEmail: input.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)[0] }
          : { paused: !/resume/i.test(input.text) };
        const preview = await page.evaluate(
          async ({ caseId, patch }) =>
            (
              await (
                await fetch("/api/admin/collections/policy", {
                  method: "POST",
                  body: JSON.stringify({ action: "preview", caseId, patch }),
                })
              ).json()
            ).preview,
          { caseId: c.id, patch },
        );
        const id = crypto.randomUUID();
        const proposal = {
          id,
          tool: "propose_collection_policy",
          action_type: "update_collection_policy",
          title: `Update collection policy: ${c.name}`,
          description: preview.text,
          status: "pending",
          payload: {
            caseId: c.id,
            patch,
            facts: { name: c.name, email: c.email, currency: c.currency },
            preview: { to: "", text: preview.text },
            digest: preview.digest,
          },
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        };
        return route.fulfill({
          json: {
            runId: crypto.randomUUID(),
            text: "The policy proposal is ready for review. Nothing has executed.",
            status: "completed",
            model: "controlled-policy-QA",
            events: [
              {
                type: "proposal_staged",
                proposal: {
                  id,
                  actionType: proposal.action_type,
                  title: proposal.title,
                  impact: "internal_write",
                  entityType: "collection_case",
                  entityId: c.id,
                },
              },
            ],
            proposals: [proposal],
            usage: { inputTokens: 100, outputTokens: 20, durationMs: 20 },
            toolNames: ["preview_collection_policy", "propose_collection_policy"],
          },
        });
      }
      const url = new URL(route.request().url());
      if (url.origin !== base || url.pathname.startsWith("/api/")) {
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const cases = async () =>
      page.evaluate(
        async () => (await (await fetch("/api/admin/collections/workspace")).json()).cases,
      );
    const stage = async (text) =>
      page.evaluate(async (text) => {
        const r = await fetch("/api/admin/revenue-os/ai/stream", {
          method: "POST",
          body: JSON.stringify({ text, clientMessageId: crypto.randomUUID() }),
        });
        if (!r.ok) throw new Error(await r.text());
        return (await r.text())
          .trim()
          .split("\n\n")
          .map((l) => JSON.parse(l.slice(6)))
          .find((e) => e.type === "final").proposedActions[0];
      }, text);
    for (const [index, scenario] of scenarios.entries()) {
      const root = base + "/demo/command-center/" + scenario;
      await page.goto(root + "/collections", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Preview reminder", exact: true }).waitFor();
      const c = (await cases())[0];
      await page.goto(root + "/ai", { waitUntil: "networkidle" });
      const input = page.getByRole("textbox", { name: "Ask the business", exact: true });
      await input.fill(`Set the collection owner for ${c.name} to owner@example.test`);
      await input.press("Enter");
      await page.getByText("Review each exact change below.", { exact: true }).waitFor();
      const queued = (await cases())[0].actions.find(
        (a) => a.action_type === "update_collection_policy" && a.status === "pending",
      );
      assert.ok(queued);
      assert.equal((await cases())[0].ownerEmail, null);
      if (index === 0) {
        await page.screenshot({ path: `${output}/${width}-conversation.png` });
        await page.goto(root + "/work?tab=approvals&action=" + queued.id, {
          waitUntil: "networkidle",
        });
        const dialog = page.getByRole("dialog", { name: queued.title, exact: true });
        await dialog.waitFor();
        assert.match(await dialog.innerText(), /owner@example.test/);
        assert.match(await dialog.innerText(), /Owner: Not set → owner@example.test/);
        assert.match(await dialog.innerText(), /No reminder is sent/);
        assert.doesNotMatch(
          await dialog.innerText(),
          /credentialVersion|REQUESTID|providerAccount|ownerEmail|null|"owner@example.test"/,
        );
        assert.equal(await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1), false);
        await page.screenshot({ path: `${output}/${width}-approval.png` });
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
      }
      await page.goto(root + "/collections", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Reject", exact: true }).press("Enter");
      assert.equal((await cases())[0].ownerEmail, null);
      const approved = await stage(`Set the collection owner for ${c.name} to owner@example.test`);
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText("Review proposed policy", { exact: true }).last().press("Enter");
      assert.equal(
        await page.getByRole("button", { name: "Approve and send", exact: true }).count(),
        0,
      );
      if (index === 0) await page.screenshot({ path: `${output}/${width}-case-review.png` });
      await page.getByRole("button", { name: "Approve policy change", exact: true }).press("Enter");
      await page.waitForFunction(
        async () =>
          (await (await fetch("/api/admin/collections/workspace")).json()).cases[0].ownerEmail ===
          "owner@example.test",
      );
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page.getByLabel("Owner email", { exact: true }).inputValue(),
        "owner@example.test",
      );
      assert.equal((await cases())[0].actions.find((a) => a.id === approved).status, "executed");
      await page.getByRole("button", { name: "Preview reminder", exact: true }).click();
      await page.getByTitle("Branded reminder preview").waitFor();
      const pending = await stage(`Pause collections for ${c.name}`);
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "Simulate payment before approval", exact: true })
        .click();
      await page
        .getByText("Simulated payment recorded. A pending reminder must now be skipped.")
        .waitFor();
      await page.getByRole("button", { name: "Approve policy change", exact: true }).press("Enter");
      await page.getByRole("alert").filter({ hasText: "Policy change skipped" }).waitFor();
      assert.equal((await cases())[0].actions.find((a) => a.id === pending).status, "failed");
      assert.ok((await cases())[0].actions.every((a) => a.result?.state !== "sent"));
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      checks.push(
        `${width} ${scenario}: actual chat → exact review → keyboard rejection/approval → reload → reminder preview → paid-before-approval refusal; no send.`,
      );
      console.log(checks.at(-1));
    }
    for (const path of ["/docs/outreach/collections", "/docs/plugins/receivables-collections"]) {
      await page.goto(base + path, { waitUntil: "networkidle" });
      assert.match(await page.locator("main").innerText(), /policy/i);
      if (path.includes("/outreach/"))
        await page
          .getByRole("heading", { name: "Change a case through Ask AI" })
          .scrollIntoViewIfNeeded();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      await page.screenshot({
        path: `${output}/${width}-${path.includes("/outreach/") ? "guide" : "plugin"}.png`,
      });
    }
    assert.deepEqual(escaped, []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ result: "passed", checks }, null, 2));
  console.log(JSON.stringify({ result: "passed", checks, output }));
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await Promise.race([new Promise((r) => server.on("exit", r)), delay(5000)]);
  await writeFile(`${output}/server.log`, serverLog);
}

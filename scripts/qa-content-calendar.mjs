import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3018";
const output = "/tmp/accelerate-content-calendar";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
let page;
try {
  for (const scenario of [
    "northline-roofing",
    "alder-ridge-law",
    "ledgerstone-advisory",
    "hearthline-realty",
    "common-table-network",
  ])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const errors = [],
        escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // The fictional fetch adapter handles every write before it reaches the
      // browser network. Abort any escaped request rather than contacting a host.
      await page.route("**/api/admin/**", async (route) => {
        if (!["GET", "HEAD"].includes(route.request().method())) {
          escaped.push(route.request().url());
          await route.abort();
        } else await route.continue();
      });
      const root = `${base}/demo/command-center/${scenario}`;
      const request = (path, method = "GET", body) =>
        page.evaluate(
          async ({ path, method, body }) => {
            const response = await fetch(path, {
              method,
              headers: { "Content-Type": "application/json" },
              ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return { status: response.status, data: await response.json() };
          },
          { path, method, body },
        );
      const items = async () => (await request("/api/admin/content")).data.items;
      const propose = async (command, requestKey = randomUUID()) => {
        const preview = await request("/api/admin/content/commands", "POST", {
          action: "preview",
          requestKey,
          command,
        });
        assert.equal(preview.status, 200, JSON.stringify(preview));
        const proposal = await request("/api/admin/content/commands", "POST", {
          action: "propose",
          requestKey,
          command,
          digest: preview.data.digest,
        });
        assert.equal(proposal.status, 200, JSON.stringify(proposal));
        const duplicate = await request("/api/admin/content/commands", "POST", {
          action: "propose",
          requestKey,
          command,
          digest: preview.data.digest,
        });
        assert.equal(duplicate.data.action.id, proposal.data.action.id);
        return proposal.data.action;
      };
      await page.goto(`${root}/content`, { timeout: 60_000 });
      await page.waitForFunction((id) => window.__accelerateAdminDemoRuntime === id, scenario);
      const before = await items();
      const title = `${scenario}: reviewed editorial brief`;
      const add = page.getByRole("button", { name: "New Content", exact: true });
      await add.focus();
      await page.keyboard.press("Enter");
      const editor = page.getByRole("dialog", { name: "New content", exact: true });
      await editor.getByLabel("Title", { exact: true }).fill(title);
      await editor
        .getByLabel("Notes", { exact: true })
        .fill("Confirm the source before publication.");
      await editor
        .getByLabel("SEO Description", { exact: true })
        .fill("A fictional editorial example.");
      await editor.getByRole("button", { name: "Create", exact: true }).click();
      await editor.waitFor({ state: "hidden" });
      const created = (await items()).find((item) => item.title === title);
      assert.ok(created);
      assert.equal((await items()).length, before.length + 1);
      await page.getByRole("button", { name: `Edit ${title}`, exact: true }).click();
      const edit = page.getByRole("dialog", { name: "Edit content", exact: true });
      await edit.getByLabel("Notes", { exact: true }).fill("");
      await edit.getByLabel("SEO Description", { exact: true }).fill("");
      await edit.getByRole("button", { name: "Update", exact: true }).click();
      await edit.waitFor({ state: "hidden" });
      let current = (await items()).find((item) => item.id === created.id);
      assert.equal(current.notes, null);
      assert.equal(current.seo_description, null);
      const stale = await request("/api/admin/content", "PATCH", {
        id: created.id,
        expectedRevision: created.updated_at,
        title: "Stale overwrite",
      });
      assert.equal(stale.status, 409);
      assert.equal((await items()).find((item) => item.id === created.id).title, title);
      const reorderKey = randomUUID();
      const reorder = {
        requestKey: reorderKey,
        reorder: [{ id: current.id, column_key: "draft", sort_order: 1250 }],
        expected: [{ id: current.id, revision: current.updated_at }],
      };
      assert.equal((await request("/api/admin/content", "PATCH", reorder)).status, 200);
      assert.equal(
        (await request("/api/admin/content", "PATCH", reorder)).data.receipt.replayed,
        true,
      );
      current = (await items()).find((item) => item.id === created.id);
      assert.equal(current.status, "draft");
      const invalid = await request("/api/admin/content", "PATCH", {
        requestKey: randomUUID(),
        reorder: [
          { id: current.id, column_key: "review", sort_order: 1500 },
          { id: randomUUID(), column_key: "review", sort_order: 2000 },
        ],
        expected: [{ id: current.id, revision: current.updated_at }],
      });
      assert.equal(invalid.status, 400);
      assert.equal((await items()).find((item) => item.id === current.id).status, "draft");
      const proposal = await propose({
        operation: "reorder",
        updates: [{ id: current.id, column_key: "review", sort_order: 1750 }],
      });
      assert.equal((await items()).find((item) => item.id === current.id).status, "draft");
      await page.goto(`${root}/work?tab=approvals&action=${proposal.id}`, { timeout: 60_000 });
      const review = page.getByRole("dialog", { name: proposal.title, exact: true });
      await review.getByRole("region", { name: "Exact calendar changes" }).waitFor();
      await review.getByText(title, { exact: true }).waitFor();
      await page.keyboard.press("Tab");
      assert.equal(
        await review.evaluate((element) => element.contains(document.activeElement)),
        true,
      );
      await page.screenshot({ path: `${output}/${scenario}-${width}-review.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await review.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: `Review ${proposal.title}`, exact: true }).click();
      await review.getByRole("button", { name: "Approve", exact: true }).click();
      await review.waitFor({ state: "hidden" });
      assert.equal((await items()).find((item) => item.id === current.id).status, "review");
      const handled = await request("/api/admin/revenue-os/actions", "PATCH", {
        id: proposal.id,
        decision: "approve",
      });
      assert.equal(handled.status, 409);
      const denied = await propose({ operation: "delete", id: current.id });
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: denied.id,
            decision: "reject",
          })
        ).status,
        200,
      );
      assert.ok((await items()).find((item) => item.id === current.id));
      const revisedTitle = `${title} (revised)`;
      const pending = await propose({ operation: "delete", id: current.id });
      current = (await items()).find((item) => item.id === created.id);
      assert.equal(
        (
          await request("/api/admin/content", "PATCH", {
            id: current.id,
            expectedRevision: current.updated_at,
            title: revisedTitle,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: pending.id,
            decision: "approve",
          })
        ).status,
        409,
      );
      assert.ok((await items()).find((item) => item.id === current.id));
      const aiId = randomUUID();
      const aiCreate = await propose({
        operation: "create",
        id: aiId,
        values: { title: `${scenario}: next editorial idea` },
      });
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: aiCreate.id,
            decision: "approve",
          })
        ).status,
        200,
      );
      const aiDelete = await propose({ operation: "delete", id: aiId });
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: aiDelete.id,
            decision: "approve",
          })
        ).status,
        200,
      );
      assert.equal(
        (await items()).some((item) => item.id === aiId),
        false,
      );
      await page.goto(`${root}/content`, { timeout: 60_000 });
      await page.getByRole("button", { name: `Edit ${revisedTitle}`, exact: true }).click();
      await edit.getByRole("button", { name: "Delete content item", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Delete content?", exact: true });
      await confirm.getByRole("button", { name: "Delete", exact: true }).click();
      await edit.waitFor({ state: "hidden" });
      await page.reload();
      await add.waitFor();
      assert.equal(
        (await items()).some((item) => item.id === created.id),
        false,
      );
      const deniedReceipt = await request(`/api/admin/revenue-os/actions?id=${denied.id}`);
      const deletedReceipt = await request(`/api/admin/revenue-os/actions?id=${aiDelete.id}`);
      assert.equal(deniedReceipt.data.actions[0].status, "rejected");
      assert.equal(deletedReceipt.data.actions[0].status, "executed");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      await page.screenshot({
        path: `${output}/${scenario}-${width}-calendar.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(escaped, []);
      results.push({
        scenario,
        width,
        create: true,
        explicitClear: true,
        staleRefusal: true,
        atomicReorderRefusal: true,
        approvedCreateReorderDelete: true,
        proposalDedupe: true,
        denied: true,
        changedPreviewRefused: true,
        reload: true,
        keyboardReview: true,
        escapedWrites: escaped.length,
      });
      await context.close();
    }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: five fictional businesses at desktop/mobile; calendar CRUD, explicit clearing, exact human review, refusals, receipts and reload with zero escaped writes.",
  );
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        { message: String(error), url: page.url(), text: await page.locator("body").innerText() },
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
}

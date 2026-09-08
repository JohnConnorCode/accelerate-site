import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3029";
const output = process.env.OPERATOR_QA_OUTPUT ?? "/tmp/accelerate-operator-workspace";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const scenario of ["superdebate", "northline-roofing"]) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      const protectedRequests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/admin")) protectedRequests.push(r.url());
      });
      const go = async (route) => {
        await page.goto(`${base}/demo/command-center/${scenario}/${route}`, {
          waitUntil: "networkidle",
        });
        await page.waitForFunction(() => Boolean(window.__accelerateAdminDemoRuntime));
      };
      const settleInspector = () =>
        page.waitForFunction(() => {
          const node = document.querySelector('[data-admin-overlay="dialog"]');
          return node && Number(getComputedStyle(node).opacity) >= 0.999;
        });
      const request = (path, body) =>
        page.evaluate(
          async ({ path, body }) => {
            const response = await fetch(
              path,
              body
                ? {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  }
                : undefined,
            );
            return { status: response.status, data: await response.json() };
          },
          { path, body },
        );
      await go("today");
      await page.locator("[data-attention-kind=work]").waitFor();
      for (const title of ["Approvals", "Your work", "Watch", "Upcoming"])
        await page.getByRole("heading", { name: title, exact: true }).waitFor();
      const read = await request("/api/admin/tasks?status=pending");
      assert.equal(read.status, 200);
      const task = read.data.tasks.find((t) => t.source === "manual");
      assert.ok(task);
      await go("work");
      await page.getByRole("heading", { name: "Work", exact: true }).waitFor();
      const taskRow = page.locator(`[data-source-type=task][data-source-id="${task.id}"]`);
      await taskRow.getByRole("button").first().click();
      const inspector = page.getByRole("dialog", { name: "Task details" });
      await inspector.waitFor();
      await settleInspector();
      await page.screenshot({ path: `${output}/${scenario}-${width}-task-inspector.png` });
      await inspector.getByLabel("Title", { exact: true }).fill("Reviewed task for shared work");
      await inspector.getByRole("button", { name: "Save changes", exact: true }).click();
      await inspector.waitFor({ state: "hidden" });
      let saved = (await request(`/api/admin/tasks?id=${task.id}`)).data.tasks[0];
      assert.equal(saved.title, "Reviewed task for shared work");
      assert.equal(saved.status, "pending");
      await go("today");
      const attentionTask = page.locator(`[data-source-type=task][data-source-id="${task.id}"]`);
      await attentionTask.getByText(saved.title, { exact: true }).waitFor();
      await attentionTask.getByRole("button", { name: /Snooze/ }).click();
      await attentionTask.waitFor({ state: "hidden" });
      saved = (await request(`/api/admin/tasks?id=${task.id}`)).data.tasks[0];
      assert.equal(saved.status, "snoozed");
      assert.equal(saved.completed_at, null);
      await go("work");
      await page.getByLabel("Task status", { exact: true }).selectOption("snoozed");
      const snoozed = page.locator(`[data-source-type=task][data-source-id="${task.id}"]`);
      await snoozed.getByRole("button", { name: /Complete/ }).click();
      await snoozed.waitFor({ state: "hidden" });
      saved = (await request(`/api/admin/tasks?id=${task.id}`)).data.tasks[0];
      assert.equal(saved.status, "completed");
      assert.equal(
        (await request("/api/admin/revenue-os/tasks", { id: task.id, action: "complete" })).status,
        400,
      );
      await go("today");
      assert.equal(
        await page.locator(`[data-source-type=task][data-source-id="${task.id}"]`).count(),
        0,
      );
      const approval = (await request("/api/admin/revenue-os/actions")).data.actions.find(
        (a) => a.status === "pending",
      );
      assert.ok(approval);
      const approvalRow = page.locator(
        `[data-source-type=approval][data-source-id="${approval.id}"]`,
      );
      assert.equal(await approvalRow.count(), 1, "One approval projection in Today");
      await approvalRow.locator("[data-approval-review]").click();
      let review = page.getByRole("dialog", { name: approval.title, exact: true });
      await review.waitFor();
      await page.keyboard.press("Escape");
      await review.waitFor({ state: "hidden" });
      await go("work?tab=approvals");
      await page
        .locator(`[data-source-type=approval][data-source-id="${approval.id}"]`)
        .getByRole("button")
        .click();
      review = page.getByRole("dialog", { name: approval.title, exact: true });
      await review.waitFor();
      await settleInspector();
      await page.screenshot({ path: `${output}/${scenario}-${width}-approval-inspector.png` });
      await review.getByRole("button", { name: /^Approve/ }).click();
      await review.waitFor({ state: "hidden" });
      await go("today");
      assert.equal(
        await page.locator(`[data-source-type=approval][data-source-id="${approval.id}"]`).count(),
        0,
      );
      const activity = (await request("/api/admin/activity")).data;
      assert.ok(
        JSON.stringify(activity).includes(task.id),
        "Task activity keeps original identity",
      );
      assert.ok(
        JSON.stringify(activity).includes(approval.id),
        "Approval activity keeps original identity",
      );
      for (const route of ["today", "work"]) {
        await go(route);
        await page
          .getByRole("heading", { name: route === "today" ? "Today" : "Work", exact: true })
          .waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
        await page.screenshot({
          path: `${output}/${scenario}-${width}-${route}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(protectedRequests, [], "Fictional writes never reach protected APIs");
      results.push({ scenario, width, result: "passed" });
      await context.close();
    }
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: shared task edits/snooze/completion, exact approval inspector, source-linked activity, desktop/mobile, keyboard Escape and fictional isolation for two businesses.",
  );
} finally {
  await browser.close();
}

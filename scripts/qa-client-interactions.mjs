import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = process.env.QA_CLIENT_OUTPUT || "/tmp/accelerate-client-interactions";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
async function settleRoute(page) {
  await page.locator("[data-admin-route-stage]").evaluate(async (root) => {
    await Promise.all(
      root
        .getAnimations({ subtree: true })
        .filter((animation) => Number.isFinite(animation.effect.getComputedTiming().endTime))
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
async function checkRecovery(width) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: width === 390 ? "reduce" : "no-preference",
  });
  await context.addInitScript(() => {
    window.__clientQA = {
      fail: sessionStorage.getItem("client-recovery-started") ? "" : "client",
      hold: "",
      calls: [],
      release: null,
    };
    sessionStorage.setItem("client-recovery-started", "true");
    let handler = window.fetch;
    Object.defineProperty(window, "fetch", {
      configurable: true,
      set(value) {
        handler = value;
      },
      get() {
        const current = handler;
        return async (input, init) => {
          const url = new URL(input instanceof Request ? input.url : String(input), location.href);
          const method = init?.method || "GET";
          const kind =
            url.pathname === "/api/admin/clients" && method === "PATCH"
              ? "save"
              : url.pathname === "/api/admin/clients" && url.searchParams.has("id")
                ? "client"
                : url.pathname === "/api/admin/contacts/timeline"
                  ? "history"
                  : url.pathname === "/api/admin/tasks" && method === "POST"
                    ? "create"
                    : url.pathname === "/api/admin/tasks" &&
                        url.searchParams.get("related_type") === "client"
                      ? "followups"
                      : "";
          const state = window.__clientQA;
          if (kind) state.calls.push(kind);
          if (kind && state.hold === kind)
            await new Promise((resolve) => {
              state.release = resolve;
            });
          if (kind && state.fail === kind)
            return new Response(JSON.stringify({ error: "Controlled client workspace failure" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          return current(input, init);
        };
      },
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin"))
      errors.push("Protected API escaped demo runtime");
  });
  try {
    await page.goto(`${base}/demo/command-center/northline-roofing/clients/client-0`);
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("heading", { name: /Client not found/i }).count(),
      0,
      "Read failure must not assert a missing record",
    );
    await page.evaluate(() => {
      window.__clientQA.fail = "";
      window.__clientQA.hold = "history";
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Notes", exact: true });
    await notes.waitFor();
    const followups = page.getByRole("region", { name: "Client follow-ups", exact: true });
    const history = page.getByRole("region", { name: "Client activity", exact: true });
    await followups.getByText("No follow-ups yet.", { exact: true }).waitFor();
    await notes.fill("Unsaved draft survives independent reads");
    await page.waitForFunction(() => Boolean(window.__clientQA.release));
    await page.evaluate(() => {
      window.__clientQA.hold = "";
      window.__clientQA.release();
      window.__clientQA.release = null;
    });
    await history.getByRole("link").first().waitFor();
    for (const [kind, region] of [
      ["history", history],
      ["followups", followups],
      ["client", page],
    ]) {
      await page.evaluate((kind) => {
        window.__clientQA.fail = kind;
      }, kind);
      await page.getByRole("button", { name: "Refresh client", exact: true }).click();
      await region.getByText("Showing previously loaded information", { exact: true }).waitFor();
      assert.equal(await notes.inputValue(), "Unsaved draft survives independent reads");
      if (kind === "history")
        assert.ok(await history.getByRole("link").count(), "Failed refresh retains activity");
      await page.evaluate(() => {
        window.__clientQA.fail = "";
      });
      await region.getByRole("button", { name: "Retry", exact: true }).click();
      await region
        .getByText("Showing previously loaded information", { exact: true })
        .waitFor({ state: "hidden" });
    }
    // Populate Work's query cache before creating a follow-up, then return through client navigation.
    await page
      .locator('a[href="/demo/command-center/northline-roofing/work"]:visible')
      .first()
      .click();
    await page.getByRole("textbox", { name: "Search tasks", exact: true }).waitFor();
    await page.goBack();
    await notes.waitFor();
    await notes.fill("Unsaved draft survives independent reads");
    const value = page.getByRole("spinbutton", { name: "Monthly value (MRR)", exact: true });
    const save = page.getByRole("button", { name: "Save Changes", exact: true });
    const before = await page.evaluate(
      () => window.__clientQA.calls.filter((x) => x === "save").length,
    );
    for (const invalid of ["-1", ""]) {
      await value.fill(invalid);
      await save.click();
      assert.equal(await value.evaluate((el) => el.validity.valid), false);
      assert.equal(
        await page.evaluate(() => window.__clientQA.calls.filter((x) => x === "save").length),
        before,
        "Invalid money must not submit",
      );
    }
    await value.fill("1250.25");
    await page.evaluate(() => {
      window.__clientQA.fail = "save";
    });
    await save.click();
    await page
      .getByText("Could not save changes. Your edits are still here; try again.", { exact: true })
      .waitFor();
    assert.equal(await notes.inputValue(), "Unsaved draft survives independent reads");
    await page.evaluate(() => {
      window.__clientQA.fail = "";
      window.__clientQA.hold = "save";
    });
    await save.click();
    await page.waitForFunction(() => Boolean(window.__clientQA.release));
    assert.equal(await notes.isDisabled(), true);
    assert.equal(await value.isDisabled(), true);
    await page.evaluate(() => {
      window.__clientQA.hold = "";
      window.__clientQA.release();
      window.__clientQA.release = null;
    });
    await page.getByText("Client updated", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Add follow-up", exact: true }).click();
    const title = page.getByRole("textbox", { name: "Follow-up title", exact: true });
    const taskTitle = `Recovery follow-up ${width}`;
    await title.fill(taskTitle);
    await page.evaluate(() => {
      window.__clientQA.fail = "create";
    });
    await title.press("Enter");
    await followups
      .getByRole("alert")
      .getByText("Could not add the follow-up. Your draft is still here; try again.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await title.inputValue(), taskTitle);
    await page.evaluate(() => {
      window.__clientQA.fail = "";
      window.__clientQA.hold = "create";
    });
    const creates = await page.evaluate(
      () => window.__clientQA.calls.filter((x) => x === "create").length,
    );
    await title.press("Enter");
    await page.waitForFunction(() => Boolean(window.__clientQA.release));
    assert.equal(await title.isDisabled(), true);
    assert.equal(
      await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled(),
      true,
    );
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => window.__clientQA.calls.filter((x) => x === "create").length),
      creates + 1,
    );
    await page.screenshot({ path: `${output}/followup-pending-${width}.png` });
    await page.evaluate(() => {
      window.__clientQA.hold = "";
      window.__clientQA.release();
      window.__clientQA.release = null;
    });
    await followups.getByRole("link", { name: new RegExp(taskTitle) }).waitFor();
    await history.getByText(taskTitle, { exact: true }).waitFor();
    await page
      .locator('a[href="/demo/command-center/northline-roofing/work"]:visible')
      .first()
      .click();
    await page.getByRole("button", { name: `Open task ${taskTitle}`, exact: true }).waitFor();
    await page.goBack();
    await page.reload();
    await notes.waitFor();
    assert.equal(await value.inputValue(), "1250.25");
    assert.equal(await notes.inputValue(), "Unsaved draft survives independent reads");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await settleRoute(page);
    await page.screenshot({ path: `${output}/recovery-${width}.png`, fullPage: true });
    await followups.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/followups-${width}.png` });
    await history.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/activity-${width}.png` });
    assert.deepEqual(errors, []);
    results.push({
      scenario: "northline-roofing",
      width,
      recovery: "passed",
      runtimeErrors: errors,
    });
  } finally {
    await context.close();
  }
}
try {
  for (const width of [1440, 390]) await checkRecovery(width);
  if (!process.env.QA_CLIENT_RECOVERY_ONLY)
    for (const [scenario, width] of [
      ["northline-roofing", 1440],
      ["northline-roofing", 390],
      ["superdebate", 390],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 390 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/admin"))
          errors.push("Protected API escaped demo runtime");
      });
      await page.goto(`${base}/demo/command-center/${scenario}/clients`);
      await page.locator("[data-client-row]").first().waitFor();
      const clients = await page.evaluate(
        async () => (await (await fetch("/api/admin/clients")).json()).clients,
      );
      const first = clients[0];
      const orphanCheck = await page.evaluate(
        async (email) =>
          (
            await (
              await fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`)
            ).json()
          ).timeline,
        clients.at(-1).contact_email,
      );
      assert.ok(
        orphanCheck.every((item) => !item.link.includes("/pipeline?search=")),
        "Timeline links must resolve exact records",
      );

      await page
        .getByRole("textbox", { name: "Search clients", exact: true })
        .fill("no-such-client-qa");
      await page.getByText("No clients match these filters.", { exact: false }).waitFor();
      await page
        .getByRole("textbox", { name: "Search clients", exact: true })
        .fill(first.business_name);
      await page.waitForFunction(() => document.querySelectorAll("[data-client-row]").length === 1);
      await page.getByRole("textbox", { name: "Search clients", exact: true }).fill("");
      await page.getByRole("combobox", { name: "Filter by status" }).selectOption("active");
      await page.waitForFunction(
        (count) => document.querySelectorAll("[data-client-row]").length === count,
        clients.filter((c) => c.status === "active").length,
      );
      await page.getByRole("button", { name: "Show active clients" }).click();
      assert.equal(
        await page.getByRole("combobox", { name: "Filter by status" }).inputValue(),
        "all",
      );
      await page.getByRole("combobox", { name: "Filter by status" }).selectOption("all");
      await page.waitForFunction(
        (count) => document.querySelectorAll("[data-client-row]").length === count,
        clients.length,
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "Clients should fit the phone viewport",
      );
      await settleRoute(page);
      await page.screenshot({ path: `${output}/${scenario}-${width}-list.png`, fullPage: true });
      // Click a table cell, not just the tiny business-name text.
      await page.locator(`[data-client-row="${first.id}"] td`).nth(3).click();
      await page.getByRole("heading", { name: first.business_name, exact: true }).waitFor();
      const note = `Reviewed delivery plan at ${width}px`;
      await page.getByRole("textbox", { name: "Notes", exact: true }).fill(note);
      await page.getByRole("button", { name: "Save Changes", exact: true }).click();
      await page.getByText("Client updated", { exact: true }).waitFor();
      await page.reload();
      await page.getByRole("textbox", { name: "Notes", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("textbox", { name: "Notes", exact: true }).inputValue(),
        note,
      );
      await page.getByRole("button", { name: "Add follow-up", exact: true }).click();
      const taskTitle = `Confirm ${width}px delivery follow-up`;
      await page.getByRole("textbox", { name: "Follow-up title", exact: true }).fill(taskTitle);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      const taskLink = page
        .getByRole("region", { name: "Client follow-ups", exact: true })
        .getByRole("link", { name: new RegExp(taskTitle) });
      await page
        .getByRole("region", { name: "Client activity", exact: true })
        .getByText(taskTitle, { exact: true })
        .waitFor();
      await taskLink.waitFor();
      await settleRoute(page);
      await page.screenshot({ path: `${output}/${scenario}-${width}-detail.png`, fullPage: true });
      await taskLink.click();
      const inspector = page.getByRole("dialog", { name: "Task details", exact: true });
      await inspector.waitFor();
      assert.equal(
        await inspector.getByRole("textbox", { name: "Title", exact: true }).inputValue(),
        taskTitle,
      );
      await page.reload();
      await page.getByRole("dialog", { name: "Task details", exact: true }).waitFor();
      const stored = await page.evaluate(
        async (id) =>
          (await (await fetch(`/api/admin/tasks?related_type=client&related_id=${id}`)).json())
            .tasks,
        first.id,
      );
      assert.equal(stored.filter((task) => task.title === taskTitle).length, 1);
      const invalid = await page.evaluate(
        async () =>
          (
            await fetch("/api/admin/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "Wrong record",
                related_type: "client",
                related_id: "missing",
                priority: "medium",
              }),
            })
          ).status,
      );
      assert.equal(invalid, 404);
      await page.goto(`${base}/demo/command-center/${scenario}/clients`);
      const keyboardLink = page.getByRole("link", { name: first.business_name, exact: true });
      await keyboardLink.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("heading", { name: first.business_name, exact: true }).waitFor();
      await page
        .getByRole("link", { name: `Open ${first.contact_name}'s contact history`, exact: true })
        .click();
      await page.waitForURL((url) => url.pathname.includes("/contacts/"));
      assert.equal(errors.length, 0, errors.join("\n"));
      results.push({ scenario, width, result: "passed" });
      await context.close();
    }
} finally {
  await browser.close();
}
writeFileSync(`${output}/result.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));

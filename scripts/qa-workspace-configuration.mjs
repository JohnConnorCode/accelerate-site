import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = process.env.QA_OUTPUT || "/tmp/accelerate-workspace-configuration";
mkdirSync(output, { recursive: true });
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const scenario of scenarios)
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const escaped = [],
        errors = [];
      await context.route("**/api/**", (route) => {
        escaped.push(route.request().url());
        return route.abort();
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.goto(`${base}/demo/command-center/${scenario}/work`, { waitUntil: "networkidle" });
      const request = (path, method = "GET", body) =>
        page.evaluate(
          async ({ path, method, body }) => {
            const response = await fetch(path, {
              method,
              ...(body
                ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
                : {}),
            });
            return { status: response.status, data: await response.json() };
          },
          { path, method, body },
        );
      const configuration = async () =>
        (await request("/api/admin/revenue-os/workspace-configuration")).data;
      const folders = async () =>
        (await configuration()).providers.find((p) => p.provider === "google").folderIds;
      const stage = async (folderIds) => {
        const change = { operation: "set_drive_folders", folderIds };
        const preview = await request("/api/admin/revenue-os/workspace-configuration", "POST", {
          action: "preview",
          change,
        });
        assert.equal(preview.status, 200);
        const proposal = await request("/api/admin/revenue-os/workspace-configuration", "POST", {
          action: "propose",
          change,
          digest: preview.data.digest,
        });
        assert.equal(proposal.status, 200);
        return proposal.data;
      };
      const initial = await folders();
      const rejected = await stage(["rejected_folder"]);
      assert.deepEqual(await folders(), initial, "staging must have no effect");
      await page.goto(`${base}/demo/command-center/${scenario}/work?action=${rejected.id}`, {
        waitUntil: "networkidle",
      });
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await dialog.getByRole("button", { name: "Reject", exact: true }).focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      assert.deepEqual(await folders(), initial);
      const approved = await stage(["reviewed_folder", "edited_folder"]);
      await page.goto(`${base}/demo/command-center/${scenario}/work?action=${approved.id}`, {
        waitUntil: "networkidle",
      });
      await dialog.waitFor();
      assert.match(
        await dialog.getByRole("region", { name: "Current configuration" }).innerText(),
        /fictional_selected_folder/,
      );
      assert.match(
        await dialog.getByRole("region", { name: "Exact new configuration" }).innerText(),
        /reviewed_folder[\s\S]*edited_folder/,
      );
      const proposedBounds = await dialog
        .getByRole("region", { name: "Exact new configuration" })
        .boundingBox();
      const approveBounds = await dialog
        .getByRole("button", { name: "Approve", exact: true })
        .boundingBox();
      assert.ok(
        proposedBounds &&
          approveBounds &&
          proposedBounds.y + proposedBounds.height <= approveBounds.y,
        "Every proposed value is visible above the approval footer",
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        "horizontal overflow",
      );
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-approval.png`,
      });
      await dialog.getByRole("button", { name: "Approve", exact: true }).focus();
      await page.keyboard.press("Enter");
      await dialog.waitFor({ state: "hidden" });
      await page.reload({ waitUntil: "networkidle" });
      assert.deepEqual(await folders(), ["reviewed_folder", "edited_folder"]);
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: approved.id,
            decision: "approve",
          })
        ).status,
        409,
        "replay refuses",
      );
      const stale = await stage(["stale_folder"]);
      assert.equal(
        (
          await request("/api/admin/google/sync", "PATCH", {
            driveFolderIds: ["direct_admin_folder"],
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: stale.id,
            decision: "approve",
          })
        ).status,
        409,
      );
      assert.deepEqual(await folders(), ["direct_admin_folder"]);
      const fresh = await stage(["fresh_reviewed_folder"]);
      assert.equal(
        (
          await request("/api/admin/revenue-os/actions", "PATCH", {
            id: fresh.id,
            decision: "approve",
          })
        ).status,
        200,
      );
      assert.deepEqual(await folders(), ["fresh_reviewed_folder"]);
      assert.deepEqual(
        (await request("/api/admin/setup")).data.google.settings.drive_folder_ids,
        ["fresh_reviewed_folder"],
        "Setup uses the saved folder selection",
      );
      assert.equal(
        (await request("/api/admin/settings", "PUT", { key: "NOTIFY_NEW_LEADS", value: "false" }))
          .status,
        200,
      );
      assert.equal(
        (
          await request("/api/admin/settings", "PUT", {
            key: "ADMIN_EMAIL",
            value: "attacker@example.test",
          })
        ).status,
        409,
      );
      await page.goto(`${base}/demo/command-center/${scenario}/settings`, {
        waitUntil: "networkidle",
      });
      await page.getByText("Installation owner email", { exact: true }).waitFor();
      await page.getByText("Installation owner email", { exact: true }).scrollIntoViewIfNeeded();
      assert.equal(await page.locator('input[value="attacker@example.test"]').count(), 0);
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-settings.png`,
      });
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        (await configuration()).preferences.find((p) => p.key === "NOTIFY_NEW_LEADS").value,
        "false",
      );
      assert.equal(
        (
          await request("/api/admin/tenant/providers", "POST", {
            action: "disconnect",
            provider: "resend",
          })
        ).status,
        200,
      );
      assert.equal(
        (await configuration()).providers.find((p) => p.provider === "resend").status,
        "revoked",
      );
      assert.equal(
        (await request("/api/admin/integrations")).data.providers.find((p) => p.id === "resend")
          .status,
        "action",
        "Integrations reports the disconnect",
      );
      assert.equal(
        (await request("/api/admin/setup")).data.summary.launchReady,
        false,
        "Setup cannot claim readiness after disconnect",
      );
      await page.goto(`${base}/demo/command-center/${scenario}/integrations`, {
        waitUntil: "networkidle",
      });
      await page.getByRole("heading", { name: "Integrations", exact: true }).waitFor();
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-integrations.png`,
      });
      assert.equal(
        (await request("/api/admin/google/sync", "PATCH", { driveFolderIds: [] })).status,
        200,
      );
      assert.equal(
        (await request("/api/admin/google/sync", "POST", { source: "all" })).status,
        200,
        "Sync all permits Gmail and Calendar with unconfigured Drive",
      );
      assert.equal(
        (await request("/api/admin/google/sync", "POST", { source: "drive" })).status,
        409,
        "Drive-only sync still requires selected folders",
      );
      await page.goto(`${base}/demo/command-center/${scenario}/setup`, {
        waitUntil: "networkidle",
      });
      const sync = page.getByRole("button", { name: "Sync Workspace", exact: true });
      await sync.waitFor();
      // Simulate a busy job at the existing transport boundary. No provider
      // credentials or live API calls are involved.
      await page.evaluate(() => {
        const original = window.fetch;
        let requests = 0;
        window.fetch = async (input, init) => {
          if (String(input) === "/api/admin/google/sync" && init?.method === "POST")
            return Response.json(
              requests++ === 0
                ? { success: false, skipped: true, existingStatus: "running" }
                : { success: true, skipped: false },
            );
          return original(input, init);
        };
      });
      await sync.focus();
      await page.keyboard.press("Enter");
      await page
        .getByText("Workspace sync is already running; no new sync was started.", { exact: true })
        .waitFor();
      assert.equal(await page.getByText("Workspace sync completed.", { exact: true }).count(), 0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-setup-sync-running.png`,
      });
      await sync.focus();
      await page.keyboard.press("Enter");
      await page.getByText("Workspace sync completed.", { exact: true }).waitFor();
      await page.goto(`${base}/demo/command-center/${scenario}/emails`, {
        waitUntil: "networkidle",
      });
      await page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();
      await page.evaluate(() => {
        const original = window.fetch;
        window.fetch = async (input, init) => {
          const response = await original(input, init);
          if (String(input) === "/api/admin/emails/history" && response.ok)
            return Response.json({ ...(await response.json()), partial: true });
          return response;
        };
      });
      const history = page.getByRole("tab", { name: "Sent history", exact: true });
      await history.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Refresh Email Studio", exact: true }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "Some email history could not be read." })
        .waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.screenshot({
        path: `${output}/${scenario}-${mobile ? "mobile" : "desktop"}-email-history-partial.png`,
      });
      assert.equal(escaped.length, 0, JSON.stringify(escaped));
      assert.equal(errors.length, 0, JSON.stringify(errors));
      results.push({
        scenario,
        viewport: mobile ? "mobile" : "desktop",
        status: "passed",
        keyboard: true,
        rejection: true,
        editReapproval: true,
        stale: true,
        reload: true,
        replay: true,
        optionalDriveSync: true,
        skippedSyncFeedback: true,
        partialHistoryFeedback: true,
        escapedWrites: 0,
        consoleErrors: 0,
        reducedMotion: true,
      });
      await context.close();
    }
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
assert.equal(results.length, 10);
console.log(
  "PASS: all five configuration demos, desktop/mobile shared approvals, keyboard rejection/approval, edited reapproval, stale/replay refusal, reload, server-only owner setting and zero escaped writes.",
);

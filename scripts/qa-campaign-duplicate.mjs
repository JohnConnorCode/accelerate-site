import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3018";
const output = "/tmp/accelerate-campaign-duplicate";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const scenario of ["superdebate", "northline-roofing"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/demo/command-center/${scenario}/campaigns`, { timeout: 60_000 });
      const buttons = page.getByRole("button", { name: "Duplicate", exact: true });
      await buttons.first().waitFor();
      const before = await page.evaluate(
        async () => (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns,
      );
      const source = before[0];
      assert.ok(source);
      // Lose one reply after the demo has persisted the copy. Reload must retain
      // the pending request and reconcile the same copy instead of creating another.
      await page.evaluate(() => {
        const original = window.fetch.bind(window);
        let lost = false;
        window.fetch = async (input, init) => {
          const response = await original(input, init);
          if (
            !lost &&
            init?.method === "PATCH" &&
            typeof init.body === "string" &&
            JSON.parse(init.body).action === "duplicate"
          ) {
            lost = true;
            throw new Error("The copy response was interrupted. Retry to check the same request.");
          }
          return response;
        };
      });
      await buttons.first().focus();
      await page.keyboard.press("Enter");
      await page
        .getByText("The copy response was interrupted. Retry to check the same request.", {
          exact: true,
        })
        .waitFor();
      const interrupted = await page.evaluate(
        async () => (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns,
      );
      assert.equal(interrupted.length, before.length + 1);
      const copy = interrupted[0];
      assert.equal(copy.status, "draft");
      assert.equal(copy.version, 1);
      assert.equal(copy.approved_version, null);
      assert.deepEqual(copy.campaign_members, []);
      assert.deepEqual(copy.policy, source.policy);
      assert.equal(copy.campaign_steps.length, source.campaign_steps.length);
      await page.reload();
      await buttons.nth(1).waitFor();
      await buttons.nth(1).click();
      await page.getByRole("heading", { name: copy.name, exact: true }).last().waitFor();
      const after = await page.evaluate(
        async () => (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns,
      );
      assert.equal(after.length, before.length + 1);
      assert.equal(after[0].id, copy.id);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      await page.screenshot({
        path: `${output}/${scenario}-${width}-duplicate.png`,
        fullPage: true,
      });
      // A confirmed stale refusal creates nothing and releases only that
      // rejected request, allowing an explicit retry against refreshed data.
      await page.evaluate(({ id, version }) => {
        sessionStorage.setItem(
          `accelerate:campaign-copy:${location.pathname}:${id}`,
          JSON.stringify({ requestId: crypto.randomUUID(), expectedVersion: version + 1 }),
        );
      }, source);
      await buttons.nth(1).click();
      await page
        .getByText("Campaign source version changed; review the current source", { exact: true })
        .waitFor();
      const stale = await page.evaluate(
        async (id) => ({
          campaigns: (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns,
          pending: sessionStorage.getItem(`accelerate:campaign-copy:${location.pathname}:${id}`),
        }),
        source.id,
      );
      assert.equal(stale.campaigns.length, before.length + 1);
      assert.equal(stale.pending, null);
      await buttons.nth(1).click();
      await page.waitForFunction(
        async (count) =>
          (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns.length ===
          count,
        before.length + 2,
      );
      assert.deepEqual(errors, []);
      results.push({
        scenario,
        width,
        copySaved: true,
        uncertainReplyReconciled: true,
        staleRequestRecovery: true,
        noRecipients: true,
      });
      await context.close();
    }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: two-business desktop/mobile campaign drafts persist, preserve source fields, omit delivery state, and reconcile a lost response across reload without another copy.",
  );
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3018",
  output = "/tmp/accelerate-leads-bulk";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const scenario of ["superdebate", "northline-roofing"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/demo/command-center/${scenario}/leads`, { timeout: 60000 });
      const all = page.getByRole("checkbox", { name: "Select all leads" });
      await all.waitFor();
      const setup = await page.evaluate(async () => {
        const campaigns = (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns;
        const response = await fetch("/api/admin/revenue-os/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: campaigns[0].id,
            action: "duplicate",
            requestId: crypto.randomUUID(),
            expectedVersion: campaigns[0].version,
          }),
        });
        if (!response.ok) throw new Error("Could not prepare draft");
        const draft = (await response.json()).campaign;
        const leads = (await (await fetch("/api/admin/leads")).json()).leads;
        return { draft, contacts: [...new Set(leads.map((lead) => lead.revenue_os.contact_id))] };
      });
      await all.check();
      await page.getByLabel("Tags to apply, separated by spaces or commas").fill("reviewed");
      await page.getByRole("button", { name: "Tag", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("dialog", { name: "Tags added", exact: true }).waitFor();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.reload();
      await all.waitFor();
      const tagged = await page.evaluate(
        async () => (await (await fetch("/api/admin/leads")).json()).leads,
      );
      assert.ok(tagged.every((lead) => lead.tags.includes("reviewed")));
      await all.check();
      await page.getByRole("button", { name: "Enroll…", exact: true }).click();
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: "Stage enrollment", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Contacts staged for campaign", exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Done", exact: true }).click();
      const staged = await page.evaluate(
        async (id) =>
          (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns.find(
            (c) => c.id === id,
          ),
        setup.draft.id,
      );
      assert.equal(staged.status, "draft");
      assert.equal(staged.campaign_members.length, setup.contacts.length);
      assert.ok(
        staged.campaign_members.every((m) => m.status === "queued" && m.next_send_at === null),
      );
      await all.check();
      await page.getByRole("button", { name: "Suppress", exact: true }).click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await page.getByRole("dialog", { name: "Contacts suppressed", exact: true }).waitFor();
      await page.screenshot({
        path: `${output}/${scenario}-${width}-outcomes.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.reload();
      await all.waitFor();
      const after = await page.evaluate(
        async (id) => ({
          leads: (await (await fetch("/api/admin/leads")).json()).leads,
          campaign: (await (await fetch("/api/admin/revenue-os/campaigns")).json()).campaigns.find(
            (c) => c.id === id,
          ),
        }),
        setup.draft.id,
      );
      assert.ok(after.leads.every((lead) => lead.communication_status === "suppressed"));
      assert.ok(
        after.campaign.campaign_members.every(
          (m) => m.status === "stopped" && m.next_send_at === null,
        ),
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      assert.deepEqual(errors, []);
      results.push({
        scenario,
        width,
        tagsPersisted: true,
        stagingDraftOnly: true,
        suppressionPersisted: true,
      });
      await context.close();
    }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: two-business desktop/mobile bulk tags, enrollment, suppression, per-contact receipts and reload persistence through the shared demo UI.",
  );
} finally {
  await browser.close();
}

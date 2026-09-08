import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3018",
  output = "/tmp/accelerate-delivery-handoff";
await mkdir(output, { recursive: true });
const browser = await chromium.launch(),
  results = [];
let page;
try {
  for (const scenario of ["superdebate", "northline-roofing"])
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/demo/command-center/${scenario}/pipeline`, { timeout: 60000 });
      await page.getByRole("heading", { name: "Pipeline", exact: true }).waitFor();
      const id = await page.evaluate(async () => {
        const x = await (await fetch("/api/admin/revenue-os/pipeline")).json();
        return x.opportunities.find((o) => o.canonical_stage === "won").id;
      });
      await page.goto(`${base}/demo/command-center/${scenario}/pipeline/${id}`, { timeout: 60000 });
      const handoffButton = page.getByRole("button", { name: "Hand off to delivery", exact: true });
      await handoffButton.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Review delivery handoff", exact: true });
      await dialog.getByText("Kickoff call", { exact: true }).waitFor();
      await dialog.evaluate(async (el) => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})),
        );
      });
      await page.keyboard.press("Tab");
      assert.equal(await dialog.evaluate((el) => el.contains(document.activeElement)), true);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await handoffButton.evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press("Enter");
      await dialog.waitFor();
      let reviewedProposal = null;
      if (width === 390) {
        const choice = dialog.getByRole("combobox", { name: "Originating proposal" });
        reviewedProposal = await choice.locator("option").nth(1).getAttribute("value");
        assert.ok(reviewedProposal, "the won opportunity has a versioned proposal to review");
        await choice.selectOption(reviewedProposal);
      }
      await dialog.evaluate(async (el) => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})),
        );
      });
      await page.screenshot({ path: `${output}/${scenario}-${width}-review.png`, fullPage: true });
      await page.evaluate(() => {
        const original = window.fetch;
        let lost = false;
        window.fetch = async (input, init) => {
          const reply = await original(input, init);
          if (
            !lost &&
            String(input).includes("/records/opportunity/") &&
            init?.method === "POST" &&
            reply.ok
          ) {
            lost = true;
            throw new TypeError("Simulated lost handoff response");
          }
          return reply;
        };
      });
      await dialog.getByRole("button", { name: "Confirm handoff", exact: true }).click();
      await dialog
        .getByRole("alert")
        .filter({ hasText: "Simulated lost handoff response" })
        .waitFor();
      await page.reload();
      await page.getByText(/Handoff receipt: default v1/).waitFor();
      const proof = await page.evaluate(async (id) => {
        const path = `/api/admin/revenue-os/records/opportunity/${id}`;
        const before = (await (await fetch(path)).json()).record;
        const replay = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: before.opportunity.updated_at,
            templateKey: "default",
            expectedTemplateVersion: 1,
          }),
        });
        return { before, response: await replay.json(), status: replay.status };
      }, id);
      assert.equal(proof.status, 200);
      assert.equal(proof.response.handoff.replayed, true);
      assert.equal(proof.response.handoff.proposal_id, reviewedProposal);
      assert.equal(proof.response.record.engagement.id, proof.before.engagement.id);
      assert.equal(proof.response.record.engagement.receipt.remainder.length, 0);
      assert.equal(
        new Set(proof.response.record.tasks.map((t) => t.id)).size,
        proof.response.record.tasks.length,
      );
      assert.equal(proof.response.record.tasks.length, proof.before.tasks.length);
      await page.reload();
      await page.getByText(/Handoff receipt: default v1/).waitFor();
      await page.locator("#delivery").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${scenario}-${width}-receipt.png`, fullPage: true });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
      );
      assert.deepEqual(errors, []);
      results.push({
        scenario,
        width,
        reviewVisible: true,
        persistedAfterLostReply: true,
        replaySameEngagement: true,
        duplicateTasks: false,
      });
      await context.close();
    }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: two-business desktop/mobile handoff review, persisted receipts, lost response recovery and replay without duplicate commitments.",
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

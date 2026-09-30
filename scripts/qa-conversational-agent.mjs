import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Use a local fictional QA server",
);
const out = "/tmp/accelerate-conversational-agent";
await mkdir(out, { recursive: true });
const scenarios = [
  "northline-roofing",
  "alder-ridge-law",
  "ledgerstone-advisory",
  "hearthline-realty",
  "common-table-network",
  "superdebate",
];
const checks = [];
const browser = await chromium.launch();
let activePage;
try {
  for (const mobile of [false, true]) {
    for (const scenario of scenarios) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      activePage = page;
      const errors = [],
        escaped = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/admin/")) escaped.push(request.url());
      });
      await context.route("**/api/analytics/events", (route) => route.fulfill({ status: 204 }));
      let issued;
      await context.route("**/api/demo/agent", async (route) => {
        const input = route.request().postDataJSON();
        assert.equal(input.scenarioId, scenario);
        assert.match(input.text, /inquir|follow.up/i);
        assert.ok(input.snapshot.contacts.every((row) => row.email.endsWith(".example")));
        assert.equal(input.snapshot.collections.length, 6);
        const opportunity = input.snapshot.opportunities[0];
        const proposal = {
          id: randomUUID(),
          tool: "propose_task",
          action_type: "create_task",
          title: "Follow up on the inquiry",
          description: "Simulated task; review this exact change",
          status: "pending",
          payload: {
            title: "Follow up on the inquiry",
            priority: "high",
            opportunityId: opportunity.id,
          },
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        };
        issued = proposal;
        await route.fulfill({
          json: {
            runId: randomUUID(),
            text: "The task proposal is ready for your review.",
            status: "completed",
            model: "controlled-browser-model",
            events: [
              {
                type: "proposal_staged",
                proposal: {
                  id: proposal.id,
                  actionType: proposal.action_type,
                  title: proposal.title,
                  impact: "internal_write",
                  entityType: "opportunity",
                  entityId: opportunity.id,
                },
              },
            ],
            proposals: [proposal],
            usage: { inputTokens: 123, outputTokens: 45, durationMs: 42 },
            toolNames: ["propose_task"],
          },
        });
      });
      await page.goto(`${base}/demo/command-center/${scenario}/ai?agent=inquiry`);
      const input = page.getByRole("textbox", { name: "Ask the business" }).first();
      await input.waitFor();
      await page.waitForFunction(() =>
        document
          .querySelector('textarea[aria-label="Ask the business"]')
          ?.value.includes("inquiries"),
      );
      await page.getByRole("button", { name: "Send AI command" }).first().click();
      const review = page.getByRole("button", { name: "Review: Follow up on the inquiry" });
      await review.waitFor();
      // Refresh restores the actual pending proposal from the saved conversation.
      await page.reload();
      await review.waitFor();
      await review.focus();
      await page.keyboard.press("Enter");
      await page.locator('[data-review-decision="approve"]').waitFor();
      assert.ok(await page.getByText("Creates a task on your queue.", { exact: true }).isVisible());
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        "No horizontal overflow",
      );
      await page.screenshot({
        path: `${out}/${scenario}-${mobile ? "mobile" : "desktop"}-review.png`,
        fullPage: true,
      });
      // Only a directly opened exact proposal can accept a typed human decision.
      await input.fill(mobile ? "reject" : "approve");
      await input.press("Control+Enter");
      // The composer also has a visible send control for platforms without a shortcut.
      if (await input.inputValue())
        await page.getByRole("button", { name: "Send AI command" }).first().click();
      await page
        .getByText(
          mobile
            ? /Rejected: Follow up on the inquiry/
            : /Simulated result: Follow up on the inquiry/,
        )
        .waitFor();
      const status = await page.evaluate(
        async (id) =>
          (await (await fetch(`/api/admin/revenue-os/actions?id=${id}`)).json()).actions[0].status,
        issued.id,
      );
      assert.equal(status, mobile ? "rejected" : "executed");
      const replay = await page.evaluate(
        async (id) =>
          (
            await fetch("/api/admin/revenue-os/actions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, decision: "approve" }),
            })
          ).status,
        issued.id,
      );
      assert.equal(replay, 409);
      await page.reload();
      await page.getByText(/Recorded result: Follow up on the inquiry/).waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Review: Follow up on the inquiry" }).count(),
        0,
      );
      assert.deepEqual(escaped, [], "No protected business API request escaped the demo");
      assert.deepEqual(errors, [], "No browser console or page errors");
      checks.push({
        scenario,
        viewport: mobile ? "mobile" : "desktop",
        review: "keyboard",
        decision: mobile ? "reject" : "approve",
        replay: "refused",
        reload: "receipt retained",
        protectedRequests: escaped.length,
      });
      await context.close();
    }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  activePage = page;
  await context.route("**/api/analytics/events", (route) => route.fulfill({ status: 204 }));
  await page.goto(`${base}/demo/command-center`);
  await page.getByRole("heading", { name: "Tell your agent what needs doing." }).waitFor();
  await page.screenshot({ path: `${out}/chooser-desktop.png`, fullPage: true });
  await page.getByRole("link", { name: "Try the AI agent", exact: true }).click();
  await page.getByRole("textbox", { name: "Ask the business" }).waitFor();
  // With no funded inference setup the actual endpoint must refuse, not invent a run.
  await page.getByRole("button", { name: "Send AI command" }).first().click();
  await page
    .getByText(/unavailable|not configured/i)
    .first()
    .waitFor();
  await page.screenshot({ path: `${out}/unavailable-desktop.png`, fullPage: true });
  await context.close();
  await writeFile(
    `${out}/receipt.json`,
    JSON.stringify(
      { status: "passed", model: "controlled UI response; real inference not configured", checks },
      null,
      2,
    ),
  );
  console.log(
    `Conversational browser QA: ${checks.length} business/viewport journeys, exact keyboard review, typed decisions, reload, duplicate refusal, reduced motion, console and protected request isolation passed`,
  );
} catch (error) {
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(
    `${out}/receipt.json`,
    JSON.stringify({ status: "failed", checks, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3043";
const output = process.env.BOARD_QA_OUTPUT || "/tmp/accelerate-command-board";
const desk = `${base}/demo/command-center/mlivm/board`;
await mkdir(output, { recursive: true });
const errors = [];
const results = [];
const ignored = (text) => text.includes("was delivered in report-only mode");
const watch = (page, label) => {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !ignored(message.text()))
      errors.push(`${label}: ${message.text()}`);
  });
};
const ready = (page) =>
  page.locator("[data-canvas-view][data-canvas-ready]").waitFor({ timeout: 30000 });
const node = (page, id) => page.locator(`[data-canvas-node="${id}"]`);

const browser = await chromium.launch();
try {
  // The MLIVM desk opens with both businesses and unspools down to a station.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, "desk");
    await page.goto(desk, { waitUntil: "networkidle" });
    await ready(page);
    await page.getByRole("heading", { name: "Command Board" }).waitFor();
    assert(await node(page, "board:mlivm-llc").isVisible(), "MLIVM LLC anchor is on the desk");
    assert(await node(page, "board:hi-lawn-llc").isVisible(), "HI LAWN LLC anchor is on the desk");
    assert(await node(page, "board:mlivm-llc:execute").isVisible(), "MLIVM pillars are unspooled");
    assert.equal(
      await node(page, "board:mlivm-llc:execute:projects").count(),
      0,
      "Segments wait until a pillar opens",
    );
    await page.screenshot({ path: `${output}/desk-home.png` });

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("scope") === "board:mlivm-llc:execute"),
      node(page, "board:mlivm-llc:execute").click(),
    ]);
    await node(page, "board:mlivm-llc:execute:projects").waitFor();
    await Promise.all([
      page.waitForURL(
        (url) => url.searchParams.get("scope") === "board:mlivm-llc:execute:projects",
      ),
      node(page, "board:mlivm-llc:execute:projects").click(),
    ]);
    const milestones = node(page, "board:mlivm-llc:execute:projects:milestones");
    await milestones.waitFor();
    await page.waitForTimeout(450);
    assert.match(
      await milestones.innerText(),
      /Milestones[\s\S]*\d+ tasks?/,
      "The station summarizes tasks",
    );
    await page.screenshot({ path: `${output}/desk-projects.png` });

    await Promise.all([
      page.waitForURL((url) => url.searchParams.has("station")),
      milestones.click(),
    ]);
    const panel = page.locator(".admin-canvas-panel");
    await panel.waitFor();
    assert.match(await panel.innerText(), /Matching records/);
    const firstRecord = panel.getByRole("link").first();
    assert.match(
      (await firstRecord.getAttribute("href")) ?? "",
      /\/work\?task=/,
      "Records open in their own workspace",
    );
    assert.equal(await milestones.getAttribute("aria-current"), "true");
    await page.screenshot({ path: `${output}/desk-station.png` });
    await page.keyboard.press("Escape");
    await page.waitForURL((url) => !url.searchParams.has("station"));

    await page.goBack({ waitUntil: "networkidle" });
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForURL((url) => url.searchParams.get("scope") === "board:mlivm-llc:execute");
    await page.goForward({ waitUntil: "networkidle" });
    await page.waitForURL(
      (url) => url.searchParams.get("scope") === "board:mlivm-llc:execute:projects",
    );

    await page.goto(
      `${desk}?scope=board:hi-lawn-llc:accounts&station=board:hi-lawn-llc:accounts:invoices`,
      {
        waitUntil: "networkidle",
      },
    );
    await ready(page);
    await panel.waitFor();
    assert.match(
      await panel.innerText(),
      /Invoice Chaser[\s\S]*Ready/,
      "The Invoice Chaser skill is ready",
    );
    await page.screenshot({ path: `${output}/desk-hi-lawn.png` });

    const audit = await new AxeBuilder({ page }).include("[data-canvas-view]").analyze();
    await writeFile(`${output}/axe.json`, JSON.stringify(audit.violations, null, 2));
    assert.deepEqual(
      audit.violations.map((violation) => violation.id),
      [],
      "The board has no axe violations",
    );
    results.push({ check: "desk" });
    await context.close();
  }

  // Approval cards: a station lists proposals as cards that open the exact review,
  // and a card opened after someone decided it shows that decision instead.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    watch(page, "approvals");
    await page.goto(
      `${desk}?scope=board:mlivm-llc:execute:budget-draws&station=board:mlivm-llc:execute:budget-draws:draws`,
      { waitUntil: "networkidle" },
    );
    await ready(page);
    const panel = page.locator(".admin-canvas-panel");
    const card = panel.locator("[data-approval-card]").first();
    await card.waitFor();
    assert.match(
      await card.innerText(),
      /Internal Mutation[\s\S]*Approve lender draw[\s\S]*Moves this opportunity/,
      "The station shows the approval card with its kind and consequence",
    );
    const opener = panel.getByRole("link", { name: /^Review Approve lender draw/ });
    const href = (await opener.getAttribute("href")) ?? "";
    assert.match(href, /\/work\?tab=approvals&action=/, "The card opens the exact review");
    await page.screenshot({ path: `${output}/board-approval-card.png` });
    await Promise.all([page.waitForURL((url) => url.searchParams.has("action")), opener.click()]);
    const dialog = page.getByRole("dialog");
    const approve = dialog.getByRole("button", { name: "Approve", exact: true });
    await approve.waitFor();
    assert.match(await dialog.innerText(), /Material consequence:[\s\S]*Moves this opportunity/);
    await page.screenshot({ path: `${output}/board-approval-review.png` });
    await approve.click();
    await page.waitForURL((url) => !url.searchParams.has("action"));
    await page.goto(new URL(href, base).toString(), { waitUntil: "networkidle" });
    const decided = page.locator('[data-review-state="decided"]');
    await decided.waitFor();
    assert.match(await decided.innerText(), /Approved/, "A decided proposal shows its decision");
    assert.equal(
      await page.locator("[data-review-decision]").count(),
      0,
      "A decided proposal offers no Approve or Reject",
    );
    await page.screenshot({ path: `${output}/board-approval-decided.png` });
    results.push({ check: "approval-cards" });
    await context.close();
  }

  // Phone: the Work approvals list is the approvals feed, one card per proposal.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    watch(page, "feed");
    await page.goto(`${base}/demo/command-center/mlivm/work?tab=approvals`, {
      waitUntil: "networkidle",
    });
    const rows = page.locator("[data-record-row]:has([data-approval-card])");
    await rows.first().waitFor();
    const boxes = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().toJSON()),
    );
    assert(boxes.length >= 3, "The feed lists the pending proposals");
    assert(
      boxes.every(
        (box, index) =>
          box.left >= 0 && box.right <= 390 && (!index || box.top >= boxes[index - 1].bottom),
      ),
      "Cards stack in one column inside the phone viewport",
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      "The feed does not widen the page",
    );
    await page.screenshot({ path: `${output}/approvals-feed-phone.png` });
    await rows.first().locator("button").first().tap();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Approve/ })
      .waitFor();
    await page.screenshot({ path: `${output}/approvals-feed-review.png` });
    results.push({ check: "phone-feed" });
    await context.close();
  }

  // Another workspace starts empty and installs Service Mode through the setup form.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    watch(page, "setup");
    await page.goto(`${base}/demo/command-center/northline-roofing/board`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Set up your first board").waitFor();
    await page.getByLabel("Business name").fill("Northline Roofing");
    await page.getByRole("button", { name: "Set up board" }).click();
    await ready(page);
    assert(await node(page, "board:northline-roofing").isVisible(), "The installed board appears");
    await page.screenshot({ path: `${output}/setup-installed.png` });
    results.push({ check: "setup" });
    await context.close();
  }

  // Disabling the App hides it and refuses its API.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    watch(page, "disable");
    await page.goto(desk, { waitUntil: "networkidle" });
    await ready(page);
    const status = await page.evaluate(async () => {
      await fetch("/api/admin/tenant/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: "command-board", enabled: false }),
      });
      return (await fetch("/api/admin/board")).status;
    });
    assert.equal(status, 403, "A disabled Command Board refuses reads");
    results.push({ check: "disable", status });
    await context.close();
  }

  // Phone: the desk stays readable and pannable.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    watch(page, "phone");
    await page.goto(`${desk}?scope=board:mlivm-llc:execute`, { waitUntil: "networkidle" });
    await ready(page);
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      "The phone layout does not widen the page",
    );
    await page.screenshot({ path: `${output}/desk-phone.png` });
    results.push({ check: "phone" });
    await context.close();
  }

  assert.deepEqual(errors, [], `Console errors: ${errors.join(" | ")}`);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ result: "passed", output, results }));

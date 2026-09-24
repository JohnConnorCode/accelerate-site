import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
const output = process.env.QA_OUTPUT || "/tmp/admin-interaction-standard";
await mkdir(output, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(`${base}/demo/command-center/northline-roofing/today`, {
  waitUntil: "networkidle",
});
await page.getByRole("heading", { name: "Today" }).waitFor();
const todayRow = page.locator('[data-attention-kind] button[aria-label^="Open "]').first();
await todayRow.click();
await page.locator('[data-admin-overlay="dialog"]').waitFor();
assert.match(await page.locator('[data-admin-overlay="dialog"]').innerText(), /Work context/);
await page.keyboard.press("Escape");
await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "hidden" });
assert.match(
  await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""),
  /^Open /,
);
await page.screenshot({ path: `${output}/today-row-detail.png`, fullPage: true });

await page.goto(`${base}/demo/command-center/northline-roofing/work`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Work" }).waitFor();
const recordRow = page.locator("[data-record-row]").first();
assert.ok(await recordRow.count(), "Work page has shared record rows");
await recordRow.getByRole("button").first().click();
await page.locator('[data-admin-overlay="dialog"]').waitFor();
await page.getByRole("button", { name: "Close task" }).click();
await page.locator('[data-admin-overlay="dialog"]').waitFor({ state: "hidden" });

await page.goto(`${base}/demo/command-center/northline-roofing/proposals`, {
  waitUntil: "networkidle",
});
await page.getByRole("heading", { name: "Proposals" }).waitFor();
const proposalRow = page.locator("tr[tabindex='0']").first();
assert.ok(await proposalRow.count(), "Proposal rows are keyboard focusable");
await Promise.all([
  page.waitForURL((url) => url.searchParams.has("proposal")),
  proposalRow.click(),
]);
await page.getByText("Selected proposal").waitFor();
assert.ok(
  await page
    .locator('section[aria-label="Proposal details"]')
    .getByText("Selected proposal")
    .count(),
);
assert.ok(await page.locator("table").isVisible(), "Desktop keeps proposal list beside detail");

await page.goto(`${base}/demo/command-center/northline-roofing/inbox`, {
  waitUntil: "networkidle",
});
await page.getByRole("heading", { name: "Intake review" }).waitFor();
const inboxRow = page.locator("article[tabindex='0']").first();
assert.ok(await inboxRow.count(), "Review queue rows are keyboard focusable");
await Promise.all([
  page.waitForURL((url) => !url.pathname.endsWith("/inbox")),
  inboxRow.locator("h2").click(),
]);
assert.doesNotMatch(page.url(), /\/inbox(?:$|\?)/, "Clicking row content opens its record");
await page.goBack({ waitUntil: "networkidle" });

await page.goto(`${base}/demo/command-center/northline-roofing/pipeline`, {
  waitUntil: "networkidle",
});
await page.getByRole("heading", { name: "Pipeline" }).waitFor();
await page
  .getByRole("group", { name: "Pipeline layout" })
  .getByRole("button", { name: "List" })
  .click();
const pipelineRow = page.locator("tr[data-opportunity-id]").first();
assert.equal(
  await pipelineRow.getAttribute("tabindex"),
  "0",
  "Pipeline rows are keyboard focusable",
);
await pipelineRow.focus();
await Promise.all([
  page.waitForURL((url) => /\/pipeline\/[^/]+$/.test(url.pathname)),
  page.keyboard.press("Enter"),
]);
await page.goBack({ waitUntil: "networkidle" });
const pipelineLink = page.locator('a[href*="/pipeline/"]').first();
await pipelineLink.waitFor();
assert.ok(
  (await pipelineLink.getAttribute("class"))?.includes("w-full"),
  "Pipeline opener spans its cell",
);
assert.doesNotMatch(await page.locator("body").innerText(), /Set next action/);
await page.screenshot({ path: `${output}/pipeline-list.png`, fullPage: true });

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(`${base}/demo/command-center/northline-roofing/inbox`, {
  waitUntil: "networkidle",
});
await Promise.all([
  mobilePage.waitForURL((url) => !url.pathname.endsWith("/inbox")),
  mobilePage.locator("article[tabindex='0']").first().locator("h2").click(),
]);
assert.doesNotMatch(mobilePage.url(), /\/inbox(?:$|\?)/, "Mobile rows use the same opener");
await mobilePage.screenshot({ path: `${output}/inbox-mobile-open.png`, fullPage: true });

await mobilePage.goto(`${base}/demo/command-center/northline-roofing/proposals`, {
  waitUntil: "networkidle",
});
await Promise.all([
  mobilePage.waitForURL((url) => url.searchParams.has("proposal")),
  mobilePage.locator("tr[tabindex='0']").first().click(),
]);
await mobilePage.getByText("Selected proposal").waitFor();
assert.ok(await mobilePage.getByRole("button", { name: "Back to Proposals" }).isVisible());
assert.ok(
  await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  "Mobile proposal detail does not widen the app viewport",
);
await mobilePage.getByRole("button", { name: "Back to Proposals" }).click();
await mobilePage.waitForURL((url) => !url.searchParams.has("proposal"));

assert.deepEqual(errors, [], `Console errors: ${errors.join(" | ")}`);
await mobile.close();
await context.close();
await browser.close();
console.log(`Admin interaction standard passed. Screenshots: ${output}`);

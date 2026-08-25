import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-command-center-demo";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

async function openDemo(viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", colorScheme: "light" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label} console: ${message.text().split("\n")[0]}`); });
  page.on("pageerror", (error) => failures.push(`${label} page: ${error.message.split("\n")[0]}`));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/admin") || pathname === "/api/chat" || pathname.startsWith("/api/cron") || pathname.startsWith("/api/webhooks")) {
      failures.push(`${label}: demo attempted protected/provider request ${pathname}`);
    }
  });
  await page.route("**/api/analytics/events", (route) => route.fulfill({ status: 204, body: "" }));
  await page.goto(`${base}/command-center/demo`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Run a full morning before you connect a single account." }).waitFor();
  await page.getByText("Fictional sample data.", { exact: false }).waitFor();
  // Let session-backed demo state hydrate before changing the selected view.
  await page.getByRole("heading", { name: "6 waiting on you" }).waitFor();
  return { context, page };
}

async function assertNoOverflow(page, label) {
  const state = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  if (state.width > state.viewport + 2) failures.push(`${label}: document overflow ${state.width}px > ${state.viewport}px`);
}

const desktop = await openDemo({ width: 1440, height: 1000 }, "desktop");
await desktop.page.getByRole("button", { name: "Approve", exact: true }).first().click();
await desktop.page.getByRole("heading", { name: "5 waiting on you" }).waitFor();
await desktop.page.getByText("Simulated outcome recorded", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Ask", exact: true }).first().click();
await desktop.page.getByRole("button", { name: "What did I agree to with Northwind?" }).click();
const groundedAnswer = "Three things. A March 3 start date, the reporting piece split out as its own line so Marcus can approve it separately, and a training day in week two rather than week one. Sarah is taking the revised scope to Marcus this week. She has not committed to a number yet.";
await desktop.page.getByText(groundedAnswer, { exact: true }).waitFor();
await desktop.page.getByLabel("Ask the Command Center").fill("What did we promise Northwind?");
await desktop.page.locator("form").getByRole("button", { name: "Ask", exact: true }).click();
await desktop.page.getByText(groundedAnswer, { exact: true }).nth(1).waitFor();
await desktop.page.screenshot({ path: `${outDir}/demo-grounded-answer-desktop.png`, fullPage: true });
await assertNoOverflow(desktop.page, "desktop answer");

await desktop.page.reload({ waitUntil: "domcontentloaded" });
await desktop.page.getByText(groundedAnswer, { exact: true }).first().waitFor();
await desktop.page.getByText(/2 \/ 5 explored/).waitFor();
await desktop.page.getByRole("button", { name: "Reset" }).click();
await desktop.page.getByRole("heading", { name: "6 waiting on you" }).waitFor();
if (await desktop.page.getByText("Simulated outcome recorded", { exact: true }).count()) failures.push("desktop: global reset retained the completed-story outcome");
await desktop.page.getByRole("button", { name: "Ask", exact: true }).first().click();
if (await desktop.page.getByText(groundedAnswer, { exact: true }).count()) failures.push("desktop: global reset retained the prior AI answer");
await desktop.page.screenshot({ path: `${outDir}/demo-reset-desktop.png`, fullPage: true });
await desktop.context.close();

const mobile = await openDemo({ width: 390, height: 844 }, "mobile");
await mobile.page.getByLabel("Demo view", { exact: true }).selectOption("people");
await mobile.page.getByRole("button", { name: /Marcus Reyes/ }).click();
await mobile.page.getByRole("heading", { name: "Marcus Reyes" }).waitFor();
await mobile.page.screenshot({ path: `${outDir}/demo-people-mobile.png`, fullPage: true });
await assertNoOverflow(mobile.page, "mobile people");
await mobile.page.getByLabel("Demo view", { exact: true }).selectOption("meeting");
await mobile.page.getByRole("button", { name: /Apply 5 to the records/ }).click();
await mobile.page.getByText("Filed. Nothing else was touched.", { exact: true }).waitFor();
await mobile.page.screenshot({ path: `${outDir}/demo-meeting-mobile.png`, fullPage: true });
await assertNoOverflow(mobile.page, "mobile meeting");

// Every rail destination must be an inspectable workspace, not a decorative
// navigation item. These views use the shared record inspector rather than a
// bespoke flow, but each still exposes coherent sample data and one local-only
// state change that Reset clears.
const connectedViews = [
  ["inbox", "Stage a reply"],
  ["companies", "Open company context"],
  ["referrals", "Record follow-up"],
  ["projects", "Open delivery plan"],
  ["documents", "Open linked document"],
  ["brief", "Acknowledge brief"],
  ["questions", "Mark for next call"],
  ["reports", "Run simulated report"],
  ["automations", "Review automation"],
  ["integrations", "Inspect connection"],
  ["settings", "Review setting"],
];
for (const [view, action] of connectedViews) {
  await mobile.page.getByLabel("Demo view", { exact: true }).selectOption(view);
  // Wait for the action that belongs to the newly selected view. This is more
  // robust than observing the shared inspector label while AnimatePresence is
  // finishing the previous view's exit animation.
  const actionButton = mobile.page.getByRole("button", { name: action, exact: true });
  await actionButton.waitFor();
  await actionButton.click();
  await mobile.page.getByRole("button", { name: "Saved in this demo", exact: true }).waitFor();
  await assertNoOverflow(mobile.page, `mobile ${view}`);
}
await mobile.page.getByLabel("Demo view", { exact: true }).selectOption("tasks");
await mobile.page.getByRole("heading", { name: "Tasks", exact: true }).waitFor();
await mobile.page.getByRole("button", { name: /Mark Split reporting into its own line reviewed/ }).click();
await mobile.page.getByRole("button", { name: "Reviewed Split reporting into its own line" }).waitFor();
await assertNoOverflow(mobile.page, "mobile tasks");
await mobile.page.getByLabel("Demo view", { exact: true }).selectOption("activity");
await mobile.page.getByText("Every simulated material decision carries a source and receipt.", { exact: true }).waitFor();
await mobile.page.getByRole("button", { name: "Reset" }).click();
await mobile.page.getByLabel("Demo view", { exact: true }).selectOption("inbox");
await mobile.page.getByRole("button", { name: "Stage a reply", exact: true }).waitFor();
await mobile.context.close();

await browser.close();
if (failures.length) throw new Error(`Command Center demo QA failures:\n${failures.join("\n")}`);
console.log(JSON.stringify({ result: "passed", screenshots: [`${outDir}/demo-grounded-answer-desktop.png`, `${outDir}/demo-reset-desktop.png`, `${outDir}/demo-people-mobile.png`, `${outDir}/demo-meeting-mobile.png`], checks: ["fictional-data disclosure", "no protected/provider requests", "simulated approval", "grounded answer variations", "session refresh", "global reset", "all connected workspace views", "receipt activity", "mobile person detail", "meeting extraction", "reduced motion", "overflow", "console"] }, null, 2));

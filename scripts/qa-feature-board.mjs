import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const outDir = "/tmp/accel-shots";
const liveBoard = process.argv.includes("--live");
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated Feature Board QA`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/features` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a QA sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange the QA sign-in token");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieChunks =
  cookieValue.length <= 3180
    ? [{ name: cookieKey, value: cookieValue }]
    : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
        name: `${cookieKey}.${index}`,
        value: cookieValue.slice(index * 3180, (index + 1) * 3180),
      }));

const seed = [
  [
    "Apply and verify the Revenue OS migrations",
    "planned",
    "urgent",
    ["database", "launch"],
    "Run the production migrations in order and confirm every Setup Center schema check.",
    "John",
    "2026-08-18",
  ],
  [
    "Run production admin QA on desktop and mobile",
    "planned",
    "urgent",
    ["qa", "launch"],
    "Verify the critical founder workflows at real breakpoints.",
    "John",
    "2026-08-19",
  ],
  [
    "Complete campaign unsubscribe handling",
    "backlog",
    "urgent",
    ["campaigns", "compliance"],
    "Add durable suppression and operator-visible receipts.",
    null,
    null,
  ],
  [
    "Configure Google OAuth and first sync",
    "backlog",
    "high",
    ["google", "integration"],
    "Connect Gmail, Calendar, and approved Drive folders.",
    null,
    null,
  ],
  [
    "Add Resend delivery webhooks",
    "in_progress",
    "high",
    ["email", "webhooks"],
    "Process delivery signals idempotently and stop on hard failures.",
    "John",
    "2026-08-22",
  ],
  [
    "Calendar confirmation workflow",
    "blocked",
    "medium",
    ["calendar", "ai"],
    "Require approval of exact attendees and meeting time.",
    null,
    null,
  ],
  [
    "Canonical source-to-revenue attribution",
    "shipped",
    "high",
    ["analytics", "revenue"],
    "Reconcile the reporting model against won revenue.",
    "John",
    "2026-08-14",
  ],
].map(([title, status, priority, labels, description, owner, target_date], index) => ({
  id: randomUUID(),
  seed_key: null,
  title,
  description,
  status,
  priority,
  labels,
  sort_order: (index + 1) * 1000,
  owner,
  target_date,
  acceptance_criteria: "The result is verified in production and recorded in the audit history.",
  notes: null,
  source: "qa",
  archived_at: null,
  created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
}));

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];

async function authenticatedContext(viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    deviceScaleFactor: 1,
  });
  const origin = new URL(base);
  await context.addCookies(
    cookieChunks.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  return context;
}

async function mockBoard(page) {
  // Stateful mock: the board persists a drop with PATCH {reorder} and then
  // refetches GET to reconcile. A static mock would serve the original seed
  // on refetch and the UI would truthfully roll the card back, failing the
  // drop assertion for mock reasons rather than product reasons.
  const boardState = new Map(seed.map((feature) => [feature.id, { ...feature }]));
  await page.route("**/api/admin/features**", async (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schemaReady: true, features: [...boardState.values()] }),
      });
    if (request.method() === "PATCH") {
      let updates = [];
      try {
        updates = JSON.parse(request.postData() || "{}").reorder ?? [];
      } catch {
        updates = [];
      }
      for (const update of updates) {
        const row = boardState.get(update.id);
        if (row && typeof update.column_key === "string") {
          row.status = update.column_key;
          if (Number.isFinite(Number(update.sort_order)))
            row.sort_order = Number(update.sort_order);
        }
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, affected: updates.length }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(seed[0]),
    });
  });
}

const desktop = await authenticatedContext({ width: 1440, height: 1000 });
const desktopPage = await desktop.newPage();
desktopPage.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await mockBoard(desktopPage);
if (liveBoard) await desktopPage.unroute("**/api/admin/features**");
await desktopPage.goto(`${base}/admin/features`, { waitUntil: "networkidle", timeout: 60_000 });
await desktopPage.getByRole("heading", { name: "Feature Board", exact: true }).waitFor();
for (const heading of ["Backlog", "Planned", "In progress", "Blocked", "Shipped"])
  await desktopPage.getByRole("heading", { name: heading, exact: true }).waitFor();
await desktopPage.waitForTimeout(650);
const pageTitleState = await desktopPage
  .getByRole("heading", { name: "Feature Board", exact: true })
  .evaluate((node) => ({
    box: node.getBoundingClientRect().toJSON(),
    opacity: getComputedStyle(node).opacity,
    visibility: getComputedStyle(node).visibility,
  }));
if (
  pageTitleState.visibility !== "visible" ||
  Number(pageTitleState.opacity) < 0.99 ||
  pageTitleState.box.bottom <= 0
)
  throw new Error(`Feature Board title did not settle visibly: ${JSON.stringify(pageTitleState)}`);
if (liveBoard) {
  await desktopPage.getByLabel("Filter by milestone").selectOption("milestone:now");
  await desktopPage.getByLabel("Filter by category").selectOption("category:platform");
  await desktopPage
    .getByText("Finish Setup Center as the operational control plane", { exact: true })
    .waitFor();
  await desktopPage.screenshot({
    path: `${outDir}/feature-board-live-desktop.png`,
    fullPage: true,
  });
} else {
  await desktopPage.screenshot({ path: `${outDir}/feature-board-desktop.png`, fullPage: true });
}

if (!liveBoard) {
  const dragHandle = desktopPage.getByRole("button", {
    name: "Drag Complete campaign unsubscribe handling",
  });
  // Drop onto the first card already in Planned: a visible, deterministic
  // target. Dropping at dropzone-bottom math breaks when the column extends
  // past the viewport fold (auto-scroll moves the layout mid-drag).
  const plannedCard = desktopPage
    .locator('section[aria-labelledby="column-planned"]')
    .getByText("Apply and verify the Revenue OS migrations", { exact: true });
  await dragHandle.scrollIntoViewIfNeeded();
  await plannedCard.scrollIntoViewIfNeeded();
  const dragBox = await dragHandle.boundingBox();
  const dropBox = await plannedCard.boundingBox();
  if (!dragBox || !dropBox) throw new Error("Could not locate the drag handle or Planned dropzone");
  await desktopPage.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2);
  await desktopPage.mouse.down();
  await desktopPage.mouse.move(
    dragBox.x + dragBox.width / 2 + 12,
    dragBox.y + dragBox.height / 2 + 2,
    { steps: 4 },
  );
  await desktopPage.waitForTimeout(250);
  await desktopPage.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, {
    steps: 30,
  });
  await desktopPage.waitForTimeout(350);
  await desktopPage.mouse.up();
  await desktopPage
    .locator('section[aria-labelledby]:not([aria-labelledby="column-backlog"])')
    .getByText("Complete campaign unsubscribe handling", { exact: true })
    .waitFor({ timeout: 5_000 });
  if (
    await desktopPage
      .locator('section[aria-labelledby="column-backlog"]')
      .getByText("Complete campaign unsubscribe handling", { exact: true })
      .count()
  )
    throw new Error("Dragged card remained in Backlog");
  await desktopPage.waitForTimeout(320);

  await desktopPage
    .getByRole("button", { name: "Edit Complete campaign unsubscribe handling", exact: true })
    .click();
  await desktopPage.getByRole("heading", { name: "Feature details" }).waitFor();
  await desktopPage.screenshot({ path: `${outDir}/feature-board-details.png`, fullPage: true });
  await desktopPage.getByRole("button", { name: "Close feature details" }).click();
}

// Keyboard-move assertion: dnd-kit KeyboardSensor + sortableKeyboardCoordinates
// should allow picking up a card with Space, moving with Arrow keys, and dropping with Space.
async function waitForLiveText(page, text, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const regions = await page.locator("[aria-live]").allTextContents();
    if (regions.some((region) => region.includes(text))) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

async function testKeyboardMove(page) {
  const backlogCard = page.getByRole("button", {
    name: "Drag Configure Google OAuth and first sync",
  });

  await backlogCard.focus();
  await page.waitForTimeout(100);

  // Space to pick up. dnd-kit announces the pickup into its aria-live
  // region and renders the card a second time inside DragOverlay (which
  // carries no test hook), so the announcement is the pickup proof.
  await page.keyboard.press("Space");
  if (!(await waitForLiveText(page, "Picked up Configure Google OAuth and first sync")))
    throw new Error("Keyboard pickup did not start a drag");

  // Arrow keys move ~25px per press; a real keyboard operator presses
  // repeatedly. Poll the DOM directly: the optimistic preview moves the card
  // node into the target section before drop. (Column announcements stay
  // silent over card targets by design, so the live region can't track this.)
  const keyboardTarget = "Configure Google OAuth and first sync";
  const plannedSection = page.locator('section[aria-labelledby="column-planned"]');
  let arrived = false;
  for (let i = 0; i < 24 && !arrived; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(120);
    arrived = (await plannedSection.getByText(keyboardTarget, { exact: true }).count()) > 0;
  }
  if (!arrived) throw new Error("Keyboard move did not reach the Planned column");

  // Space to drop
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);

  // Verify the card moved to Planned column
  const movedCard = page
    .locator('section[aria-labelledby="column-planned"]')
    .getByText("Configure Google OAuth and first sync", { exact: true });
  await movedCard.waitFor({ timeout: 3000 });

  // Verify it's no longer in Backlog
  const inBacklog = await page
    .locator('section[aria-labelledby="column-backlog"]')
    .getByText("Configure Google OAuth and first sync", { exact: true })
    .count();
  if (inBacklog) throw new Error("Keyboard-moved card remained in Backlog");

  // Unsaved-change confirmation: open edit dialog, change title, try to close with X
  await page
    .getByRole("button", { name: "Edit Configure Google OAuth and first sync", exact: true })
    .click();
  await page.getByRole("heading", { name: "Feature details" }).waitFor();

  const titleInput = page.getByLabel("Title");
  await titleInput.fill("Modified title for unsaved test");
  await page.waitForTimeout(100);

  // Unsaved-change confirmation: open edit dialog, change title, try to close
  // with X. The guard uses a native window.confirm, which Playwright
  // auto-dismisses (Cancel) unless a handler accepts it — so accept it and
  // assert both that it appeared and that the dialog then closed.
  let confirmMessage = null;
  page.on("dialog", async (dialog) => {
    confirmMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Close feature details" }).click();
  await page
    .getByRole("heading", { name: "Feature details" })
    .waitFor({ state: "hidden", timeout: 5000 });
  if (!confirmMessage || !/unsaved|discard/i.test(confirmMessage))
    throw new Error(
      `Unsaved-change confirmation did not trigger (heard: ${JSON.stringify(confirmMessage)})`,
    );
}

if (!liveBoard) {
  await testKeyboardMove(desktopPage);
  await testTouchMove(desktopPage);
  await testListMove(desktopPage);
}

// Touch-drag assertion: the board's single distance-gated PointerSensor
// unifies mouse, pen, and touch, so a real touch pipeline (CDP touch events,
// not a mouse) must drive the same pickup → cross-column move → persisted
// reorder. The grip carries touch-none so the gesture is not stolen by scroll.
async function testTouchMove(page) {
  const grip = page.getByRole("button", {
    name: "Drag Apply and verify the Revenue OS migrations",
  });
  const targetCard = page
    .locator('section[aria-labelledby="column-in_progress"]')
    .getByText("Add Resend delivery webhooks", { exact: true });
  await grip.scrollIntoViewIfNeeded();
  await targetCard.scrollIntoViewIfNeeded();
  const from = await grip.boundingBox();
  const to = await targetCard.boundingBox();
  if (!from || !to) throw new Error("Could not locate the touch drag handle or drop target");

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send(
      "Input.dispatchTouchEvent",
      type === "touchEnd" ? { type, touchPoints: [] } : { type, touchPoints: [{ x, y, id: 1 }] },
    );
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const endX = to.x + to.width / 2;
  const endY = to.y + to.height / 2;
  await touch("touchStart", startX, startY);
  for (let step = 1; step <= 20; step++) {
    await touch(
      "touchMove",
      startX + ((endX - startX) * step) / 20,
      startY + ((endY - startY) * step) / 20,
    );
  }
  await page.waitForTimeout(250);
  await touch("touchEnd");
  await page.waitForTimeout(400);

  const moved = page
    .locator('section[aria-labelledby="column-in_progress"]')
    .getByText("Apply and verify the Revenue OS migrations", { exact: true });
  await moved.waitFor({ timeout: 5000 });
  const leftBehind = await page
    .locator('section[aria-labelledby="column-planned"]')
    .getByText("Apply and verify the Revenue OS migrations", { exact: true })
    .count();
  if (leftBehind) throw new Error("Touch-moved card remained in Planned");
  await cdp.detach().catch(() => null);
}

// List-view move assertion: the non-drag equivalent control (per-row status
// select) drives the same persisted reorder path, which is what makes board
// and mobile/list operation equivalent.
async function testListMove(page) {
  await page.getByRole("button", { name: "List", exact: true }).click();
  const row = page.locator("tr", { hasText: "Calendar confirmation workflow" });
  await row.getByLabel("Move to column").selectOption("shipped");
  // The list has no optimistic local state: the select only reflects the new
  // column after PATCH persists and the refetch reconciles, so a settled
  // shipped value proves persistence, not optimism.
  await page.waitForTimeout(800);
  const value = await row.getByLabel("Move to column").inputValue();
  if (value !== "shipped")
    throw new Error(`List move did not persist (select shows ${JSON.stringify(value)})`);
}

const mobile = await authenticatedContext({ width: 390, height: 844 });
const mobilePage = await mobile.newPage();
mobilePage.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await mockBoard(mobilePage);
if (liveBoard) await mobilePage.unroute("**/api/admin/features**");
await mobilePage.goto(`${base}/admin/features`, { waitUntil: "networkidle", timeout: 60_000 });
await mobilePage.getByRole("heading", { name: "Feature Board", exact: true }).waitFor();
await mobilePage.waitForTimeout(650);
if (liveBoard) {
  await mobilePage.getByLabel("Filter by milestone").selectOption("milestone:now");
  await mobilePage.getByLabel("Filter by category").selectOption("category:platform");
  await mobilePage
    .getByText("Finish Setup Center as the operational control plane", { exact: true })
    .waitFor();
  await mobilePage.screenshot({ path: `${outDir}/feature-board-live-mobile.png`, fullPage: true });
} else {
  await mobilePage.screenshot({ path: `${outDir}/feature-board-mobile.png`, fullPage: true });
}

await desktop.close();
await mobile.close();
await browser.close();

if (consoleErrors.length)
  throw new Error(`Console errors during Feature Board QA:\n${consoleErrors.join("\n")}`);
if (liveBoard) {
  console.log(`${outDir}/feature-board-live-desktop.png`);
  console.log(`${outDir}/feature-board-live-mobile.png`);
  console.log("Live managed Feature Board desktop/mobile render passed without writes.");
} else {
  console.log(`${outDir}/feature-board-desktop.png`);
  console.log(`${outDir}/feature-board-details.png`);
  console.log(`${outDir}/feature-board-mobile.png`);
  console.log(
    "Feature Board desktop/mobile render, drag reorder, keyboard move, touch move, list move, unsaved-change guard, and details interaction passed.",
  );
}

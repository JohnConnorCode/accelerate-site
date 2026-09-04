#!/usr/bin/env node
/**
 * Universal-kanban browser QA: the shared KanbanBoard primitive proven
 * through its two heaviest consumers (Feature Board + Pipeline) with real
 * mouse drags, a real keyboard move, the unsaved-change guard, column
 * management, list-view moves, reload persistence, and a mobile pass —
 * with screenshots, console-error failure, and fixture cleanup.
 *
 * Safety design (inherited from the kanban unification spike):
 * - All writes land in the `isolation-proof-alpha` test tenant via the
 *   `x-tenant-slug` header. Every created opportunity is verified by id to
 *   live in that tenant before anything else touches it (safety abort).
 * - Feature Board columns are platform-global, so the run refuses to start
 *   unless the default labels are exactly intact, and checks again after.
 * - Every fixture row is namespaced QA-DELETE-ME / qa-browser-<run> and
 *   deleted in `finally`, even when assertions fail.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3011 node --env-file=.env.local scripts/qa-kanban-boards.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const TEST_TENANT_SLUG = "isolation-proof-alpha";
const TEST_TENANT_ID = "06a53f21-cd96-47d1-9f89-166c1f00b716";
const RUN_ID = Date.now();
const FEATURE_CARD_TITLE = `QA-DELETE-ME browser drag test card ${RUN_ID}`;
const shotDir = "/tmp/accel-shots";
mkdirSync(shotDir, { recursive: true });
const shot = (name) => `${shotDir}/kanban-${name}.png`;

const DEFAULT_FEATURE_LABELS = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  shipped: "Shipped",
};

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

// Two separate client instances, deliberately: calling auth.verifyOtp() on a
// client mutates its internal auth state away from the service-role key
// toward the newly-verified user's session. Reusing one client for both
// session-minting and service-role DB checks silently turns every later
// "service role" query into an RLS-filtered authenticated query instead —
// which looks exactly like empty/missing data, not an error.
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: linkData, error: linkError } = await authClient.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback` },
});
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("no token");
const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session) throw verifyError || new Error("no session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;

const failures = [];
function check(label, condition, detail) {
  const line = condition ? `  OK   ${label}` : `  FAIL ${label} (${JSON.stringify(detail)})`;
  console.log(line);
  if (!condition) failures.push(label);
}

async function assertDefaultFeatureLabelsIntact(when) {
  const { data, error } = await admin
    .from("kanban_columns")
    .select("column_key,label")
    .eq("board_key", "features")
    .is("tenant_id", null);
  if (error) throw error;
  const byKey = Object.fromEntries((data ?? []).map((r) => [r.column_key, r.label]));
  const mismatches = Object.entries(DEFAULT_FEATURE_LABELS).filter(([key, label]) => byKey[key] !== label);
  if (mismatches.length) {
    throw new Error(
      `${when}: real Feature Board column labels are not as expected — ${JSON.stringify(mismatches)}. Refusing to proceed against corrupted state.`,
    );
  }
  console.log(`  [preflight/postflight] default Feature Board labels intact (${when})`);
}

await assertDefaultFeatureLabelsIntact("preflight");

const browser = await chromium.launch();
const consoleErrors = [];
// Background-poll races (aborted fetches on navigation) and dev-HMR noise
// are not product failures; a real outage also fails the functional checks
// above, so filtering these keeps the console gate signal-bearing.
const BENIGN_CONSOLE_PATTERNS = [
  /failed to fetch/i,
  /websocket is already in closing/i,
  /hmr/i,
  /fast refresh/i,
  /react devtools/i,
  // A 409 is the designed contention answer (stale reorder claim, concurrent
  // stage write): the route returns it truthfully and the board rolls back
  // with a toast. scripts/qa-pipeline-workspace.mjs filters the same text;
  // the persistence/rollback checks above are what prove the behavior.
  /status of 409/i,
];
function watch(page, dialogs) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(msg.text()))) return;
    consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(String(err)))) return;
    consoleErrors.push(String(err));
  });
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    console.log(`  [dialog:${dialog.type()}] ${message}`);
    await dialogs(message, dialog);
  });
}

async function newContext(viewport, { reducedMotion = false } = {}) {
  const context = await browser.newContext({
    baseURL: base,
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  const origin = new URL(base);
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  // requireAdmin() reads `x-tenant-slug` before the cookie fallback — the
  // header is what keeps test opportunities in the test tenant instead of
  // the real Accelerate one.
  await context.setExtraHTTPHeaders({ "x-tenant-slug": TEST_TENANT_SLUG });
  // External analytics only; never part of the journey under test.
  await context.route("**/js/script.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  return context;
}

/** Drop target inside a column that is always small and precisely placed:
 * the last card when the column is populated, otherwise the empty-hint
 * text. Targeting the whole <section> produced garbage coordinates on
 * wide boards because scrollIntoView centers a huge rect. */
async function resolveDropTarget(columnSection) {
  if ((await columnSection.locator("article").count()) > 0) return columnSection.locator("article").last();
  return columnSection.getByText(/no opportunities in this stage|drop a card here|drop content here/i);
}

async function dragCard(page, fromLocator, toLocator) {
  // Real boards can have dozens of real cards, so the source/target may not
  // both fit on screen at once: scroll to the source, start the drag, THEN
  // bring the target into view before releasing — mirrors what a real user
  // has to do on a long board, and avoids grabbing stale coordinates.
  await fromLocator.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const from = await fromLocator.first().boundingBox();
  if (!from) throw new Error("drag source not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2 + 15, { steps: 5 });
  await page.waitForTimeout(100);

  // Park the pointer mid-viewport while the target scrolls into view: a
  // pointer near a viewport edge is exactly what triggers dnd-kit's OWN
  // autoScroll, and that fought manual scrolling and landed drops a column
  // past the intended one. One scroll actor, not two.
  const neutralX = Math.min(Math.max(from.x + from.width / 2, 200), 1200);
  const neutralY = Math.min(Math.max(from.y, 200), 700);
  await page.mouse.move(neutralX, neutralY, { steps: 3 });
  await toLocator.first().evaluate((el) => el.scrollIntoView({ inline: "center", block: "nearest" }));
  await page.waitForTimeout(300);
  const to = await toLocator.first().boundingBox();
  if (!to) throw new Error("drag target not visible after scrolling");
  const targetX = to.x + to.width / 2;
  const targetY = to.y + to.height / 2;
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.waitForTimeout(400);
  // Re-read the target and correct: the board may have auto-scrolled under
  // a settled pointer during the wait above (dnd-kit's own autoScroll), so
  // releasing on the first reading can land one column over. The second
  // reading is taken with the pointer already parked, so no new scroll is
  // in flight to invalidate it.
  const toCorrected = await toLocator.first().boundingBox();
  if (!toCorrected) throw new Error("drag target lost before release");
  await page.mouse.move(toCorrected.x + toCorrected.width / 2, toCorrected.y + toCorrected.height / 2, { steps: 5 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

async function clearFeaturesMilestoneFilter(page) {
  const milestoneSelect = page.locator('select[aria-label="Filter by milestone"]');
  if (await milestoneSelect.count()) await milestoneSelect.selectOption("all");
  await page.waitForTimeout(300);
}

const columnSection = (page, name) => page.locator("section", { has: page.locator("h2", { hasText: name }) });

/** The commit path (veto -> reorder PATCH -> refetch) resolves
 * asynchronously after mouse.up. Waiting for the PATCH response first makes
 * the follow-up DOM poll fast on green runs (a fixed long poll is only
 * cheap when it passes immediately); the DOM poll remains the real
 * assertion. Resolves null when no commit fires (a genuine failure the
 * DOM check will then report). */
async function waitForCommit(page, urlFragment, timeout = 60000) {
  try {
    await page.waitForResponse(
      (res) => res.url().includes(urlFragment) && res.request().method() === "PATCH",
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

/** The commit path (veto -> reorder POST -> refetch) resolves
 * asynchronously after mouse.up, so poll for the card instead of asserting
 * a fixed sleep — a fixed sleep flakes between fast and slow runs. */
async function waitForCardIn(columnSectionLocator, title, timeout = 30000) {
  try {
    await columnSectionLocator.locator("article", { hasText: title }).first().waitFor({ timeout });
    return true;
  } catch {
    return false;
  }
}
const createdOpportunityIds = [];
let discardGuardSawConfirm = false;
// The Escape probe must DISMISS the guard (dialog stays open); the Cancel
// probe must ACCEPT it (dialog closes). One flag, set just before Cancel.
let acceptDiscardGuard = false;

async function defaultDialogRouter(message, dialog) {
  if (message.includes("Why was this opportunity lost?")) {
    await dialog.accept("QA browser test — no real signal");
  } else if (message.includes("Discard unsaved changes")) {
    discardGuardSawConfirm = true;
    if (acceptDiscardGuard) await dialog.accept();
    else await dialog.dismiss();
  } else {
    // Default accept: every other native dialog in these flows (column
    // delete, card archive) confirms a namespaced-fixture action the test
    // itself initiated. Dismissing by default would wedge those flows.
    console.log(`  [dialog] accepting by default: ${message}`);
    await dialog.accept();
  }
}

const DESKTOP = { width: 1440, height: 960 };

try {
  // ===================== Feature Board (desktop) =====================
  console.log("=== Feature Board (desktop) ===");
  const desktop = await newContext(DESKTOP);
  const page = await desktop.newPage();
  watch(page, defaultDialogRouter);
  await page.goto(`${base}/admin/features`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('h2:has-text("Backlog")', { timeout: 120000 });
  // Default view is Now + Next (and unlabeled new cards). Still select All
  // so a fixture without taxonomy labels cannot be hidden by a later filter.
  await clearFeaturesMilestoneFilter(page);
  await page.screenshot({ path: shot("features-board") });

  const backlogColumn = columnSection(page, "Backlog");
  check("Backlog column visible", (await backlogColumn.count()) > 0, await backlogColumn.count());

  // Create a test card via the real "New feature" dialog. The commit
  // refetches asynchronously, so poll for the card anywhere on the board.
  await page.click('button:has-text("New feature")');
  await page.getByLabel("Title").fill(FEATURE_CARD_TITLE);
  await page.click('button:has-text("Add to board")');
  let cardRendered = false;
  for (let i = 0; i < 15 && !cardRendered; i += 1) {
    await page.waitForTimeout(1000);
    cardRendered = ((await page.locator("article", { hasText: FEATURE_CARD_TITLE }).count()) ?? 0) > 0;
  }
  await page.screenshot({ path: shot("features-card-created") });

  check("test card rendered in a column", cardRendered, "card never appeared");

  // Mouse drag: grip handle into Planned (small precise target).
  const plannedColumn = columnSection(page, "Planned");
  const commitPromise = waitForCommit(page, "/api/admin/features");
  await dragCard(
    page,
    page.locator(`button[aria-label="Drag ${FEATURE_CARD_TITLE}"]`),
    await resolveDropTarget(plannedColumn),
  );
  await commitPromise;
  await page.screenshot({ path: shot("features-after-drag") });
  check(
    "mouse drag moved the card into Planned",
    await waitForCardIn(plannedColumn, FEATURE_CARD_TITLE),
    "card never arrived under Planned",
  );

  // Persistence across reload (filters reset on reload by design, so clear again).
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('h2:has-text("Planned")', { timeout: 120000 });
  await clearFeaturesMilestoneFilter(page);
  check(
    "drag persisted across a reload",
    await waitForCardIn(columnSection(page, "Planned"), FEATURE_CARD_TITLE, 10000),
    "card not under Planned after reload",
  );

  // Keyboard move: focus the grip, Space to lift, ArrowRight to the next
  // column, Space to drop. This is the accessible-movement path.
  const kbGrip = page.locator(`button[aria-label="Drag ${FEATURE_CARD_TITLE}"]`).first();
  await kbGrip.scrollIntoViewIfNeeded();
  await kbGrip.focus();
  const kbCommit = waitForCommit(page, "/api/admin/features");
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  await kbCommit;
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shot("features-after-keyboard-move") });
  const kbInNext =
    (await columnSection(page, "In progress").locator("article", { hasText: FEATURE_CARD_TITLE }).count()) > 0;
  const kbInBlocked =
    (await columnSection(page, "Blocked").locator("article", { hasText: FEATURE_CARD_TITLE }).count()) > 0;
  // The commit is async (same path as a mouse drop); poll briefly before
  // calling it.
  let kbMoved = kbInNext || kbInBlocked;
  for (let i = 0; i < 10 && !kbMoved; i += 1) {
    await page.waitForTimeout(1000);
    kbMoved =
      (await columnSection(page, "In progress").locator("article", { hasText: FEATURE_CARD_TITLE }).count()) > 0 ||
      (await columnSection(page, "Blocked").locator("article", { hasText: FEATURE_CARD_TITLE }).count()) > 0;
  }
  check("keyboard move carried the card to the next column", kbMoved, "card did not change column");

  // Unsaved-change guard: dirty the dialog, Escape must ask (dismissed, so
  // the dialog stays open with edits intact); Cancel must ask (accepted, so
  // it closes without saving).
  const cardTitle = page.locator("article", { hasText: FEATURE_CARD_TITLE }).first().locator("h3");
  await cardTitle.click();
  await page.waitForTimeout(600);
  await page.getByLabel("Title").fill(`${FEATURE_CARD_TITLE} DIRTY-PROBE`);
  discardGuardSawConfirm = false;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  check("Escape on a dirty dialog asks first", discardGuardSawConfirm, "no confirm appeared");
  check(
    "dismissing the guard keeps the dialog open with edits intact",
    (await page.getByRole("button", { name: "Save changes" }).count()) > 0,
    "dialog closed despite dismiss",
  );
  // The dialog footer's Cancel is the exact action; a loose text selector
  // also matches card title buttons, so scope it by exact accessible name.
  // This close is expected to trigger the guard (accept this time).
  acceptDiscardGuard = true;
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.waitForTimeout(600);
  check("Cancel on a dirty dialog asks first", discardGuardSawConfirm, "no confirm appeared");
  check(
    "accepting the guard closes without saving",
    (await page.getByRole("button", { name: "Save changes" }).count()) === 0,
    "dialog still open after accept",
  );
  await clearFeaturesMilestoneFilter(page);
  check(
    "guarded edits were not saved",
    (await page.locator("article", { hasText: "DIRTY-PROBE" }).count()) === 0,
    "dirty title leaked onto the board",
  );

  // Column management on a dedicated throwaway column (never a real one).
  const TEST_COLUMN_LABEL = `QA-DELETE-ME Column ${RUN_ID}`;
  const addColumnTile = page.locator('button:has-text("Add column")').first();
  await addColumnTile.scrollIntoViewIfNeeded();
  await addColumnTile.click();
  await page.fill('input[placeholder="Column name"]', TEST_COLUMN_LABEL);
  const [createColResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/admin/kanban/columns") && res.request().method() === "POST",
    ),
    page.click('button:has-text("Add column"):visible >> nth=-1'),
  ]);
  check("column creation POST succeeded", createColResponse.status() === 201, createColResponse.status());
  await page.waitForTimeout(500);
  check(
    "new column appears after Add column",
    (await page.locator(`h2:has-text("${TEST_COLUMN_LABEL}")`).count()) > 0,
    "new column heading missing",
  );

  // Rename via the inline pencil. Grab the <section> handle first: the
  // instant editing starts, the <h2> is replaced by an <input>, which
  // un-matches a text-anchored locator at exactly the wrong moment.
  const testColHeader = page.locator(`h2:has-text("${TEST_COLUMN_LABEL}")`).first();
  await testColHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await testColHeader.hover();
  const testColSectionHandle = await page.locator("section", { has: testColHeader }).first().elementHandle();
  const renameButtonLocator = page
    .locator("section", { has: testColHeader })
    .first()
    .locator('button[aria-label*="Rename"]');
  await renameButtonLocator.waitFor({ state: "visible", timeout: 20000 });
  // Force the click: the board's snap-mandatory scrolling can keep a
  // freshly scrolled-into-view header perpetually "unstable" for
  // Playwright's actionability checks. Visibility above already proves a
  // real user can see and hit the affordance.
  await renameButtonLocator.click({ force: true });
  const renameInput = await testColSectionHandle.$("input");
  if (!renameInput) throw new Error("rename input did not appear inside the test column section");
  await renameInput.fill("QA-DELETE-ME Renamed");
  await renameInput.press("Enter");
  // The commit round-trips (optimistic update, PATCH, server row); poll
  // for the new heading rather than asserting a fixed sleep.
  let renamed = false;
  for (let i = 0; i < 10 && !renamed; i += 1) {
    await page.waitForTimeout(1000);
    renamed = ((await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count()) ?? 0) > 0;
  }
  check("column rename via UI took effect", renamed, "renamed heading missing");

  // Delete the (still empty) renamed test column.
  const newColSection = page.locator("section", {
    has: page.locator('h2:has-text("QA-DELETE-ME Renamed")'),
  });
  await newColSection.locator('button[aria-label*="Column options"]').click();
  await newColSection.locator('button:has-text("Delete column")').click();
  await page.waitForTimeout(600);
  check(
    "empty column deleted via UI",
    (await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count()) === 0,
    "column still present",
  );

  // List view: renders, and its status select moves through the same
  // validated path a drag would.
  await page.click('button:has-text("List")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: shot("features-list-view") });
  check("List view renders a table", (await page.locator("table").count()) > 0, "no table");
  const listRow = page.locator("tr", { hasText: FEATURE_CARD_TITLE }).first();
  const listStatusSelect = listRow.locator("select").first();
  if ((await listStatusSelect.count()) > 0) {
    const listCommit = waitForCommit(page, "/api/admin/features");
    await listStatusSelect.selectOption("backlog");
    await listCommit;
    await page.waitForTimeout(1000);
  }
  await page.click('button:has-text("Board")');
  await page.waitForTimeout(500);
  await clearFeaturesMilestoneFilter(page);
  check(
    "list-view move is reflected on the board",
    await waitForCardIn(columnSection(page, "Backlog"), FEATURE_CARD_TITLE, 10000),
    "card not back in Backlog",
  );

  // Clean up the test card via its dialog archive action.
  const cardNow = page.locator("article", { hasText: FEATURE_CARD_TITLE }).first();
  if ((await cardNow.count()) > 0) {
    await cardNow.locator("h3", { hasText: FEATURE_CARD_TITLE }).click();
    await page.waitForTimeout(600);
    const archiveBtn = page.getByRole("button", { name: "Archive", exact: true });
    if ((await archiveBtn.count()) > 0) {
      await archiveBtn.click();
      await page.waitForTimeout(600);
    }
  }
  await desktop.close();

  // ===================== Pipeline (desktop) =====================
  console.log("\n=== Pipeline (desktop) ===");
  const pipeCtx = await newContext(DESKTOP);
  const pipe = await pipeCtx.newPage();
  watch(pipe, defaultDialogRouter);
  await pipe.goto(`${base}/admin/pipeline`, { waitUntil: "domcontentloaded" });
  await pipe.waitForSelector("text=New opportunity", { timeout: 120000 });
  await pipe.screenshot({ path: shot("pipeline-board") });

  // The create dialog has no "opportunity name" field — createOpportunity()
  // falls back to the resolved company's name for the card title, so the
  // company (backed by a unique domain per run) is the stable search key:
  // identity resolution matches companies by domain and never renames an
  // existing match, so a reused domain would inherit an older run's name.
  const OPP_NAME = `QA Browser Test Co ${RUN_ID}`;
  await pipe.click('button:has-text("New opportunity")');
  await pipe.fill('input[name="name"]', `QA Browser Test ${RUN_ID}`);
  await pipe.fill('input[name="email"]', `qa-browser-${RUN_ID}@example-${RUN_ID}.invalid`);
  await pipe.fill('input[name="companyName"]', OPP_NAME);
  await pipe.fill('input[name="estimatedValue"]', "4200");
  const [createOppResponse] = await Promise.all([
    pipe.waitForResponse(
      (res) => res.url().includes("/api/admin/revenue-os/pipeline") && res.request().method() === "POST",
      { timeout: 45000 },
    ),
    // The dialog's success handler refetches after the POST resolves —
    // wait for that too, so the DOM has re-rendered before we search it.
    pipe.waitForResponse(
      (res) => res.url().includes("/api/admin/revenue-os/pipeline") && res.request().method() === "GET",
      { timeout: 45000 },
    ),
    pipe.click('button:has-text("Create opportunity")'),
  ]);
  const createOppBody = await createOppResponse.json().catch(() => null);
  check("opportunity creation POST succeeded", createOppResponse.status() === 201, {
    status: createOppResponse.status(),
    body: createOppBody,
  });
  const newOppId = createOppBody?.opportunity?.id;
  if (newOppId) {
    createdOpportunityIds.push(newOppId);
    // Hard safety gate: verify this row actually landed in the test tenant
    // before doing anything else with it.
    const { data: landedRow } = await admin
      .from("opportunities")
      .select("tenant_id")
      .eq("id", newOppId)
      .maybeSingle();
    if (landedRow?.tenant_id !== TEST_TENANT_ID) {
      throw new Error(
        `SAFETY ABORT: test opportunity landed in tenant_id=${landedRow?.tenant_id}, expected the test tenant ${TEST_TENANT_ID}. Refusing to continue.`,
      );
    }
    console.log("  [safety] confirmed test opportunity is scoped to the test tenant");
  }
  await pipe.waitForTimeout(500);
  await pipe.screenshot({ path: shot("pipeline-card-created") });

  // Drag by the grip (the whole card is intentionally NOT a drag source —
  // touch scrolling that starts on the card body must keep working).
  const oppGrip = pipe.locator(`button[aria-label="Drag ${OPP_NAME}"]`);
  check("pipeline card exposes a grip handle", (await oppGrip.count()) > 0, await oppGrip.count());
  const lostColumn = columnSection(pipe, "Lost");
  if ((await oppGrip.count()) > 0 && (await lostColumn.count()) > 0) {
    const pipeCommit = waitForCommit(pipe, "/api/admin/revenue-os/pipeline");
    await dragCard(pipe, oppGrip, await resolveDropTarget(lostColumn));
    await pipeCommit;
    await pipe.waitForTimeout(800);
    await pipe.screenshot({ path: shot("pipeline-after-lost-drag") });
    check(
      "grip drag to Lost (after the native reason prompt) moved the card",
      await waitForCardIn(lostColumn, OPP_NAME),
      "card never arrived under Lost",
    );
    // Persistence across reload.
    await pipe.reload({ waitUntil: "domcontentloaded" });
    await pipe.waitForSelector("text=New opportunity", { timeout: 120000 });
    check(
      "pipeline drag persisted across a reload",
      await waitForCardIn(columnSection(pipe, "Lost"), OPP_NAME, 10000),
      "card not under Lost after reload",
    );
  }
  await pipeCtx.close();

  // ===================== Mobile (reduced motion) =====================
  console.log("\n=== Mobile (390x844, reduced motion) ===");
  const mobile = await newContext({ width: 390, height: 844 }, { reducedMotion: true });
  const mpage = await mobile.newPage();
  watch(mpage, defaultDialogRouter);
  await mpage.goto(`${base}/admin/features`, { waitUntil: "domcontentloaded" });
  await mpage.waitForSelector('h2:has-text("Backlog")', { timeout: 120000 });
  await clearFeaturesMilestoneFilter(mpage);
  await mpage.screenshot({ path: shot("features-board-mobile") });
  check("mobile board renders columns", (await columnSection(mpage, "Backlog").count()) > 0, "no Backlog column");
  // No horizontal page overflow: the board scrolls inside its own container.
  const pageOverflows = await mpage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check("mobile page does not overflow horizontally", !pageOverflows, "document overflows");
  // List view is the tap-first move control on phones.
  await mpage.click('button:has-text("List")');
  await mpage.waitForTimeout(500);
  await mpage.screenshot({ path: shot("features-list-mobile") });
  check("mobile list view renders", (await mpage.locator("table").count()) > 0, "no table on mobile");

  await mpage.goto(`${base}/admin/pipeline`, { waitUntil: "domcontentloaded" });
  await mpage.waitForSelector("text=New opportunity", { timeout: 120000 });
  await mpage.screenshot({ path: shot("pipeline-board-mobile") });
  check("mobile pipeline renders", (await mpage.locator("section").count()) > 0, "no columns on mobile");
  await mobile.close();

  console.log("\nConsole errors captured during the whole run:", consoleErrors.length);
  for (const err of consoleErrors.slice(0, 20)) console.log("  console:", err);
  check("no browser console errors during the whole run", consoleErrors.length === 0, consoleErrors.slice(0, 5));
} finally {
  await browser.close();
  console.log("\n--- cleanup ---");
  await assertDefaultFeatureLabelsIntact("postflight").catch((err) => {
    console.error("  !!!", err.message);
    failures.push("default Feature Board labels intact after the run");
  });
  if (createdOpportunityIds.length) {
    for (const table of ["stage_events", "activities"]) {
      await admin.from(table).delete().in("opportunity_id", createdOpportunityIds);
    }
    const { error } = await admin.from("opportunities").delete().in("id", createdOpportunityIds);
    console.log(`  deleted ${createdOpportunityIds.length} test opportunity(ies) ->`, error?.message || "ok");
  }
  const { error: cardCleanupErr, data: leftoverCards } = await admin
    .from("feature_requests")
    .select("id")
    .ilike("title", "QA-DELETE-ME%");
  if (leftoverCards?.length) {
    await admin.from("feature_requests").delete().in("id", leftoverCards.map((c) => c.id));
  }
  console.log("  leftover QA feature cards removed:", leftoverCards?.length ?? 0, cardCleanupErr?.message || "");
  const { data: leftoverCols } = await admin
    .from("kanban_columns")
    .select("id,board_key,column_key,tenant_id")
    .ilike("label", "QA-DELETE-ME%");
  if (leftoverCols?.length) {
    console.log("  leftover QA columns found:", leftoverCols);
    await admin.from("kanban_columns").delete().in("id", leftoverCols.map((c) => c.id));
  }
}

console.log("\n=== Result ===");
console.log(JSON.stringify({ passed: failures.length === 0, failureCount: failures.length, failures }, null, 2));
if (failures.length) process.exit(1);

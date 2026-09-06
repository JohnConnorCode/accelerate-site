#!/usr/bin/env node
/**
 * Real browser UI QA for the kanban unification work, via Playwright:
 * actual mouse drag-and-drop through dnd-kit's pointer sensor, actual clicks
 * on rename/add/delete affordances, actual native `window.prompt` handling
 * for Pipeline's loss-reason flow, console-error checking, and reload
 * persistence checks. Runs against an isolated server copy (never the
 * user's own dev server) and the isolation-proof-alpha test tenant.
 *
 * RECOVERED 2026-09-03: this working draft was restored from a read-back
 * after an accidental rm + checkout in a parallel session destroyed its
 * uncommitted changes. The durable successor is
 * scripts/qa-kanban-boards.mjs (npm run test:kanban-boards), which carries
 * over every technique proven here (grip-source drags, neutral-pointer
 * wheel discipline, small precise drop targets, tenant safety abort,
 * unique-domain fixtures, label preflight/postflight) and is green.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.QA_BASE_URL || "http://localhost:3099";
const TEST_TENANT_SLUG = "isolation-proof-alpha";
const RUN_ID = Date.now();
const FEATURE_CARD_TITLE = `QA-DELETE-ME browser drag test card ${RUN_ID}`;
const shotDir =
  "/private/tmp/claude-501/-Users-johnconnor-Documents-GitHub-Accelerate-agency/2115b36b-88b7-4a82-b535-d166936d2285/scratchpad/qa-shots";
mkdirSync(shotDir, { recursive: true });

const DEFAULT_FEATURE_LABELS = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  shipped: "Shipped",
};

async function assertDefaultFeatureLabelsIntact(admin, when) {
  const { data, error } = await admin
    .from("kanban_columns")
    .select("column_key,label")
    .eq("board_key", "features")
    .is("tenant_id", null);
  if (error) throw error;
  const byKey = Object.fromEntries((data ?? []).map((r) => [r.column_key, r.label]));
  const mismatches = Object.entries(DEFAULT_FEATURE_LABELS).filter(
    ([key, label]) => byKey[key] !== label,
  );
  if (mismatches.length) {
    throw new Error(
      `${when}: real Feature Board column labels are not as expected — ${JSON.stringify(mismatches)}. Refusing to proceed against corrupted state.`,
    );
  }
  console.log(`  [preflight/postflight] default Feature Board labels intact (${when})`);
}

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

await assertDefaultFeatureLabelsIntact(admin, "preflight");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addCookies([
  {
    name: `sb-${projectRef}-auth-token`,
    value: cookieValue,
    url: base,
  },
]);
// requireAdmin() reads `x-tenant-slug` before the `accelerate-tenant-slug`
// cookie fallback — a cookie set via context.addCookies() was NOT reliably
// reaching the server for this app (root-caused after test opportunities
// landed in the real Accelerate tenant instead of the test one). The header
// is the same mechanism the working HTTP-level test script used
// successfully, so use it here too rather than trust the cookie fallback.
await context.setExtraHTTPHeaders({ "x-tenant-slug": TEST_TENANT_SLUG });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("dialog", async (dialog) => {
  console.log(`  [dialog:${dialog.type()}] ${dialog.message()}`);
  await dialog.accept("QA browser test — no real signal");
});

async function dragCard(fromLocator, toLocator) {
  // Real boards can have dozens of real cards, so the source/target may not
  // both fit on screen at once: scroll to the source, start the drag, THEN
  // scroll the (now mid-drag) page to the target before releasing — mirrors
  // what a real user has to do on a long board, and avoids grabbing stale
  // coordinates from before a scroll.
  await fromLocator.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const from = await fromLocator.first().boundingBox();
  if (!from) throw new Error("drag source not visible");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2 + 15, { steps: 5 });
  await page.waitForTimeout(100);

  // If the target isn't visible yet, scroll to it using wheel events with
  // the pointer parked at a neutral mid-viewport position — NOT by moving
  // the pointer toward/near an edge (scrollIntoViewIfNeeded, or a pointer
  // parked where the target will land) — because a pointer near an edge is
  // exactly what triggers dnd-kit's OWN autoScroll, and that fought with
  // manual scrolling and kept landing drops one column past the intended
  // one. Wheel-scrolling with the pointer safely in the middle avoids
  // triggering it at all, so there is exactly one scroll actor, not two.
  const neutralX = Math.min(Math.max(from.x + from.width / 2, 200), 1200);
  const neutralY = Math.min(Math.max(from.y, 200), 700);
  await page.mouse.move(neutralX, neutralY, { steps: 3 });
  // Center the target precisely in one shot via the DOM's own scrollIntoView
  // rather than a wheel-and-recheck loop: a narrow target element (e.g. an
  // empty column's placeholder text) can satisfy a "does it fit" bounds
  // check right up against a viewport edge without ever being centered,
  // driving a naive loop all the way to the container's max scroll and
  // landing the target partially (or fully) off-screen anyway.
  await toLocator
    .first()
    .evaluate((el) => el.scrollIntoView({ inline: "center", block: "nearest" }));
  await page.waitForTimeout(300);
  const to = await toLocator.first().boundingBox();
  if (!to) throw new Error("drag target not visible after wheel-scrolling");
  const targetX = to.x + to.width / 2;
  const targetY = to.y + to.height / 2;
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const createdOpportunityIds = [];

try {
  // ===================== Feature Board =====================
  console.log("=== Feature Board (browser) ===");
  await page.goto(`${base}/admin/features`, { waitUntil: "networkidle" });
  await page.waitForSelector('h2:has-text("Backlog")', { timeout: 15000 });
  // The board opens with a default milestone filter (an existing product
  // behavior, not part of this kanban work) that hides cards without that
  // label and disables drag — clear it so a freshly created test card is
  // visible and draggable.
  const milestoneSelect = page.locator('select[aria-label="Filter by milestone"]');
  if (await milestoneSelect.count()) await milestoneSelect.selectOption("all");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotDir}/features-board.png` });

  const backlogColumn = page.locator("section", {
    has: page.locator("h2", { hasText: "Backlog" }),
  });
  const plannedColumn = page.locator("section", {
    has: page.locator("h2", { hasText: "Planned" }),
  });
  check("Backlog column visible", (await backlogColumn.count()) > 0, await backlogColumn.count());
  check("Planned column visible", (await plannedColumn.count()) > 0, await plannedColumn.count());

  // Create a test card via the real "New feature" dialog.
  await page.click('button:has-text("New feature")');
  await page.getByLabel("Title").fill(FEATURE_CARD_TITLE);
  await page.click('button:has-text("Add to board")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shotDir}/features-card-created.png` });

  const testCard = page.locator("article", { hasText: FEATURE_CARD_TITLE }).first();
  check("test card rendered in a column", (await testCard.count()) > 0, await testCard.count());

  if ((await testCard.count()) > 0) {
    const dragHandle = page.locator(`button[aria-label="Drag ${FEATURE_CARD_TITLE}"]`);
    await dragCard(dragHandle, plannedColumn);
    await page.screenshot({ path: `${shotDir}/features-after-drag.png` });
    const movedToPlanned = plannedColumn.locator("article", { hasText: FEATURE_CARD_TITLE });
    check(
      "drag moved the card into Planned",
      (await movedToPlanned.count()) > 0,
      await movedToPlanned.count(),
    );

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('h2:has-text("Planned")', { timeout: 10000 });
    // Filters are plain component state, not persisted — a reload resets
    // the default milestone filter too, which would hide our unlabeled test
    // card again and make this check fail for the wrong reason.
    const milestoneSelectAfterReload = page.locator('select[aria-label="Filter by milestone"]');
    if (await milestoneSelectAfterReload.count())
      await milestoneSelectAfterReload.selectOption("all");
    await page.waitForTimeout(300);
    const persisted = page
      .locator("section", { has: page.locator("h2", { hasText: "Planned" }) })
      .locator("article", { hasText: FEATURE_CARD_TITLE });
    check("drag persisted across a reload", (await persisted.count()) > 0, await persisted.count());
  }

  // Add a column via the "+ Add column" tile — a dedicated, uniquely-named
  // test column, so the rename test below never has to touch a real,
  // meaningful column, and reruns can't collide with a prior run's leftover.
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
  check(
    "column creation POST succeeded",
    createColResponse.status() === 201,
    createColResponse.status(),
  );
  await page.waitForTimeout(500);
  check(
    "new column appears after Add column",
    (await page.locator(`h2:has-text("${TEST_COLUMN_LABEL}")`).count()) > 0,
    await page.locator(`h2:has-text("${TEST_COLUMN_LABEL}")`).count(),
  );

  // Rename that test column via the inline pencil affordance. The new
  // column is appended at the end of a horizontally-scrolling board, so
  // scroll it into view explicitly rather than relying on click()'s
  // auto-scroll. Grab a stable ElementHandle on the <section> itself (not a
  // content-based locator) before clicking rename — the instant editing
  // starts, the <h2> that a text-based locator would anchor on is replaced
  // by an <input>, which un-matches a `has: h2Locator` filter and makes it
  // resolve to nothing right when the input is what we need to find.
  const testColHeader = page.locator(`h2:has-text("${TEST_COLUMN_LABEL}")`).first();
  await testColHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await testColHeader.hover();
  const testColSectionHandle = await page
    .locator("section", { has: testColHeader })
    .first()
    .elementHandle();
  const renameButtonLocator = page
    .locator("section", { has: testColHeader })
    .first()
    .locator('button[aria-label*="Rename"]');
  await renameButtonLocator.waitFor({ state: "visible", timeout: 5000 });
  await renameButtonLocator.click();
  await page.screenshot({ path: `${shotDir}/features-rename-clicked.png` });
  const renameInput = await testColSectionHandle.$("input");
  if (!renameInput) throw new Error("rename input did not appear inside the test column section");
  await renameInput.fill("QA-DELETE-ME Renamed");
  await renameInput.press("Enter");
  await page.waitForTimeout(800);
  check(
    "column rename via UI took effect",
    (await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count()) > 0,
    await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count(),
  );

  // Delete the (still empty) renamed test column.
  const newColSection = page.locator("section", {
    has: page.locator('h2:has-text("QA-DELETE-ME Renamed")'),
  });
  await newColSection.locator('button[aria-label="Column options"]').click();
  await newColSection.locator('button:has-text("Delete column")').click();
  await page.waitForTimeout(600);
  check(
    "empty column deleted via UI",
    (await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count()) === 0,
    await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count(),
  );

  // List view toggle.
  await page.click('button:has-text("List")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}/features-list-view.png` });
  check(
    "List view renders a table",
    (await page.locator("table").count()) > 0,
    await page.locator("table").count(),
  );
  await page.click('button:has-text("Board")');
  await page.waitForTimeout(500);

  // Clean up the test card: find its current column and archive it.
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

  // ===================== Pipeline =====================
  console.log("\n=== Pipeline (browser, tenant: isolation-proof-alpha) ===");
  await page.goto(`${base}/admin/pipeline`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=New opportunity", { timeout: 15000 });
  await page.screenshot({ path: `${shotDir}/pipeline-board.png` });

  // The create dialog has no "opportunity name" field — createOpportunity()
  // falls back to the resolved company's name for the card title, so fill
  // Company with something unique rather than searching for the contact
  // name (which never appears on the card).
  const OPP_NAME = `QA Browser Test Co ${RUN_ID}`;
  await page.click('button:has-text("New opportunity")');
  await page.fill('input[name="name"]', `QA Browser Test ${RUN_ID}`);
  // A unique domain per run, not just a unique local-part: identity
  // resolution matches companies by domain and does not rename an existing
  // match, so reusing "example.invalid" across runs made every "new"
  // opportunity silently inherit the very first run's company name.
  await page.fill('input[name="email"]', `qa-browser-${RUN_ID}@example-${RUN_ID}.invalid`);
  await page.fill('input[name="companyName"]', OPP_NAME);
  await page.fill('input[name="estimatedValue"]', "4200");
  const [createOppResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/admin/revenue-os/pipeline") && res.request().method() === "POST",
      { timeout: 15000 },
    ),
    // The dialog's success handler triggers its own GET refetch after the
    // POST resolves — wait for that too, not just the POST, so the DOM has
    // actually re-rendered with the new row before we go looking for it.
    page.waitForResponse(
      (res) =>
        res.url().includes("/api/admin/revenue-os/pipeline") && res.request().method() === "GET",
      { timeout: 15000 },
    ),
    page.click('button:has-text("Create opportunity")'),
  ]);
  const createOppBody = await createOppResponse.json().catch(() => null);
  check("opportunity creation POST succeeded", createOppResponse.status() === 201, {
    status: createOppResponse.status(),
    body: createOppBody,
  });
  const newOppId = createOppBody?.opportunity?.id;
  if (newOppId) {
    createdOpportunityIds.push(newOppId);
    // Hard safety gate: verify this row actually landed in the test tenant,
    // not the real Accelerate one, before doing anything else with it. Catches
    // a tenant-scoping regression immediately instead of via a later, more
    // confusing symptom (this is exactly how a prior run's data ended up in
    // production — the cookie-based tenant header wasn't being honored).
    const { data: landedRow } = await admin
      .from("opportunities")
      .select("tenant_id")
      .eq("id", newOppId)
      .maybeSingle();
    const testTenantId = "06a53f21-cd96-47d1-9f89-166c1f00b716";
    if (landedRow?.tenant_id !== testTenantId) {
      throw new Error(
        `SAFETY ABORT: test opportunity landed in tenant_id=${landedRow?.tenant_id}, expected the test tenant ${testTenantId}. Refusing to continue.`,
      );
    }
    console.log("  [safety] confirmed test opportunity is scoped to the test tenant");
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}/pipeline-card-created.png` });

  const oppCard = page.locator("article", { hasText: OPP_NAME }).first();
  check("test opportunity card rendered", (await oppCard.count()) > 0, await oppCard.count());

  const lostHeader = page.getByRole("heading", { name: "Lost", exact: true }).first();
  const lostColumn = page.locator("section", { has: lostHeader });
  // dnd-kit's droppable ref is the column BODY div specifically, not the
  // whole <section> (which also includes the header) — target something
  // guaranteed to sit inside that exact body, not merely inside the
  // section, so the drop coordinate can't land in the header/padding area
  // dnd-kit doesn't consider part of the droppable rect at all.
  const lostDropTarget = lostColumn.getByText("No opportunities in this stage.");
  if ((await oppCard.count()) > 0 && (await lostColumn.count()) > 0) {
    // The card's whole wrapper carries dragHandleProps (PipelineKanbanCard),
    // so drag from the article's own body rather than a specific control.
    await dragCard(oppCard, lostDropTarget);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shotDir}/pipeline-after-lost-drag.png` });
    const nowInLost = lostColumn.locator("article", { hasText: OPP_NAME });
    check(
      "dragging to Lost (after accepting the native reason prompt) moved the card",
      (await nowInLost.count()) > 0,
      await nowInLost.count(),
    );
  }

  // Capture the opportunity id for cleanup via its detail link.
  const stillCard = page.locator("article", { hasText: OPP_NAME }).first();
  if ((await stillCard.count()) > 0) {
    const href = await stillCard.locator("a").first().getAttribute("href");
    const id = href?.split("/").pop();
    if (id) createdOpportunityIds.push(id);
  }

  console.log("\nConsole errors captured during the whole run:", consoleErrors.length);
  for (const err of consoleErrors.slice(0, 20)) console.log("  console:", err);
  check(
    "no browser console errors during the whole run",
    consoleErrors.length === 0,
    consoleErrors,
  );
} finally {
  await browser.close();
  console.log("\n--- cleanup ---");
  await assertDefaultFeatureLabelsIntact(admin, "postflight").catch((err) => {
    console.error("  !!!", err.message);
    failures.push("default Feature Board labels intact after the run");
  });
  if (createdOpportunityIds.length) {
    for (const table of ["stage_events", "activities"]) {
      await admin.from(table).delete().in("opportunity_id", createdOpportunityIds);
    }
    const { error } = await admin.from("opportunities").delete().in("id", createdOpportunityIds);
    console.log(
      `  deleted ${createdOpportunityIds.length} test opportunity(ies) ->`,
      error?.message || "ok",
    );
  }
  const { error: cardCleanupErr, data: leftoverCards } = await admin
    .from("feature_requests")
    .select("id")
    .ilike("title", "QA-DELETE-ME%");
  if (leftoverCards?.length) {
    await admin
      .from("feature_requests")
      .delete()
      .in(
        "id",
        leftoverCards.map((c) => c.id),
      );
  }
  console.log(
    "  leftover QA feature cards removed:",
    leftoverCards?.length ?? 0,
    cardCleanupErr?.message || "",
  );
  const { data: leftoverCols } = await admin
    .from("kanban_columns")
    .select("id,board_key,column_key,tenant_id")
    .ilike("label", "QA-DELETE-ME%");
  if (leftoverCols?.length) {
    console.log("  leftover QA columns found:", leftoverCols);
    await admin
      .from("kanban_columns")
      .delete()
      .in(
        "id",
        leftoverCols.map((c) => c.id),
      );
  }
}

console.log("\n=== Result ===");
console.log(
  JSON.stringify(
    { passed: failures.length === 0, failureCount: failures.length, failures },
    null,
    2,
  ),
);
if (failures.length) process.exit(1);

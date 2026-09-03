#!/usr/bin/env node
/**
 * Real browser UI QA for the kanban unification work, via Playwright:
 * actual mouse drag-and-drop through dnd-kit's pointer sensor, actual clicks
 * on rename/add/delete affordances, actual native `window.prompt` handling
 * for Pipeline's loss-reason flow, console-error checking, and reload
 * persistence checks. Runs against an isolated server copy (never the
 * user's own dev server) and the isolation-proof-alpha test tenant.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.QA_BASE_URL || "http://localhost:3099";
const TEST_TENANT_SLUG = "isolation-proof-alpha";
const RUN_ID = Date.now();
const FEATURE_CARD_TITLE = `QA-DELETE-ME browser drag test card ${RUN_ID}`;
const shotDir = "/private/tmp/claude-501/-Users-johnconnor-Documents-GitHub-Accelerate-agency/2115b36b-88b7-4a82-b535-d166936d2285/scratchpad/qa-shots";
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
  const mismatches = Object.entries(DEFAULT_FEATURE_LABELS).filter(([key, label]) => byKey[key] !== label);
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
  { name: "accelerate-tenant-slug", value: TEST_TENANT_SLUG, url: base },
]);
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

  await toLocator.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const to = await toLocator.first().boundingBox();
  if (!to) throw new Error("drag target not visible");
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(60, to.height / 2), { steps: 15 });
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(60, to.height / 2), { steps: 3 });
  await page.waitForTimeout(150);
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

  const backlogColumn = page.locator("section", { has: page.locator("h2", { hasText: "Backlog" }) });
  const plannedColumn = page.locator("section", { has: page.locator("h2", { hasText: "Planned" }) });
  check("Backlog column visible", await backlogColumn.count() > 0, await backlogColumn.count());
  check("Planned column visible", await plannedColumn.count() > 0, await plannedColumn.count());

  // Create a test card via the real "New feature" dialog.
  await page.click('button:has-text("New feature")');
  await page.getByLabel("Title").fill(FEATURE_CARD_TITLE);
  await page.click('button:has-text("Add to board")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shotDir}/features-card-created.png` });

  const testCard = page.locator("article", { hasText: FEATURE_CARD_TITLE }).first();
  check("test card rendered in a column", await testCard.count() > 0, await testCard.count());

  if (await testCard.count() > 0) {
    const dragHandle = page.locator(`button[aria-label="Drag ${FEATURE_CARD_TITLE}"]`);
    await dragCard(dragHandle, plannedColumn);
    await page.screenshot({ path: `${shotDir}/features-after-drag.png` });
    const movedToPlanned = plannedColumn.locator("article", { hasText: FEATURE_CARD_TITLE });
    check("drag moved the card into Planned", await movedToPlanned.count() > 0, await movedToPlanned.count());

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('h2:has-text("Planned")', { timeout: 10000 });
    // Filters are plain component state, not persisted — a reload resets
    // the default milestone filter too, which would hide our unlabeled test
    // card again and make this check fail for the wrong reason.
    const milestoneSelectAfterReload = page.locator('select[aria-label="Filter by milestone"]');
    if (await milestoneSelectAfterReload.count()) await milestoneSelectAfterReload.selectOption("all");
    await page.waitForTimeout(300);
    const persisted = page
      .locator("section", { has: page.locator("h2", { hasText: "Planned" }) })
      .locator("article", { hasText: FEATURE_CARD_TITLE });
    check("drag persisted across a reload", await persisted.count() > 0, await persisted.count());
  }

  // Add a column via the "+ Add column" tile — a dedicated test column, so
  // the rename test below never has to touch a real, meaningful column.
  await page.click('button:has-text("Add column")');
  await page.fill('input[placeholder="Column name"]', "QA-DELETE-ME Column");
  await page.click('button:has-text("Add column"):visible >> nth=-1');
  await page.waitForTimeout(800);
  check(
    "new column appears after Add column",
    await page.locator('h2:has-text("QA-DELETE-ME Column")').count() > 0,
    await page.locator('h2:has-text("QA-DELETE-ME Column")').count(),
  );

  // Rename that test column via the inline pencil affordance. The new
  // column is appended at the end of a horizontally-scrolling board, so
  // scroll it into view explicitly rather than relying on click()'s
  // auto-scroll. Grab a stable ElementHandle on the <section> itself (not a
  // content-based locator) before clicking rename — the instant editing
  // starts, the <h2> that a text-based locator would anchor on is replaced
  // by an <input>, which un-matches a `has: h2Locator` filter and makes it
  // resolve to nothing right when the input is what we need to find.
  const testColHeader = page.locator('h2:has-text("QA-DELETE-ME Column")').first();
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
  const renameInput = (await testColSectionHandle.$("input"));
  if (!renameInput) throw new Error("rename input did not appear inside the test column section");
  await renameInput.fill("QA-DELETE-ME Renamed");
  await renameInput.press("Enter");
  await page.waitForTimeout(800);
  check(
    "column rename via UI took effect",
    await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count() > 0,
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
    await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count() === 0,
    await page.locator('h2:has-text("QA-DELETE-ME Renamed")').count(),
  );

  // List view toggle.
  await page.click('button:has-text("List")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shotDir}/features-list-view.png` });
  check("List view renders a table", await page.locator("table").count() > 0, await page.locator("table").count());
  await page.click('button:has-text("Board")');
  await page.waitForTimeout(500);

  // Clean up the test card: find its current column and archive it.
  const cardNow = page.locator("article", { hasText: FEATURE_CARD_TITLE }).first();
  if (await cardNow.count() > 0) {
    await cardNow.locator("h3", { hasText: FEATURE_CARD_TITLE }).click();
    await page.waitForTimeout(600);
    const archiveBtn = page.locator('button:has-text("Archive")');
    if (await archiveBtn.count() > 0) {
      await archiveBtn.click();
      await page.waitForTimeout(600);
    }
  }

  // ===================== Pipeline =====================
  console.log("\n=== Pipeline (browser, tenant: isolation-proof-alpha) ===");
  await page.goto(`${base}/admin/pipeline`, { waitUntil: "networkidle" });
  await page.waitForSelector('text=New opportunity', { timeout: 15000 });
  await page.screenshot({ path: `${shotDir}/pipeline-board.png` });

  await page.click('button:has-text("New opportunity")');
  await page.fill('input[name="name"]', "QA Browser Test");
  await page.fill('input[name="email"]', `qa-browser-${Date.now()}@example.invalid`);
  await page.fill('input[name="estimatedValue"]', "4200");
  await page.click('button:has-text("Create opportunity")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${shotDir}/pipeline-card-created.png` });

  const oppCard = page.locator("article", { hasText: "QA Browser Test" }).first();
  check("test opportunity card rendered", await oppCard.count() > 0, await oppCard.count());

  const lostHeader = page.locator('h2:has-text("Lost")').first();
  const lostColumn = page.locator("section", { has: lostHeader });
  if (await oppCard.count() > 0 && (await lostColumn.count()) > 0) {
    // The card's whole wrapper carries dragHandleProps (PipelineKanbanCard),
    // so drag from the article's own body rather than a specific control.
    await dragCard(oppCard, lostColumn);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shotDir}/pipeline-after-lost-drag.png` });
    const nowInLost = lostColumn.locator("article", { hasText: "QA Browser Test" });
    check(
      "dragging to Lost (after accepting the native reason prompt) moved the card",
      await nowInLost.count() > 0,
      await nowInLost.count(),
    );
  }

  // Capture the opportunity id for cleanup via its detail link.
  const stillCard = page.locator("article", { hasText: "QA Browser Test" }).first();
  if (await stillCard.count() > 0) {
    const href = await stillCard.locator("a").first().getAttribute("href");
    const id = href?.split("/").pop();
    if (id) createdOpportunityIds.push(id);
  }

  console.log("\nConsole errors captured during the whole run:", consoleErrors.length);
  for (const err of consoleErrors.slice(0, 20)) console.log("  console:", err);
  check("no browser console errors during the whole run", consoleErrors.length === 0, consoleErrors);
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

#!/usr/bin/env node
/**
 * Full end-to-end HTTP-level QA of the kanban unification work: real auth
 * cookie, real running dev server, real Postgres — Feature Board, Content
 * Kanban, and Pipeline, including Pipeline's role-driven business rules
 * (loss reason required, reopen requires a reason, won auto-backfills
 * won_value, a custom stage's probability/role actually takes effect, and
 * the "can't delete the last won/lost column" guard).
 *
 * Runs against isolation-proof-alpha for tenant-scoped boards (Content,
 * Pipeline) so it never touches real Accelerate business data. Feature
 * Board is platform-global, so its test card is archived (the product's own
 * delete semantics) and clearly labeled; its test column is hard-deleted.
 *
 * Every assertion funnels through check(); a non-empty failures array exits
 * non-zero. Cleanup runs in a finally block so a failed assertion never
 * leaves test data behind.
 */
import { createClient } from "@supabase/supabase-js";

const base = process.env.QA_BASE_URL || "http://localhost:3010";
const TEST_TENANT_SLUG = "isolation-proof-alpha";

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback` },
});
if (linkError || !linkData?.properties?.hashed_token) {
  throw linkError || new Error("Could not generate a QA sign-in token");
}
const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session) {
  throw verifyError || new Error("Could not exchange the QA sign-in token");
}
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const authCookie = `sb-${projectRef}-auth-token=${cookieValue}`;

const failures = [];
function check(label, condition, detail) {
  const line = condition ? `  OK   ${label}` : `  FAIL ${label} (got: ${JSON.stringify(detail)})`;
  console.log(line);
  if (!condition) failures.push(label);
}

async function api(path, { method = "GET", body, tenant } = {}) {
  const headers = { "Content-Type": "application/json", Cookie: authCookie };
  if (tenant) headers["x-tenant-slug"] = tenant;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json };
}

const created = { featureId: null, featureColumnKey: null, contentId: null, contentColumnKey: null };
const createdOpportunityIds = [];
const createdPipelineColumnKeys = [];

async function cleanup() {
  console.log("\n--- cleanup ---");
  if (created.featureId) {
    const r = await api(`/api/admin/features?id=${created.featureId}`, { method: "DELETE" });
    console.log(`  archived test feature card -> ${r.status}`);
  }
  if (created.featureColumnKey) {
    const r = await api(
      `/api/admin/kanban/columns/${created.featureColumnKey}?board_key=features`,
      { method: "DELETE" },
    );
    console.log(`  deleted test feature column -> ${r.status}`);
  }
  if (created.contentColumnKey) {
    const r = await api(
      `/api/admin/kanban/columns/${created.contentColumnKey}?board_key=content&reassign_to=idea`,
      { method: "DELETE", tenant: TEST_TENANT_SLUG },
    );
    console.log(`  deleted test content column -> ${r.status}`);
  }
  if (created.contentId) {
    const r = await api(`/api/admin/content?id=${created.contentId}`, {
      method: "DELETE",
      tenant: TEST_TENANT_SLUG,
    });
    console.log(`  deleted test content item -> ${r.status}`);
  }
  for (const key of createdPipelineColumnKeys) {
    const { error } = await admin
      .from("kanban_columns")
      .delete()
      .eq("board_key", "pipeline")
      .eq("column_key", key)
      .neq("is_default", true);
    console.log(`  service-role deleted pipeline test column "${key}" -> ${error ? error.message : "ok"}`);
  }
  if (createdOpportunityIds.length) {
    for (const table of ["stage_events", "activities"]) {
      await admin.from(table).delete().in("opportunity_id", createdOpportunityIds);
    }
    const { error } = await admin.from("opportunities").delete().in("id", createdOpportunityIds);
    console.log(`  service-role deleted ${createdOpportunityIds.length} test opportunity(ies) -> ${error ? error.message : "ok"}`);
  }
}

try {
  console.log(`=== Feature Board (${base}) ===`);
  {
    const cols = await api("/api/admin/kanban/columns?board_key=features");
    check("GET features columns succeeds", cols.status === 200, cols.status);
    check(
      "features has the 5 default columns",
      Array.isArray(cols.json?.columns) && cols.json.columns.length >= 5,
      cols.json,
    );

    const addCol = await api("/api/admin/kanban/columns", {
      method: "POST",
      body: { board_key: "features", label: "QA-DELETE-ME Kanban Test" },
    });
    check("POST create feature test column succeeds", addCol.status === 201, addCol);
    created.featureColumnKey = addCol.json?.column_key;

    const rename = await api(
      `/api/admin/kanban/columns/${created.featureColumnKey}?board_key=features`,
      { method: "PATCH", body: { label: "QA-DELETE-ME Renamed" } },
    );
    check("PATCH rename feature test column succeeds", rename.status === 200, rename);
    check(
      "rename actually changed the label",
      rename.json?.label === "QA-DELETE-ME Renamed",
      rename.json,
    );

    const card = await api("/api/admin/features", {
      method: "POST",
      body: {
        title: "QA-DELETE-ME kanban unification test card",
        status: created.featureColumnKey,
        priority: "low",
      },
    });
    check("POST create feature test card succeeds", card.status === 201, card);
    created.featureId = card.json?.id;

    const board = await api("/api/admin/features");
    const found = board.json?.features?.find((f) => f.id === created.featureId);
    check("test card appears on the board in the test column", found?.status === created.featureColumnKey, found);

    const deleteWithCards = await api(
      `/api/admin/kanban/columns/${created.featureColumnKey}?board_key=features`,
      { method: "DELETE" },
    );
    check(
      "deleting a column with cards is blocked (409)",
      deleteWithCards.status === 409 && deleteWithCards.json?.cardCount >= 1,
      deleteWithCards,
    );

    const reassignDelete = await api(
      `/api/admin/kanban/columns/${created.featureColumnKey}?board_key=features&reassign_to=backlog`,
      { method: "DELETE" },
    );
    check("deleting with reassign_to succeeds", reassignDelete.status === 200, reassignDelete);
    created.featureColumnKey = null; // already gone, skip in cleanup

    const afterDelete = await api("/api/admin/features");
    const movedCard = afterDelete.json?.features?.find((f) => f.id === created.featureId);
    check("card was reassigned to backlog, not lost", movedCard?.status === "backlog", movedCard);
  }

  console.log(`\n=== Content Kanban (tenant: ${TEST_TENANT_SLUG}) ===`);
  {
    const cols = await api("/api/admin/kanban/columns?board_key=content", { tenant: TEST_TENANT_SLUG });
    check("GET content columns succeeds", cols.status === 200, cols.status);
    check(
      "content has the 5 default columns",
      Array.isArray(cols.json?.columns) && cols.json.columns.length === 5,
      cols.json,
    );

    const item = await api("/api/admin/content", {
      method: "POST",
      tenant: TEST_TENANT_SLUG,
      body: {
        title: "QA-DELETE-ME content test item",
        slug: `qa-delete-me-${Date.now()}`,
        status: "idea",
        category: "foundational",
        pillar: "foundational",
        funnel_stage: "awareness",
        author: "QA",
      },
    });
    check("POST create content test item succeeds", item.status === 200 || item.status === 201, item);
    created.contentId = item.json?.item?.id;
    check("content item has a numeric sort_order", Number.isFinite(item.json?.item?.sort_order), item.json);

    const move = await api("/api/admin/content", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: created.contentId, status: "draft" },
    });
    check("PATCH content status change succeeds", move.status === 200, move);

    const reorder = await api("/api/admin/content", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { reorder: [{ id: created.contentId, column_key: "draft", sort_order: 500 }] },
    });
    check("PATCH content reorder succeeds", reorder.status === 200 && reorder.json?.affected === 1, reorder);

    const addCol = await api("/api/admin/kanban/columns", {
      method: "POST",
      tenant: TEST_TENANT_SLUG,
      body: { board_key: "content", label: "QA-DELETE-ME Content Column" },
    });
    check("POST create content test column succeeds", addCol.status === 201, addCol);
    created.contentColumnKey = addCol.json?.column_key;
  }

  console.log(`\n=== Pipeline (tenant: ${TEST_TENANT_SLUG}) — role-driven business rules ===`);
  {
    const before = await api("/api/admin/revenue-os/pipeline", { tenant: TEST_TENANT_SLUG });
    check("GET pipeline succeeds", before.status === 200 && before.json?.schemaReady, before.json?.schemaReady);

    const created_ = await api("/api/admin/revenue-os/pipeline", {
      method: "POST",
      tenant: TEST_TENANT_SLUG,
      body: {
        name: "QA Delete Me",
        email: `qa-delete-me-${Date.now()}@example.invalid`,
        opportunityName: "QA-DELETE-ME kanban unification test opportunity",
        estimatedValue: 5000,
      },
    });
    check("POST create test opportunity succeeds", created_.status === 201, created_);
    const oppId = created_.json?.opportunity?.id;
    if (oppId) createdOpportunityIds.push(oppId);
    check("new opportunity starts at stage 'new'", created_.json?.opportunity?.stage === "new", created_.json);

    const lostNoReason = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: "lost" },
    });
    check(
      "moving to a lost-role stage without a reason is rejected",
      lostNoReason.status === 400,
      lostNoReason,
    );

    const lostWithReason = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: "lost", lossReason: "QA test — no real signal" },
    });
    check("moving to lost with a reason succeeds", lostWithReason.status === 200, lostWithReason);
    check("lost stage sets probability to 0", lostWithReason.json?.opportunity?.probability === 0, lostWithReason.json);
    check("lost stage sets closed_at", Boolean(lostWithReason.json?.opportunity?.closed_at), lostWithReason.json);
    check(
      "lost stage records the loss reason",
      lostWithReason.json?.opportunity?.loss_reason === "QA test — no real signal",
      lostWithReason.json,
    );

    const reopenNoReason = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: "contacted" },
    });
    check(
      "reopening a lost opportunity without a reason is rejected",
      reopenNoReason.status === 400,
      reopenNoReason,
    );

    const reopenWithReason = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: "contacted", reason: "QA test reopen", allowTerminalReopen: true },
    });
    check("reopening with a reason succeeds", reopenWithReason.status === 200, reopenWithReason);
    check("reopening clears closed_at", reopenWithReason.json?.opportunity?.closed_at === null, reopenWithReason.json);
    check("reopening clears loss_reason", reopenWithReason.json?.opportunity?.loss_reason === null, reopenWithReason.json);

    const addWonCol = await api("/api/admin/kanban/columns", {
      method: "POST",
      tenant: TEST_TENANT_SLUG,
      body: {
        board_key: "pipeline",
        label: "QA-DELETE-ME Custom Won",
        metadata: { role: "won", probability: 90 },
      },
    });
    check("POST create custom won-role stage succeeds", addWonCol.status === 201, addWonCol);
    if (addWonCol.json?.column_key) createdPipelineColumnKeys.push(addWonCol.json.column_key);

    const moveToCustomWon = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: addWonCol.json?.column_key },
    });
    check("moving into the custom won stage succeeds", moveToCustomWon.status === 200, moveToCustomWon);
    check(
      "custom stage's configured probability (90) takes effect",
      moveToCustomWon.json?.opportunity?.probability === 90,
      moveToCustomWon.json,
    );
    check(
      "won role auto-backfills won_value from estimated_value",
      Number(moveToCustomWon.json?.opportunity?.won_value) === 5000,
      moveToCustomWon.json,
    );
    check("won role sets closed_at", Boolean(moveToCustomWon.json?.opportunity?.closed_at), moveToCustomWon.json);

    const reorderResp = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: {
        reorder: [{ id: oppId, column_key: addWonCol.json?.column_key, sort_order: 250 }],
      },
    });
    check(
      "PATCH pipeline reorder (same-column drag) succeeds",
      reorderResp.status === 200 && reorderResp.json?.affected === 1,
      reorderResp,
    );

    // Cannot-delete-last-won-role-column guard: two won columns exist right
    // now (default "won" + our custom one). Deleting the custom one (now
    // empty, since the opportunity is still parked there — reassign it away
    // first) must succeed; deleting the LAST remaining won column must fail.
    const moveOffCustom = await api("/api/admin/revenue-os/pipeline", {
      method: "PATCH",
      tenant: TEST_TENANT_SLUG,
      body: { id: oppId, stage: "won" },
    });
    check("moving back to the default 'won' stage succeeds", moveOffCustom.status === 200, moveOffCustom);

    const deleteCustomWon = await api(
      `/api/admin/kanban/columns/${addWonCol.json?.column_key}?board_key=pipeline`,
      { method: "DELETE", tenant: TEST_TENANT_SLUG },
    );
    check(
      "deleting the now-empty custom won column succeeds (another won column remains)",
      deleteCustomWon.status === 200,
      deleteCustomWon,
    );
    createdPipelineColumnKeys.length = 0; // already gone, skip in cleanup

    const deleteLastWon = await api(
      "/api/admin/kanban/columns/won?board_key=pipeline",
      { method: "DELETE", tenant: TEST_TENANT_SLUG },
    );
    check(
      "deleting the LAST won-role column is refused",
      deleteLastWon.status === 409 && deleteLastWon.json?.error === "cannot_delete_last_role",
      deleteLastWon,
    );
  }
} finally {
  await cleanup();
}

console.log("\n=== Result ===");
console.log(JSON.stringify({ passed: failures.length === 0, failureCount: failures.length, failures }, null, 2));
if (failures.length) process.exit(1);

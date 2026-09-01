import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MemorySupabase } from "./lib/memory-supabase";
import {
  listAuditHistory,
  proposalAuditSummary,
  recordAudit,
  redactAuditValue,
} from "../src/lib/revenue-os/audit";

assert.equal(redactAuditValue("ya29.secret-access", "access_token"), "[redacted]");
assert.equal(redactAuditValue("re_live_abc", "note"), "[redacted]");
assert.equal(
  (
    redactAuditValue({ refresh_token: "abc", email: "a@example.com" }) as {
      refresh_token: string;
      email: string;
    }
  ).refresh_token,
  "[redacted]",
);
assert.equal(
  (redactAuditValue({ refresh_token: "abc", email: "a@example.com" }) as { email: string }).email,
  "a@example.com",
);
assert.equal(redactAuditValue("hello world", "summary"), "hello world");
assert.equal(redactAuditValue("secret-body", "body_text"), "[redacted]");
assert.equal(redactAuditValue("<html>secret</html>", "body_html"), "[redacted]");

const summary = proposalAuditSummary({
  title: "Westlake roof",
  status: "sent",
  client_name: "Westlake",
  total_one_time: 12000,
  total_monthly: 0,
  lead_id: "lead-1",
  opportunity_id: "opp-1",
  content: { sections: ["do not persist"] },
} as {
  title: string;
  status: string;
  client_name: string;
  total_one_time: number;
  total_monthly: number;
  lead_id: string;
  opportunity_id: string;
});
assert.equal(summary?.title, "Westlake roof");
assert.equal(summary?.status, "sent");
assert.equal(
  "content" in (summary ?? {}),
  false,
  "proposal audit summaries must omit document content",
);

async function main() {
  const ok = new MemorySupabase({ audit_log: [] });
  await recordAudit(ok.client, {
    actorEmail: "john@acceleratewith.us",
    action: "google.connected",
    entityType: "integration_connection",
    entityId: "google",
    metadata: { refresh_token: "should-not-persist", account: "john@acceleratewith.us" },
  });
  const row = ok.rows("audit_log")[0]!;
  assert.equal((row.metadata as { refresh_token: string }).refresh_token, "[redacted]");
  assert.equal((row.metadata as { account: string }).account, "john@acceleratewith.us");
  assert.equal(typeof row.created_at, "string");

  const broken = new MemorySupabase({ audit_log: [] });
  broken.fail("audit_log", { message: "audit_log unavailable" });
  await assert.rejects(
    () => recordAudit(broken.client, { action: "opportunity.updated", entityType: "opportunity" }),
    /Audit write failed/,
  );
  await assert.rejects(() => listAuditHistory(broken.client, {}), /Audit read failed/);

  const listed = new MemorySupabase({
    audit_log: [
      {
        id: "a1",
        actor_email: "john@acceleratewith.us",
        action: "proposal.created",
        entity_type: "proposal",
        entity_id: "p1",
        source: "admin",
        before_state: null,
        after_state: { status: "draft" },
        metadata: {},
        created_at: "2026-08-01T12:00:00.000Z",
      },
      {
        id: "a2",
        actor_email: "system@acceleratewith.us",
        action: "calendar.synced",
        entity_type: "integration",
        entity_id: "google_calendar",
        source: "automation",
        before_state: null,
        after_state: { stored: 3 },
        metadata: {},
        created_at: "2026-08-15T12:00:00.000Z",
      },
      {
        id: "a3",
        actor_email: null,
        action: "proposal.viewed",
        entity_type: "proposal",
        entity_id: "p1",
        source: "public",
        before_state: { status: "sent" },
        after_state: { status: "viewed" },
        metadata: {},
        created_at: "2026-08-20T12:00:00.000Z",
      },
      {
        id: "a4",
        actor_email: "john@acceleratewith.us",
        action: "settings.updated",
        entity_type: "admin_settings",
        entity_id: "BOOKING_MODE",
        source: "admin",
        before_state: { configured: false },
        after_state: { configured: true },
        metadata: {},
        created_at: "2026-08-21T12:00:00.000Z",
      },
    ],
  });
  const byActor = await listAuditHistory(listed.client, { actor: "john@acceleratewith.us" });
  assert.deepEqual(
    byActor.entries.map((entry) => entry.id),
    ["a4", "a1"],
  );
  const byEntity = await listAuditHistory(listed.client, { entityType: "proposal" });
  assert.deepEqual(
    byEntity.entries.map((entry) => entry.action),
    ["proposal.viewed", "proposal.created"],
  );
  const bySource = await listAuditHistory(listed.client, { source: "automation" });
  assert.equal(bySource.entries.length, 1);
  assert.equal(bySource.entries[0]?.action, "calendar.synced");
  const byAction = await listAuditHistory(listed.client, { action: "settings.updated" });
  assert.equal(byAction.entries[0]?.entityId, "BOOKING_MODE");
  assert.equal("value" in ((byAction.entries[0]?.after as object) ?? {}), false);
  const byDate = await listAuditHistory(listed.client, { from: "2026-08-18", to: "2026-08-21" });
  assert.deepEqual(
    byDate.entries.map((entry) => entry.id),
    ["a4", "a3"],
  );
  assert.ok(byDate.filterOptions.actions.includes("calendar.synced"));
  assert.ok(byDate.filterOptions.sources.includes("public"));
  await assert.rejects(() => listAuditHistory(listed.client, { from: "08-18-2026" }), /YYYY-MM-DD/);

  const coverage = {
    activityApi: readFileSync("src/app/api/admin/activity/route.ts", "utf8"),
    activityPage: readFileSync("src/app/admin/activity/page.tsx", "utf8"),
    proposals: readFileSync("src/app/api/admin/proposals/route.ts", "utf8"),
    publicProposal: readFileSync("src/app/api/proposal/[token]/route.ts", "utf8"),
    settings: readFileSync("src/app/api/admin/settings/route.ts", "utf8"),
    calendar: readFileSync("src/lib/revenue-os/google.ts", "utf8"),
    features: readFileSync("src/app/api/admin/features/route.ts", "utf8"),
    demo: readFileSync("src/lib/admin/demo/runtime.ts", "utf8"),
  };
  assert.match(coverage.activityApi, /listAuditHistory/, "Activity API must read the audit ledger");
  assert.match(coverage.activityApi, /requireAdmin/, "Activity API must remain founder-only");
  assert.match(
    coverage.activityPage,
    /actor[\s\S]*entity[\s\S]*action[\s\S]*source/,
    "Activity page must expose actor, entity, action, and source filters",
  );
  assert.match(coverage.activityPage, /type="date"/, "Activity page must expose date filters");
  assert.match(coverage.activityPage, /searchParams/, "Activity filters must be query-backed");
  assert.match(coverage.proposals, /proposal\.created/);
  assert.match(coverage.proposals, /proposalAuditSummary/);
  assert.doesNotMatch(
    coverage.proposals,
    /after:\s*data/,
    "Proposal audit must not persist the full proposal document",
  );
  assert.match(coverage.publicProposal, /proposal\.viewed/);
  assert.match(
    coverage.publicProposal,
    /Proposal view audit failed/,
    "A public view must still return after an audit write failure",
  );
  assert.match(coverage.publicProposal, /proposal\.accepted/);
  assert.match(
    coverage.publicProposal,
    /has_reason/,
    "Decline reasons stay out of the audit payload",
  );
  assert.match(coverage.settings, /settings\.updated/);
  assert.match(coverage.settings, /configured: Boolean/);
  assert.doesNotMatch(
    coverage.settings,
    /after:\s*\{[^}]*\bvalue\s*:/,
    "Settings audit must not persist setting values",
  );
  assert.match(coverage.calendar, /calendar\.synced/);
  const calendarAudit = coverage.calendar.slice(
    coverage.calendar.indexOf('action: "calendar.synced"'),
  );
  assert.doesNotMatch(
    calendarAudit.slice(0, 900),
    /attendees/,
    "Calendar audit summaries must not include attendee payloads",
  );
  assert.match(coverage.features, /feature\.updated/);
  assert.match(coverage.demo, /auditHistory\(/);
  assert.doesNotMatch(coverage.demo, /type: \["lead", "email", "task", "proposal"\]/);

  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "redact-token-keys",
          "redact-provider-prefixes",
          "redact-message-bodies",
          "preserve-safe-fields",
          "proposal-summary-omits-content",
          "write-redacted-row",
          "audit-failure-throws",
          "list-failure-throws",
          "filter-actor-entity-action-source-date",
          "invalid-date-rejected",
          "mutation-coverage",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

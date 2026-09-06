#!/usr/bin/env tsx
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyProposalWrite,
  assertProposalTransition,
  canTransitionProposal,
  decideProposal,
  isMaterialProposalChange,
  recordProposalView,
  sendProposal,
} from "../src/lib/revenue-os/proposals";

type Row = Record<string, unknown>;

function stubSupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    proposals: [],
    proposal_events: [],
    audit_log: [],
    activities: [],
    tasks: [],
    admin_notifications: [],
    opportunities: [],
    kanban_columns: [
      "new",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ].map((key, index) => ({
      column_key: key,
      board_key: "pipeline",
      tenant_id: "t1",
      label: key,
      is_default: key === "new",
      sort_order: index * 1000,
      metadata: { role: key === "won" ? "won" : key === "lost" ? "lost" : "open", probability: 50 },
    })),
    stage_events: [],
    ...seed,
  };

  function query(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let pendingInsert: Row | Row[] | null = null;
    let pendingUpdate: Row | null = null;
    let one = false;
    const self: Record<string, unknown> = {};
    const chain = () => self;
    self.select = chain;
    self.eq = (field: string, value: unknown) => {
      filters.push((row) => row[field] === value);
      return self;
    };
    self.in = (field: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[field]));
      return self;
    };
    self.order = chain;
    self.maybeSingle = () => {
      one = true;
      return self;
    };
    self.single = () => {
      one = true;
      return self;
    };
    self.insert = (payload: Row | Row[]) => {
      pendingInsert = payload;
      return self;
    };
    self.update = (payload: Row) => {
      pendingUpdate = payload;
      return self;
    };
    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      tables[table] ??= [];
      if (pendingInsert) {
        const rows = Array.isArray(pendingInsert) ? pendingInsert : [pendingInsert];
        const stored = rows.map((row, index) => ({
          id: row.id || `${table}-${tables[table]!.length + index + 1}`,
          created_at: new Date().toISOString(),
          ...row,
        }));
        tables[table]!.push(...stored);
        return resolve({ data: one ? stored[0] : stored, error: null });
      }
      if (pendingUpdate) {
        const matching = tables[table]!.filter((row) => filters.every((filter) => filter(row)));
        for (const row of matching) Object.assign(row, pendingUpdate, { updated_at: new Date().toISOString() });
        return resolve({ data: one ? (matching[0] ?? null) : matching, error: null });
      }
      const matching = tables[table]!.filter((row) => filters.every((filter) => filter(row)));
      return resolve({ data: one ? (matching[0] ?? null) : matching, error: null });
    };
    return self;
  }

  return {
    client: { from: (table: string) => query(table) } as unknown as SupabaseClient,
    tables,
  };
}

async function main() {
assert.equal(canTransitionProposal("draft", "sent"), true);
assert.equal(canTransitionProposal("sent", "viewed"), true);
assert.equal(canTransitionProposal("accepted", "draft"), false);
assert.throws(() => assertProposalTransition("accepted", "sent"));
assert.equal(
  isMaterialProposalChange({ title: "A", content: {} }, { title: "B" }),
  true,
);
assert.equal(isMaterialProposalChange({ title: "A" }, { status: "sent" }), false);

{
  const stub = stubSupabase({
    proposals: [
      {
        id: "p1",
        status: "draft",
        version: 1,
        title: "Plan",
        client_name: "Apex",
        content: { sections: [] },
        total_one_time: 1000,
        total_monthly: 0,
        opportunity_id: null,
      },
    ],
  });
  const sent = await sendProposal(stub.client, { id: "p1", actorEmail: "founder@example.com" });
  assert.equal(sent.status, "sent");
  const again = await sendProposal(stub.client, { id: "p1", actorEmail: "founder@example.com" });
  assert.equal(again.status, "sent");
  assert.equal(stub.tables.proposal_events?.filter((row) => row.event_type === "sent").length, 1);

  const viewed = await recordProposalView(stub.client, { id: "p1" });
  assert.equal(viewed.proposal.status, "viewed");
  assert.equal(viewed.alreadyViewed, false);
  const viewedAgain = await recordProposalView(stub.client, { id: "p1" });
  assert.equal(viewedAgain.alreadyViewed, true);
}

{
  const stub = stubSupabase({
    proposals: [
      {
        id: "p2",
        status: "viewed",
        version: 1,
        title: "Plan",
        client_name: "Apex",
        opportunity_id: "opp-1",
        viewed_at: new Date().toISOString(),
      },
    ],
    opportunities: [{ id: "opp-1", tenant_id: "t1", stage: "proposal", probability: 70, estimated_value: 1000, won_value: 0 }],
  });
  const first = await decideProposal(stub.client, {
    id: "p2",
    decision: "accepted",
    actorEmail: "public_link",
    source: "public_link",
  });
  assert.equal(first.alreadyResponded, false);
  assert.equal(first.proposal.status, "accepted");
  const replay = await decideProposal(stub.client, {
    id: "p2",
    decision: "accepted",
    actorEmail: "public_link",
    source: "public_link",
  });
  assert.equal(replay.alreadyResponded, true);
  assert.equal(stub.tables.opportunities?.[0]?.stage, "negotiation");
  assert.equal(stub.tables.proposal_events?.some((row) => row.event_type === "accepted"), true);
}

{
  const stub = stubSupabase({
    proposals: [
      {
        id: "p3",
        status: "sent",
        version: 1,
        title: "Plan",
        client_name: "Apex",
        content: { sections: ["a"] },
        total_one_time: 1000,
        total_monthly: 0,
        lead_id: null,
        opportunity_id: null,
        share_token: "old-token",
      },
    ],
  });
  const successor = await applyProposalWrite(stub.client, {
    id: "p3",
    actorEmail: "founder@example.com",
    patch: { title: "Plan v2", total_one_time: 1500 },
  });
  assert.equal(successor.status, "draft");
  assert.equal(successor.version, 2);
  assert.equal(successor.supersedes_id, "p3");
  assert.equal(stub.tables.proposals?.find((row) => row.id === "p3")?.status, "superseded");
  await assert.rejects(
    () =>
      applyProposalWrite(stub.client, {
        id: "p3",
        actorEmail: "founder@example.com",
        patch: { title: "Nope" },
      }),
    /cannot be edited/i,
  );
}

{
  const stub = stubSupabase({
    proposals: [
      {
        id: "p4",
        status: "accepted",
        version: 1,
        title: "Plan",
        client_name: "Apex",
      },
    ],
  });
  await assert.rejects(
    () =>
      applyProposalWrite(stub.client, {
        id: "p4",
        actorEmail: "founder@example.com",
        patch: { title: "Edit accepted" },
      }),
    /cannot be edited/i,
  );
}

console.log("proposal lifecycle tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

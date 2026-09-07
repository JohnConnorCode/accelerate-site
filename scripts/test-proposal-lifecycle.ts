#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  applyProposalWrite,
  canTransitionProposal,
  assertProposalTransition,
  isMaterialProposalChange,
  recordProposalView,
  sendProposal,
} from "../src/lib/revenue-os/proposals";

async function main() {
  assert.equal(canTransitionProposal("draft", "sent"), true);
  assert.equal(canTransitionProposal("sent", "viewed"), true);
  for (const terminal of ["accepted", "declined", "expired", "superseded"]) {
    assert.throws(() => assertProposalTransition(terminal, "sent"));
    assert.equal(canTransitionProposal(terminal, "draft"), false);
  }
  assert.equal(isMaterialProposalChange({ title: "A", content: {} }, { title: "B" }), true);
  assert.equal(isMaterialProposalChange({ title: "A" }, { status: "sent" }), false);
  const tenant = randomUUID(),
    id = randomUUID(),
    successorId = randomUUID();
  const current = {
    id,
    tenant_id: tenant,
    title: "Plan",
    status: "draft",
    version: 1,
    updated_at: new Date().toISOString(),
    content: {},
  };
  const mem = new MemorySupabase({ proposals: [current] });
  const db = bindTenantDatabase(mem.client, tenant, true);
  const calls: Array<Record<string, unknown>> = [];
  mem.rpc("apply_proposal_lifecycle", (args) => {
    calls.push(args);
    const command = args.p_command as Record<string, unknown>;
    return {
      proposal: { ...current, status: "sent" },
      successor:
        command.operation === "revise"
          ? { ...current, id: successorId, status: "draft", version: 2, supersedes_id: id }
          : null,
      changed: true,
      replayed: false,
    };
  });
  await assert.rejects(() => recordProposalView(db, { id }), /not shared/);
  assert.equal(calls.length, 0, "draft sharing must refuse before a write");
  assert.equal(
    (await sendProposal(db, { id, actorEmail: "operator@example.test" })).status,
    "sent",
  );
  await sendProposal(db, { id, actorEmail: "operator@example.test" });
  assert.equal(calls[0]!.p_key, calls[1]!.p_key, "identical requests carry the same durable key");
  assert.equal((calls[0]!.p_command as Record<string, unknown>).operation, "send");
  mem.tables.proposals![0]!.status = "sent";
  const revised = await applyProposalWrite(db, {
    id,
    actorEmail: "operator@example.test",
    patch: { title: "Updated" },
  });
  assert.equal(
    revised.id,
    successorId,
    "adapters receive the successor, not the superseded record",
  );
  assert.equal(
    (calls.at(-1)!.p_command as Record<string, unknown>).expectedUpdatedAt,
    current.updated_at,
  );
  await assert.rejects(() =>
    applyProposalWrite(db, {
      id,
      actorEmail: "operator@example.test",
      patch: { total_monthly: -1 },
    }),
  );
  await assert.rejects(
    () =>
      applyProposalWrite(bindTenantDatabase(mem.client, randomUUID(), true), {
        id,
        actorEmail: "operator@example.test",
        patch: { title: "Foreign" },
      }),
    /not found/,
  );
  mem.rpc("apply_proposal_lifecycle", () => {
    throw new Error("database audit unavailable");
  });
  await assert.rejects(
    () => sendProposal(db, { id, actorEmail: "operator@example.test" }),
    /audit unavailable/,
  );
  console.log(
    "PASS: proposal adapters preserve transaction keys, successor identity, freshness, validation, tenant scope and failure; native PostgreSQL suite proves transaction/replay behavior.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

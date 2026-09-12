import assert from "node:assert/strict";
import {
  decisionDedupeKey,
  flagDecisionConflicts,
  listDecisions,
  recordDecision,
} from "../src/lib/revenue-os/decision-memory";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

function db() {
  const mem = new MemorySupabase({
    decisions: [],
    audit_log: [],
  });
  return { mem, client: mem.client as never };
}

(async () => {
  // AC1: full record with lineage fields.
  {
    const { mem, client } = db();
    const d = await recordDecision(client, {
      title: "Open-source the core runtime",
      decision:
        "Command Center core becomes free and open source; revenue comes from implementation, hosting and premium plugins.",
      why: "Reduce adoption friction and create ecosystem distribution.",
      ownerEmail: "founder@example.com",
      evidence: { sources: ["adoption analysis"] },
      implications: { website: "messaging changes", roadmap: "prioritize plugins" },
      actorEmail: "founder@example.com",
    });
    // Unset nullable columns read back undefined in the fixture and NULL in
    // production; assert absence loosely in both worlds.
    assert.ok(d.supersedes_id == null);
    assert.ok(d.superseded_at == null);
    assert.deepEqual(d.implications, {
      website: "messaging changes",
      roadmap: "prioritize plugins",
    });
    assert.equal(d.dedupe_key, decisionDedupeKey({ title: d.title, decision: d.decision }));
    assert.equal(mem.rows("decisions").length, 1);
  }

  // Duplicates collapse; invalid input fails closed.
  {
    const { mem, client } = db();
    const first = await recordDecision(client, { title: "Free core", decision: "Core is free." });
    const second = await recordDecision(client, {
      title: "  free CORE ",
      decision: "Core   is free.",
    });
    assert.equal(second.id, first.id);
    assert.equal(mem.rows("decisions").length, 1);
    await assert.rejects(
      () => recordDecision(client, { title: "  ", decision: "x" }),
      /must not be empty/,
    );
    await assert.rejects(
      () => recordDecision(client, { title: "x", decision: "  " }),
      /must not be empty/,
    );
    await assert.rejects(
      () => recordDecision(client, { title: "x", decision: "y", supersedesId: "nope" }),
      /must be a valid UUID/,
    );
    await assert.rejects(
      () =>
        recordDecision(client, {
          title: "x",
          decision: "y",
          supersedesId: "00000000-0000-4000-8000-000000000000",
        }),
      /not found/,
    );
  }

  // AC2: supersede chain stays readable with forward links.
  {
    const { mem, client } = db();
    const v1 = await recordDecision(client, { title: "Pricing", decision: "Subscription first." });
    const v2 = await recordDecision(client, {
      title: "Pricing change",
      decision: "Usage-based billing.",
      supersedesId: v1.id,
    });
    assert.equal(v2.supersedes_id, v1.id);
    const old = mem.rows("decisions").find((r) => r.id === v1.id);
    assert.equal(old?.superseded_by, v2.id);
    assert.ok(old?.superseded_at);
    // Superseding an already-superseded decision is refused.
    await assert.rejects(
      () =>
        recordDecision(client, { title: "Pricing v3", decision: "Other.", supersedesId: v1.id }),
      /already superseded/,
    );
    const active = await listDecisions(client, {});
    assert.equal(active.length, 1);
    assert.equal(active[0]?.id, v2.id);
    const history = await listDecisions(client, { includeHistory: true });
    assert.equal(history.length, 2);
  }

  // AC3: conflicts surface without auto-applying.
  {
    const conflicts = flagDecisionConflicts(
      {
        title: "Proposal policy",
        decision: "Every proposal must lead with measurable business problems.",
      },
      [
        { id: "p1", rule: "Proposals lead with measurable business problems always." },
        { id: "p2", rule: "Unrelated billing reminder cadence." },
      ],
    );
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.id, "p1");
    assert.ok((conflicts[0]?.overlapTerms.length ?? 0) >= 2);
    // Single shared significant term is not a conflict.
    assert.equal(
      flagDecisionConflicts({ title: "Note", decision: "Send the proposal tomorrow." }, [
        { id: "p9", rule: "Archive old proposal drafts monthly." },
      ]).length,
      0,
    );
  }

  console.log(JSON.stringify({ result: "decision-memory coverage added", checks: 8 }));
})();

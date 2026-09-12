import assert from "node:assert/strict";
import {
  diffDrafts,
  fileCandidate,
  fileMarkedCorrection,
} from "../src/lib/revenue-os/correction-capture";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

function db() {
  const mem = new MemorySupabase({
    learning_proposals: [],
    learned_policies: [],
    action_queue: [],
    audit_log: [],
    activities: [],
  });
  return { mem, client: mem.client as never };
}

(async () => {
  // AC1: explicit user-marked corrections become typed, sourced proposals.
  {
    const { mem, client } = db();
    const p = await fileMarkedCorrection(client, {
      type: "positioning_policy",
      rule: "Lead with operational problems, never AI capabilities.",
      rationale: "Founder marked this correction twice this week.",
      confidence: "high",
      sourceRefs: { conversationId: "conv-1" },
      actorEmail: "founder@example.com",
    });
    assert.equal(p.status, "proposed");
    assert.equal(p.confidence, "high");
    assert.deepEqual((p.source_refs as Record<string, unknown>).origin, "user-marked");
    assert.deepEqual((p.source_refs as Record<string, unknown>).conversationId, "conv-1");
    assert.equal(mem.rows("learned_policies").length, 0);
  }

  // AC2: draft diffs yield deduplicated candidates without filing anything.
  {
    const { mem, client } = db();
    const candidate = diffDrafts({
      before: "We are an AI agency. We do great AI. Contact us today.",
      after: "We build software infrastructure for businesses. Contact us today.",
    });
    assert.ok(candidate);
    assert.equal(candidate?.suggestedConfidence, "low");
    assert.ok((candidate?.addedSegments.length ?? 0) > 0);
    assert.ok((candidate?.removedSegments.length ?? 0) > 0);
    assert.equal(mem.rows("learning_proposals").length, 0);
    assert.equal(mem.rows("learned_policies").length, 0);

    // Filing the candidate creates exactly one proposal; refiling collapses.
    const first = await fileCandidate(client, candidate!, { actorEmail: "founder@example.com" });
    assert.equal(first.status, "proposed");
    const second = await fileCandidate(client, candidate!, { actorEmail: "founder@example.com" });
    assert.equal(second.id, first.id);
    assert.equal(mem.rows("learning_proposals").length, 1);
  }

  // AC3: empty, identical and whitespace-only diffs yield no candidate;
  // invalid input throws; low-confidence output never auto-files.
  {
    const { mem, client } = db();
    assert.equal(diffDrafts({ before: "Same words here.", after: "Same words here." }), null);
    assert.equal(diffDrafts({ before: "   ", after: "   " }), null);
    assert.equal(diffDrafts({ before: "Keep this.", after: "Keep this. " }), null);
    await assert.rejects(
      () =>
        fileMarkedCorrection(client, {
          type: "messaging",
          rule: "   ",
        }),
      /must not be empty/,
    );
    assert.throws(
      () => diffDrafts({ before: 42 as unknown as string, after: "x" }),
      /must be strings/,
    );
    assert.equal(mem.rows("learning_proposals").length, 0);
    assert.equal(mem.rows("learned_policies").length, 0);
  }

  console.log(JSON.stringify({ result: "correction-capture coverage added", checks: 8 }));
})();

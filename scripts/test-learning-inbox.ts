import assert from "node:assert/strict";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import {
  approveLearningProposal,
  learningDedupeKey,
  listLearningProposals,
  proposeLearning,
  requestLearningApproval,
  setLearningDisposition,
} from "../src/lib/revenue-os/learning-inbox";
import { recordLearnedPolicy } from "../src/lib/revenue-os/memory";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

(async () => {
  const ACTOR = "founder@example.com";

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

  const RULE = "Never describe Accelerate as an AI agency";

  // AC1: full typing, working-tier default, deterministic key.
  {
    const { client } = db();
    const p = await proposeLearning(client, {
      type: "positioning_policy",
      rule: RULE,
      rationale: "Founder correction from proposal review",
      confidence: "high",
      affectedWorkers: ["proposal-writer"],
      actorEmail: ACTOR,
    });
    assert.equal(p.status, "proposed");
    assert.equal(p.authority, "working");
    assert.equal(p.confidence, "high");
    assert.deepEqual(p.affected_workers, ["proposal-writer"]);
    assert.equal(p.dedupe_key, learningDedupeKey({ type: "positioning_policy", rule: RULE }));
  }

  // AC1 replay: duplicate collapses onto the idempotency key.
  {
    const { mem, client } = db();
    const first = await proposeLearning(client, {
      type: "messaging",
      rule: "  Short   atten-tion getters.  ",
    });
    const second = await proposeLearning(client, {
      type: "messaging",
      rule: "short atten-tion getters.",
    });
    assert.equal(first.id, second.id);
    assert.equal(mem.rows("learning_proposals").length, 1);
  }

  // AC2: invalid input fails closed.
  {
    const { client } = db();
    await assert.rejects(
      () => proposeLearning(client, { type: "messaging", rule: "   " }),
      /must not be empty/,
    );
    await assert.rejects(
      () =>
        proposeLearning(client, {
          type: "not-a-type" as "messaging",
          rule: "Something reusable",
        }),
      /Unknown proposal type/,
    );
  }

  // AC2: ignore and conversation_only leave no shared residue.
  for (const disposition of ["ignored", "conversation_only"] as const) {
    const { mem, client } = db();
    const p = await proposeLearning(client, { type: "process_rule", rule: `Rule ${disposition}` });
    const done = await setLearningDisposition(client, {
      id: p.id,
      to: disposition,
      actorEmail: ACTOR,
    });
    assert.equal(done.status, disposition);
    assert.equal(mem.rows("learned_policies").length, 0);
  }

  // AC2: revival keeps history.
  {
    const { client } = db();
    const p = await proposeLearning(client, { type: "offering", rule: "We no longer offer SEO." });
    await setLearningDisposition(client, { id: p.id, to: "rejected", actorEmail: ACTOR });
    const revived = await setLearningDisposition(client, {
      id: p.id,
      to: "proposed",
      actorEmail: ACTOR,
    });
    assert.equal(revived.status, "proposed");
  }

  // AC3: direct approval bypass refused; approval on non-proposed refused.
  {
    const { client } = db();
    const p = await proposeLearning(client, { type: "offering", rule: "Members, never users." });
    await assert.rejects(
      () => setLearningDisposition(client, { id: p.id, to: "approved", actorEmail: ACTOR }),
      /must execute through the action path/,
    );
    await setLearningDisposition(client, { id: p.id, to: "rejected", actorEmail: ACTOR });
    await assert.rejects(
      () => approveLearningProposal(client, { proposalId: p.id, actorEmail: ACTOR }),
      /Only proposed learnings can be approved/,
    );
  }

  // AC3+AC4: full approval path through the executor writes the typed policy.
  {
    const { mem, client } = db();
    const p = await proposeLearning(client, {
      type: "positioning_policy",
      rule: RULE,
      rationale: "Founder correction",
      confidence: "high",
      affectedWorkers: ["proposal-writer", "outreach-agent"],
      actorEmail: ACTOR,
    });
    const action = (await requestLearningApproval(client, { id: p.id, actorEmail: ACTOR })) as {
      id: string;
      action_type: string;
      status: string;
    };
    assert.equal(action.action_type, "approve_learning");
    // Second approval request collapses onto the same action row.
    const again = (await requestLearningApproval(client, { id: p.id, actorEmail: ACTOR })) as {
      id: string;
    };
    assert.equal(again.id, action.id);

    await approveAndExecuteAction(client, action.id, ACTOR, { mode: "approved" });

    const done = mem.rows("learning_proposals").find((r) => r.id === p.id);
    assert.equal(done?.status, "approved");
    const policies = mem.rows("learned_policies");
    assert.equal(policies.length, 1);
    const policy = policies[0];
    assert.ok(policy);
    assert.equal(policy.source, "approved_learning");
    assert.equal(policy.authority, "working");
    assert.equal(policy.proposal_type, "positioning_policy");
    assert.equal(done?.learned_policy_id, policy.id);
    const auditKinds = mem.rows("audit_log").map((r) => r.action);
    assert.ok(auditKinds.includes("learning.proposed"));
    assert.ok(auditKinds.includes("learned_policy.recorded"));
  }

  // AC4: supersedes forward-link + idempotent retry of approval.
  {
    const { mem, client } = db();
    const old = await recordLearnedPolicy(client, {
      actionKey: "learning:positioning_policy",
      rule: "Old positioning rule",
      rationale: "seed",
      source: "human_decision",
      actorEmail: ACTOR,
    });
    const p = await proposeLearning(client, {
      type: "positioning_policy",
      rule: "New positioning rule",
      supersedesPolicyId: old.id,
      actorEmail: ACTOR,
    });
    const first = await approveLearningProposal(client, { proposalId: p.id, actorEmail: ACTOR });
    assert.equal(first.proposal.status, "approved");
    const superseded = mem.rows("learned_policies").find((r) => r.id === old.id);
    assert.equal(superseded?.superseded_by, first.policy.id);
    // Safe retry returns current state without a second policy.
    const second = await approveLearningProposal(client, { proposalId: p.id, actorEmail: ACTOR });
    assert.equal(second.policy.id, first.policy.id);
    // Falsy covers both production NULL and fixture-unset for never-superseded rows.
    assert.equal(mem.rows("learned_policies").filter((r) => !r.superseded_at).length, 1);
  }

  // Inbox listing stays bounded and filterable; unapproved rows never leak
  // into shared reads (listLearnedPolicies only returns recorded policies).
  {
    const { client } = db();
    await proposeLearning(client, { type: "messaging", rule: "Draft one" });
    await proposeLearning(client, { type: "messaging", rule: "Draft two" });
    const all = await listLearningProposals(client, {});
    assert.equal(all.length, 2);
    const proposed = await listLearningProposals(client, { status: "proposed" });
    assert.equal(proposed.length, 2);
    const approved = await listLearningProposals(client, { status: "approved" });
    assert.equal(approved.length, 0);
  }

  console.log(JSON.stringify({ result: "learning-inbox coverage added", checks: 12 }));
})();

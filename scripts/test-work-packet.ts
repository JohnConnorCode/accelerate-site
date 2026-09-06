import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  mutateWorkBoard,
  listWorkBoard,
  workSpecSchema,
  type WorkActor,
} from "../src/lib/revenue-os/work-board";
import {
  compareWorkOrder,
  formatWorkPacket,
  workPacket,
  needsSpecification,
  demoPacketProblems,
} from "../src/lib/work-packet";
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const project = `qa-packet-${randomUUID().slice(0, 8)}`;
  const actor: WorkActor = {
    id: `test:${project}`,
    projects: [project],
    scopes: ["*"],
    reviewer: true,
  };
  const ids: string[] = [];
  const tokens = new Map<string, string>();
  const call = (
    operation: string,
    id?: string,
    payload: Record<string, unknown> = {},
    revision?: number,
  ) => mutateWorkBoard(db, actor, { operation, id, revision, requestKey: randomUUID(), payload });
  const spec = workSpecSchema.parse({
    packetVersion: 2,
    northstar: { phase: "A", layers: ["See", "Act"], contribution: "Controlled workflow evidence" },
    businessValue: "Prove safe work pickup",
    currentBehavior: "Controlled packet fixture",
    scope: ["Work protocol only"],
    exclusions: ["No business records"],
    references: [{ path: "scripts/test-work-packet.ts", reason: "Isolated fixture" }],
    repository: {
      url: "https://example.test/repo",
      baseBranch: "test",
      baseCommit: "a".repeat(40),
    },
    workflow: ["Run controlled work"],
    failureModes: ["Fail closed on incomplete evidence"],
    requiredCapabilities: [],
    acceptance: [
      {
        id: "AC1",
        criterion: "An integration receipt exists",
        environment: "controlled-integration",
      },
    ],
    verification: [
      {
        command: "npm run test:work-packet",
        expected: "Pass isolated fixture",
        environment: "controlled-integration",
      },
    ],
  });
  async function create(title: string, payload: Record<string, unknown> = {}) {
    const { card } = await call("create", undefined, {
      project_key: project,
      title,
      description: "Controlled work packet fixture",
      acceptance_criteria: "- Prove the bounded test outcome",
      work_kind: "feature",
      labels: ["milestone:later"],
      ...payload,
    });
    ids.push(card.id);
    return card;
  }
  try {
    const incomplete = await create("Incomplete");
    const read = (await listWorkBoard(db, actor, { id: incomplete.id })).features[0]!;
    assert.ok(needsSpecification(read));
    await assert.rejects(
      call("claim", incomplete.id, { claimToken: randomBytes(32).toString("base64url") }),
      /missing_/,
    );
    const invalid = await db.rpc("work_packet_problems", {
      s: { ...spec, acceptance: [spec.acceptance![0], spec.acceptance![0]], scope: [" "] },
    });
    assert.ok(invalid.data.includes("invalid_acceptance_ids_or_environment"));
    assert.ok(invalid.data.includes("invalid_scope"));
    assert.deepEqual(
      demoPacketProblems({
        ...spec,
        acceptance: [spec.acceptance![0], spec.acceptance![0]],
        scope: [" "],
      }).sort(),
      invalid.data.sort(),
    );
    const empty = await db.rpc("work_packet_problems", { s: {} });
    assert.deepEqual(demoPacketProblems({}).sort(), empty.data.sort());
    const now = await create("Now first", {
      work_spec: spec,
      labels: ["milestone:now"],
      priority: "low",
    });
    const next = await create("Next urgent", {
      work_spec: spec,
      labels: ["milestone:next"],
      priority: "urgent",
    });
    const first = (await listWorkBoard(db, actor, { limit: 1 })).features[0]!;
    assert.equal(first.id, now.id, "Order before pagination must match dispatch");
    assert.ok(compareWorkOrder(now, next) < 0);
    const claimToken = randomBytes(32).toString("base64url");
    tokens.set(now.id, claimToken);
    const claimed = await call("claim", undefined, { claimToken });
    assert.equal(claimed.card.id, now.id);
    const evidence = {
      summary: "Controlled evidence environment test",
      commitSha: "a".repeat(40),
      checks: [
        {
          name: "integration",
          acceptanceId: "AC1",
          status: "passed",
          environment: "local",
          evidence: "Mock result",
        },
      ],
    };
    await assert.rejects(call("submit", now.id, { claimToken, evidence }), /required environment/);
    const submitted = await call("submit", now.id, {
      claimToken,
      evidence: {
        ...evidence,
        checks: [
          {
            ...evidence.checks[0],
            environment: "controlled-integration",
            evidence: "Controlled database receipt",
          },
        ],
      },
    });
    assert.equal(submitted.card.status, "in_review");
    await call(
      "review",
      now.id,
      { accept: true, message: "Accept controlled test evidence separately from delivery" },
      submitted.card.revision,
    );
    const initiative = await create("Aggregate outcome", { work_kind: "initiative" });
    const linked = await call(
      "dependencies",
      initiative.id,
      { dependencies: [next.id] },
      initiative.revision,
    );
    await assert.rejects(
      call("claim", initiative.id, { claimToken: randomBytes(32).toString("base64url") }),
      /initiative_not_executable/,
    );
    await assert.rejects(
      call(
        "review",
        initiative.id,
        { accept: true, message: "Review controlled aggregate outcome" },
        linked.card.revision,
      ),
      /verified children/,
    );
    const relinked = await call(
      "dependencies",
      initiative.id,
      { dependencies: [now.id] },
      linked.card.revision,
    );
    const accepted = await call(
      "review",
      initiative.id,
      { accept: true, message: "Accept verified child evidence for controlled aggregate" },
      relinked.card.revision,
    );
    assert.equal(accepted.card.status, "shipped");
    assert.equal(accepted.card.work_delivery.mergedAt, undefined);
    const text = formatWorkPacket({ ...read, work_spec: spec });
    for (const part of ["NORTHSTAR", "REPOSITORY", "WORKFLOW", "ACCEPTANCE", "VERIFICATION"])
      assert.ok(text.includes(part));
    assert.ok(!JSON.stringify(workPacket(read)).includes("claim_token_hash"));
    console.log(
      "PASS packet completeness, invalid definitions, list/claim pagination order, environment evidence, initiative review, and readable/JSON pickup.",
    );
  } finally {
    for (const id of ids) {
      let c = (await listWorkBoard(db, actor, { id })).features[0]!;
      if (c.status === "in_progress")
        c = (await call("release", id, { claimToken: tokens.get(id) })).card;
      if (c.status === "in_review")
        c = (await call("reopen", id, { message: "Clean up controlled packet test" }, c.revision))
          .card;
      await call("archive", id, { message: "Archive controlled packet fixture" }, c.revision);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

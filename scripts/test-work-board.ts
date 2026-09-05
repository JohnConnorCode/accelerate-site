import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  mutateWorkBoard,
  listWorkBoard,
  validateWorkMutation,
  authenticateWorkAgent,
  issueWorkAgent,
  type WorkActor,
} from "../src/lib/revenue-os/work-board";
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const project = `qa-work-${randomUUID().slice(0, 8)}`;
  const actor: WorkActor = {
    id: `test:${project}`,
    projects: [project],
    scopes: ["*"],
    reviewer: true,
  };
  const cards: string[] = [];
  async function call(
    operation: string,
    id?: string,
    payload: Record<string, unknown> = {},
    revision?: number,
    as = actor,
    requestKey = randomUUID(),
  ) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await mutateWorkBoard(db, as, {
          operation,
          ...(id ? { id } : {}),
          ...(revision ? { revision } : {}),
          payload,
          requestKey,
        });
      } catch (error) {
        if (
          attempt === 2 ||
          !(error instanceof Error) ||
          !/upstream|timeout|fetch failed/.test(error.message)
        )
          throw error;
      }
    }
    throw new Error("Retry exhausted");
  }
  async function create(title: string) {
    const { card } = await call("create", undefined, {
      title,
      description: "Controlled work protocol fixture",
      acceptance_criteria: "Verify protocol",
      project_key: project,
      work_kind: "research",
      notes: "N".repeat(14044),
    });
    cards.push(card.id);
    return card;
  }
  try {
    assert.throws(() =>
      validateWorkMutation({
        operation: "edit",
        id: randomUUID(),
        requestKey: randomUUID(),
        payload: { notes: "x".repeat(200001) },
      }),
    );
    const a = await create("QA protocol prerequisite"),
      b = await create("QA protocol dependent");
    assert.equal(a.notes.length, 14044);
    const dep = await call("dependencies", b.id, { dependencies: [a.id] }, b.revision);
    await assert.rejects(
      call("dependencies", a.id, { dependencies: [b.id] }, a.revision),
      /cycle/i,
    );
    let token = randomBytes(32).toString("base64url");
    await assert.rejects(call("claim", b.id, { claimToken: token }), /dependencies_incomplete/);
    const key = randomUUID();
    const secondKey = randomUUID();
    const secondToken = randomBytes(32).toString("base64url");
    const race = await Promise.allSettled([
      call("claim", a.id, { claimToken: token }, undefined, actor, key),
      call("claim", a.id, { claimToken: secondToken }, undefined, actor, secondKey),
    ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    // Same logical request is safe to repeat even after the card moves.
    const won = race[0]?.status === "fulfilled";
    if (!won) token = secondToken;
    const replay = await call(
      "claim",
      a.id,
      { claimToken: token },
      undefined,
      actor,
      won ? key : secondKey,
    );
    assert.equal(replay.replayed, true);
    await assert.rejects(
      call(
        "claim",
        a.id,
        { claimToken: randomBytes(32).toString("base64url") },
        undefined,
        actor,
        won ? key : secondKey,
      ),
      /Idempotency/,
    );
    await assert.rejects(
      call("heartbeat", a.id, { claimToken: randomBytes(32).toString("base64url") }),
      /session/,
    );
    await assert.rejects(
      call("edit", a.id, { notes: "stale overwrite" }, a.revision),
      /Revision conflict/,
    );
    await assert.rejects(
      call("submit", a.id, {
        claimToken: token,
        evidence: {
          summary: "Invalid evidence fixture",
          checks: [{ name: "test", status: "failed", evidence: "failure" }],
        },
      }),
    );
    const submitted = await call("submit", a.id, {
      claimToken: token,
      evidence: {
        summary: "Verified work protocol fixture",
        checks: [{ name: "protocol", status: "passed", evidence: "Assertion passed" }],
      },
    });
    assert.equal(submitted.card.status, "in_review");
    await assert.rejects(
      call(
        "review",
        a.id,
        { accept: true, message: "Unauthorized reviewer fixture" },
        submitted.card.revision,
        { ...actor, reviewer: false },
      ),
      /authority/,
    );
    const accepted = await call(
      "review",
      a.id,
      { accept: true, message: "Controlled fixture self-review override" },
      submitted.card.revision,
    );
    assert.equal(accepted.card.status, "shipped");
    const page = await listWorkBoard(db, actor);
    assert.deepEqual(page.features.find((c) => c.id === b.id)?.readiness, []);
    await assert.rejects(
      call("edit", b.id, { notes: "cross project" }, dep.card.revision, {
        ...actor,
        projects: ["other"],
      }),
      /denied/,
    );
    const credential = await issueWorkAgent(db, {
      name: "QA scoped credential",
      projects: [project],
      scopes: ["read"],
      days: 1,
    });
    const identity = await authenticateWorkAgent(db, credential.token);
    assert.deepEqual(identity.projects, [project]);
    await assert.rejects(
      call("claim", b.id, { claimToken: token }, undefined, identity),
      /not allowed/,
    );
    await db
      .from("work_board_agents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", credential.id);
    await assert.rejects(authenticateWorkAgent(db, credential.token), /revoked/);
    if (process.env.WORK_BOARD_TEST_URL) {
      const base = new URL(process.env.WORK_BOARD_TEST_URL);
      assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "HTTP QA must use a local app");
      const credential = await issueWorkAgent(db, {
        name: "QA HTTP MCP CLI",
        projects: [project],
        scopes: ["read", "claim", "heartbeat", "release", "submit"],
        days: 1,
      });
      try {
        const headers = {
          Authorization: `Bearer ${credential.token}`,
          "Content-Type": "application/json",
        };
        const listed = await fetch(new URL("/api/agent/work-board", base), { headers });
        assert.equal(listed.status, 200);
        assert.equal((await listed.json()).features.length, 2);
        const unauthorized = await fetch(new URL("/api/admin/features", base));
        assert.equal(unauthorized.status, 401);
        const response = await fetch(new URL("/api/agent/work-board/mcp", base), {
          method: "POST",
          headers,
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).result.tools.length, 3);
        const denied = await fetch(new URL("/api/agent/work-board/mcp", base), {
          method: "POST",
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
              name: "work_mutate",
              arguments: {
                operation: "review",
                id: a.id,
                revision: accepted.card.revision,
                requestKey: randomUUID(),
                payload: { accept: true, message: "Unauthorized agent review fixture" },
              },
            },
          }),
        });
        assert.equal((await denied.json()).result.isError, true);
        const output = execFileSync(
          "npx",
          ["tsx", "scripts/agent-dispatch.ts", "next", "--card", b.id, "--no-worktree"],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              WORK_BOARD_URL: base.origin,
              WORK_BOARD_TOKEN: credential.token,
            },
            timeout: 60000,
          },
        );
        assert.equal(JSON.parse(output).status, "in_progress");
        assert.ok(!output.includes("claimToken"));
        const released = execFileSync(
          "npx",
          ["tsx", "scripts/agent-dispatch.ts", "release", "--card", b.id],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              WORK_BOARD_URL: base.origin,
              WORK_BOARD_TOKEN: credential.token,
            },
            timeout: 60000,
          },
        );
        assert.equal(JSON.parse(released).card.status, "planned");
        console.log(
          "PASS: local HTTP authentication, scoped MCP discovery/denial, CLI claim/release, no token disclosure",
        );
      } finally {
        await db
          .from("work_board_agents")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", credential.id);
      }
    }
    const latest = (await listWorkBoard(db, actor)).features;
    const beforeB = latest.find((c) => c.id === b.id)!;
    const beforeA = latest.find((c) => c.id === a.id)!;
    await assert.rejects(
      call("reorder", undefined, {
        updates: [
          { id: b.id, revision: beforeB.revision, status: "backlog", sort_order: 12 },
          { id: a.id, revision: beforeA.revision, status: "planned", sort_order: 13 },
        ],
      }),
      /claim|reopen/,
    );
    const afterB = (await listWorkBoard(db, actor, { id: b.id })).features[0]!;
    assert.equal(
      afterB.revision,
      beforeB.revision,
      "Failed batch must roll back earlier card changes",
    );
    const reorderKey = randomUUID();
    const reorderPayload = {
      updates: [{ id: b.id, revision: beforeB.revision, status: "backlog", sort_order: 42 }],
    };
    await call("reorder", undefined, reorderPayload, undefined, actor, reorderKey);
    await call("reorder", undefined, reorderPayload, undefined, actor, reorderKey);
    const reordered = (await listWorkBoard(db, actor, { id: b.id })).features[0]!;
    assert.equal(reordered.sort_order, 42);
    console.log("PASS: atomic reorder rollback and idempotent replay");
    const immutable = await db
      .from("work_board_events")
      .update({ actor: "changed" })
      .eq("card_id", a.id);
    assert.ok(immutable.error);
    console.log(
      "PASS: long notes, strict validation, atomic race, replay, fencing, CAS, dependencies/cycle, review, scope, revocation, immutable history.",
    );
  } finally {
    for (const id of cards) {
      let card = (await listWorkBoard(db, actor, { id })).features[0];
      if (!card) continue;
      if (card!.status === "in_progress") {
        // Test fixtures only: expire the lease to exercise explicit recovery, never touch real cards.
        await db
          .from("feature_requests")
          .update({ lease_expires_at: new Date(0).toISOString() })
          .eq("id", id)
          .eq("project_key", project);
        card = (await listWorkBoard(db, actor, { id })).features[0]!;
        card = (
          await call("recover", id, { message: "Recover controlled test fixture" }, card!.revision)
        ).card;
      }
      if (card!.status === "in_review")
        card = (
          await call("reopen", id, { message: "Reopen controlled test fixture" }, card!.revision)
        ).card;
      await call("archive", id, { message: "Archive controlled test fixture" }, card!.revision);
    }
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Work command failed");
  process.exitCode = 1;
});

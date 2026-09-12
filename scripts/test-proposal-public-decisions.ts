#!/usr/bin/env tsx
/**
 * Coverage for the public proposal token route (`handleProposalGet` /
 * `handleProposalPost`), the only writer for public view/accept/decline —
 * proposal-public-decisions card, AC1-AC3.
 *
 * These call the route handlers directly against a MemorySupabase bound as
 * the ambient tenant actor database, the same seam `test-responder-envelope.ts`
 * uses, so a real request/response cycle runs (rate limiting, validation,
 * the atomic lifecycle command) without a network hop or a live Supabase
 * project. One linked-opportunity case verifies the optional customer reason
 * remains null while canonical pipeline loss context identifies the proposal.
 * General transition policy stays in `test:pipeline-transition`.
 *
 * The route delegates view/decision writes to recordProposalView/decideProposal
 * (src/lib/revenue-os/proposals.ts), which commit through a single durable,
 * idempotency-keyed RPC (`apply_proposal_lifecycle`, see
 * migrations/20260912-proposal-lifecycle.sql for the real Postgres function -
 * advisory-locked, `SELECT ... FOR UPDATE` transaction). Inside an "actor"
 * request context (the seam this suite uses to inject the in-memory database
 * everywhere else), `callVerifiedHostRpc` deliberately never trusts the
 * caller's database for that RPC: after checking real admin membership
 * against it, it opens a *fresh* client from `NEXT_PUBLIC_SUPABASE_URL`/
 * `SUPABASE_SERVICE_ROLE_KEY` and calls the RPC there instead - the same
 * defense-in-depth `test-collections-actor-bridge.ts` exercises. So this
 * suite follows that file's pattern: point those env vars at a fixture host
 * and stub `fetch` to serve `apply_proposal_lifecycle` from
 * `runProposalLifecycle`, a faithful in-memory port of the migration's state
 * machine (target status per operation, changed/replay detection, the
 * decline-reason and expires_at guards, the receipt keyed by the caller's
 * idempotency hash) rather than inventing new behavior of its own. Every
 * other call the route makes (`.from("proposals")...`, `admin_notifications`)
 * reaches the injected MemorySupabase directly with no network involved.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { handleProposalGet, handleProposalPost } from "../src/app/api/proposal/[token]/route";
import {
  ACCELERATE_TENANT_ID,
  ACCELERATE_TENANT_SLUG,
  runWithTenantRequestContext,
} from "../src/lib/tenancy/context";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";

const ACTOR_USER_ID = randomUUID();

// Each logical test case gets its own fake IP so the module-level rate
// limiter (10 decisions / 20 views per hour, keyed by ip) never bleeds one
// test's request count into another's.
let ipSequence = 0;
function freshIp() {
  ipSequence += 1;
  return `203.0.113.${ipSequence}`;
}

function get(token: string, ip: string) {
  const request = new NextRequest(`https://example.test/api/proposal/${token}`, {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });
  return { request, params: Promise.resolve({ token }) };
}

function post(token: string, body: unknown, ip: string) {
  const request = new NextRequest(`https://example.test/api/proposal/${token}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  return { request, params: Promise.resolve({ token }) };
}

const PROPOSAL_ID = "9f2c9c0a-2b7a-4a24-9c1a-2f4e0c6c1a01";

const TARGET_STATUS: Record<string, string> = {
  send: "sent",
  view: "viewed",
  accept: "accepted",
  decline: "declined",
  expire: "expired",
  revise: "superseded",
};

/** Per-database idempotency receipts, keyed by the caller's durable hash. */
const receiptsByDb = new WeakMap<
  MemorySupabase,
  Map<string, { command: Record<string, unknown>; result: Row }>
>();

/**
 * A faithful in-memory port of `apply_proposal_lifecycle`
 * (migrations/20260912-proposal-lifecycle.sql): same target-status map, the
 * same changed/no-op detection, the same expired/decline-reason/"no longer
 * open" guards, and the same idempotency-key replay. The real function's
 * atomicity comes from an advisory lock plus `SELECT ... FOR UPDATE`; this is
 * called synchronously from the `fetch` stub below (no internal await)
 * against the same in-memory row, which gives the identical guarantee for
 * concurrent JS callers - whichever call's turn actually executes first
 * sees, and commits, the live state, and every later call (racer or replay)
 * reads that committed state.
 */
function runProposalLifecycle(
  db: MemorySupabase,
  args: { p_key: string; p_command: Record<string, unknown>; p_actor_email: string },
): Row {
  let receipts = receiptsByDb.get(db);
  if (!receipts) {
    receipts = new Map();
    receiptsByDb.set(db, receipts);
  }
  {
    const key = args.p_key;
    const command = args.p_command;
    const actorEmail = args.p_actor_email;

    const withoutExpected = (c: Record<string, unknown>) => {
      const rest = { ...c };
      delete rest.expectedUpdatedAt;
      return rest;
    };
    const prior = receipts.get(key);
    if (prior) {
      if (
        JSON.stringify(withoutExpected(prior.command)) !== JSON.stringify(withoutExpected(command))
      )
        throw new Error("Proposal operation identity conflict");
      return { ...prior.result, replayed: true };
    }

    const proposals = db.tables.proposals ?? [];
    const p = proposals.find((row) => row.id === command.id);
    if (!p) throw new Error("Proposal not found");

    const op = command.operation as string;
    const patch = (command.patch as Record<string, unknown>) ?? {};
    const source = (command.source as string) ?? "admin";
    const target = TARGET_STATUS[op] ?? String(p.status);
    const status = String(p.status);
    const expiresAt = p.expires_at ? Date.parse(String(p.expires_at)) : null;

    let changed = true;
    if (op === "send" && ["sent", "viewed"].includes(status)) changed = false;
    else if (
      op === "view" &&
      (p.viewed_at != null || ["accepted", "declined", "expired", "superseded"].includes(status))
    )
      changed = false;
    else if ((op === "accept" || op === "decline") && status === target) changed = false;
    else if (op === "view" && status === "draft") throw new Error("Draft proposal is not shared");
    else if (op === "edit" && status !== "draft")
      throw new Error("Only draft proposals can be edited in place");
    else if (op === "send" && status !== "draft") throw new Error("Proposal cannot be sent");
    else if (
      ["accept", "decline", "expire", "revise"].includes(op) &&
      !["sent", "viewed"].includes(status)
    )
      throw new Error("Proposal is no longer open for a response or revision");

    if (
      changed &&
      ["accept", "decline"].includes(op) &&
      expiresAt !== null &&
      expiresAt <= Date.now()
    )
      throw new Error("Proposal expired; response refused");
    if (op === "decline") {
      const reason = typeof command.reason === "string" ? command.reason.trim() : "";
      if ((command.source !== "public_link" && reason.length < 1) || reason.length > 1000)
        throw new Error("A bounded decline reason is required");
    }
    if (op === "expire" && (expiresAt === null || expiresAt > Date.now()))
      throw new Error("Proposal is not due to expire");

    let successor: Row | null = null;
    const now = new Date().toISOString();
    if (changed) {
      if (op === "revise") {
        successor = {
          id: randomUUID(),
          ...p,
          status: "draft",
          version: (Number(p.version) || 1) + 1,
          supersedes_id: p.id,
          superseded_by: null,
          created_at: now,
          updated_at: now,
        };
        db.tables.proposals!.push(successor);
      }
      Object.assign(p, {
        status: target,
        updated_at: now,
        ...(op === "edit"
          ? {
              title: patch.title ?? p.title,
              client_name: patch.client_name ?? p.client_name,
              content: patch.content ?? p.content,
              total_one_time: patch.total_one_time ?? p.total_one_time,
              total_monthly: patch.total_monthly ?? p.total_monthly,
            }
          : {}),
        ...(op === "send" ? { sent_at: now } : {}),
        ...(op === "view" ? { viewed_at: now } : {}),
        ...(op === "accept" || op === "decline" ? { responded_at: now } : {}),
        ...(op === "decline"
          ? {
              decline_reason:
                typeof command.reason === "string" ? command.reason.trim() || null : null,
            }
          : {}),
        ...(op === "revise" && successor ? { superseded_by: successor.id } : {}),
      });
      const eventType = op === "edit" ? null : target;
      if (eventType) {
        db.tables.proposal_events ??= [];
        db.tables.proposal_events.push({
          id: randomUUID(),
          proposal_id: p.id,
          event_type: eventType,
          source,
          metadata: {},
        });
      }
      db.tables.audit_log ??= [];
      db.tables.audit_log.push({
        id: randomUUID(),
        actor_email: actorEmail,
        action: `proposal.${eventType ?? "updated"}`,
        entity_type: "proposal",
        entity_id: p.id,
      });
    }

    const result: Row = {
      proposal: { ...p },
      successor: successor ? { ...successor } : null,
      changed,
      replayed: false,
    };
    receipts.set(key, { command, result });
    return result;
  }
}

/** A fresh in-memory tenant DB seeded with one open proposal. */
function harness(overrides: Partial<Row> = {}) {
  const db = new MemorySupabase({
    tenants: [{ id: ACCELERATE_TENANT_ID, status: "active" }],
    tenant_memberships: [
      { tenant_id: ACCELERATE_TENANT_ID, user_id: ACTOR_USER_ID, role: "admin", status: "active" },
    ],
    proposals: [
      {
        id: PROPOSAL_ID,
        tenant_id: ACCELERATE_TENANT_ID,
        share_token: "tok-1",
        title: "Growth plan",
        client_name: "Acme Co",
        content: { summary: "..." },
        total_one_time: 5000,
        total_monthly: 1500,
        status: "sent",
        opportunity_id: null,
        expires_at: null,
        viewed_at: null,
        version: 1,
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
        ...overrides,
      },
    ],
    proposal_events: [],
    admin_notifications: [],
    tasks: [],
    activities: [],
    audit_log: [],
    opportunities: [],
    kanban_columns: [],
    stage_events: [],
  });
  activeDb = db;
  return db;
}

/**
 * `callVerifiedHostRpc` checks admin membership against the injected
 * database (handled above via `harness`'s seed), then - regardless of that
 * outcome - talks to a *fresh* client built from these env vars for the
 * actual RPC call. Point them at a fixture host and stub `fetch` once so
 * every `apply_proposal_lifecycle` call resolves through `runProposalLifecycle`
 * against whichever database is currently active.
 */
let activeDb: MemorySupabase | null = null;
const FIXTURE_HOST = "proposal-public-decisions-fixture.supabase.co";
const originalFetch = globalThis.fetch;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${FIXTURE_HOST}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "proposal-public-decisions-fixture-key";
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== FIXTURE_HOST || url.pathname !== "/rest/v1/rpc/apply_proposal_lifecycle")
    throw new Error(`Unexpected fetch in proposal-public-decisions test: ${url}`);
  if (!activeDb) throw new Error("No active test database for apply_proposal_lifecycle");
  const args = JSON.parse(String(init?.body ?? "{}"));
  try {
    return Response.json(runProposalLifecycle(activeDb, args));
  } catch (error) {
    return new Response(
      JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
}) as typeof fetch;
function restoreFetchAndEnv() {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
}

function run<T>(db: MemorySupabase, work: () => Promise<T>): Promise<T> {
  const database = bindTenantDatabaseForTest(db.client, ACCELERATE_TENANT_ID);
  return runWithTenantRequestContext(
    {
      kind: "actor",
      tenant: {
        id: ACCELERATE_TENANT_ID,
        slug: ACCELERATE_TENANT_SLUG,
        name: "Accelerate",
        status: "active",
        config: {},
      },
      user: { id: ACTOR_USER_ID, email: undefined },
      role: "admin",
      isPlatformAdmin: false,
      database,
    },
    work,
  );
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

(async () => {
  const checks: string[] = [];

  // --- AC1: view receipts are deduplicated with privacy controls ----------

  checks.push("first GET marks viewed_at, writes one view receipt/notification/audit");
  {
    const db = harness();
    const ip = freshIp();
    const { request, params } = get("tok-1", ip);
    const response = await run(db, () => handleProposalGet(request, { params }));
    assert.equal(response.status, 200, "first view responds 200");
    const body = await json(response);
    assert.equal((body.proposal as Row).status, "viewed", "status flips sent -> viewed");
    const proposal = db.rows("proposals")[0]!;
    assert.ok(proposal.viewed_at, "viewed_at is set");
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "viewed").length,
      1,
      "exactly one viewed event recorded",
    );
    assert.equal(
      db.rows("admin_notifications").filter((row) => row.type === "proposal_viewed").length,
      1,
      "exactly one view notification recorded",
    );
    const viewedEvent = db.rows("proposal_events").find((row) => row.event_type === "viewed")!;
    assert.deepEqual(
      viewedEvent.metadata,
      {},
      "view receipt carries no viewer IP/user-agent/PII in its metadata",
    );
  }

  checks.push("repeated GETs after the first view write no further receipts (dedup)");
  {
    const db = harness();
    const ip = freshIp();
    const { request: r1, params: p1 } = get("tok-1", ip);
    await run(db, () => handleProposalGet(r1, { params: p1 }));
    for (let i = 0; i < 3; i++) {
      const { request, params } = get("tok-1", ip);
      const response = await run(db, () => handleProposalGet(request, { params }));
      assert.equal(response.status, 200, `repeat view #${i + 1} still 200`);
    }
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "viewed").length,
      1,
      "still exactly one viewed event after four total GETs",
    );
    assert.equal(
      db.rows("admin_notifications").filter((row) => row.type === "proposal_viewed").length,
      1,
      "still exactly one view notification after four total GETs",
    );
  }

  checks.push("concurrent first views race to a single receipt");
  {
    const db = harness();
    const ip = freshIp();
    const attempts = Array.from({ length: 5 }, () => get("tok-1", ip));
    await Promise.all(
      attempts.map(({ request, params }) => run(db, () => handleProposalGet(request, { params }))),
    );
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "viewed").length,
      1,
      "five concurrent first-views still produce exactly one view receipt",
    );
  }

  // --- AC2: repeated accept/decline requests replay the terminal outcome --

  checks.push("accept succeeds once, records one event/activity/notification/task");
  {
    const db = harness();
    const ip = freshIp();
    const { request, params } = post("tok-1", { decision: "accepted" }, ip);
    const response = await run(db, () => handleProposalPost(request, { params }));
    assert.equal(response.status, 200, "accept responds 200");
    const body = await json(response);
    assert.equal(body.status, "accepted");
    assert.equal(db.rows("proposals")[0]!.status, "accepted");
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "accepted").length,
      1,
    );
    // createRevenueTask logs its own "task_created" activity alongside the
    // "proposal_accepted" one decideProposal records directly.
    assert.equal(
      db.rows("activities").length,
      2,
      "one decision activity, one task-created activity",
    );
    assert.equal(db.rows("tasks").length, 1, "exactly one follow-up task");
  }

  checks.push("repeated accept after acceptance replays the terminal outcome, no new writes");
  {
    const db = harness();
    const ip = freshIp();
    const { request: r1, params: p1 } = post("tok-1", { decision: "accepted" }, ip);
    await run(db, () => handleProposalPost(r1, { params: p1 }));
    const { request: r2, params: p2 } = post("tok-1", { decision: "accepted" }, ip);
    const response = await run(db, () => handleProposalPost(r2, { params: p2 }));
    assert.equal(response.status, 200, "replayed accept still 200");
    const body = await json(response);
    assert.equal(body.success, true);
    assert.equal(body.status, "accepted");
    assert.equal(body.alreadyResponded, true, "replay is flagged as already responded");
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "accepted").length,
      1,
      "no second accepted event on replay",
    );
    assert.equal(db.rows("tasks").length, 1, "no second follow-up task on replay");
  }

  checks.push("replaying a decision after its follow-up is completed does not create another task");
  for (const decision of ["accepted", "declined"] as const) {
    const db = harness();
    const ip = freshIp();
    const first = post("tok-1", { decision }, ip);
    assert.equal(
      (await run(db, () => handleProposalPost(first.request, { params: first.params }))).status,
      200,
    );
    const originalTask = db.rows("tasks")[0]!;
    originalTask.status = "completed";
    const replay = post("tok-1", { decision }, ip);
    const response = await run(db, () =>
      handleProposalPost(replay.request, { params: replay.params }),
    );
    assert.equal(response.status, 200);
    assert.equal((await json(response)).alreadyResponded, true);
    assert.equal(db.rows("tasks").length, 1);
    assert.equal(db.rows("tasks")[0]!.id, originalTask.id);
    assert.equal(db.rows("tasks")[0]!.status, "completed");
  }

  checks.push("decline after accept returns the existing accepted outcome, does not flip it");
  {
    const db = harness();
    const ip = freshIp();
    const { request: r1, params: p1 } = post("tok-1", { decision: "accepted" }, ip);
    await run(db, () => handleProposalPost(r1, { params: p1 }));
    const { request: r2, params: p2 } = post(
      "tok-1",
      { decision: "declined", reason: "changed our mind" },
      ip,
    );
    const response = await run(db, () => handleProposalPost(r2, { params: p2 }));
    assert.equal(response.status, 200, "a decision that lost to a settled outcome still 200s");
    const body = await json(response);
    assert.equal(body.status, "accepted", "the recorded decision, not the new request, wins");
    assert.equal(body.alreadyResponded, true);
    assert.equal(db.rows("proposals")[0]!.status, "accepted", "pipeline state unchanged");
  }

  checks.push("concurrent decisions on the same open proposal settle on exactly one outcome");
  {
    const db = harness();
    const ip = freshIp();
    const [r1, r2, r3] = [
      post("tok-1", { decision: "accepted" }, ip),
      post("tok-1", { decision: "declined", reason: "too expensive" }, ip),
      post("tok-1", { decision: "accepted" }, ip),
    ];
    const responses = await Promise.all(
      [r1, r2, r3].map(({ request, params }) =>
        run(db, () => handleProposalPost(request, { params })),
      ),
    );
    for (const response of responses) assert.equal(response.status, 200, "every racer gets 200");
    const bodies = await Promise.all(responses.map(json));
    const finalStatus = db.rows("proposals")[0]!.status;
    assert.ok(
      ["accepted", "declined"].includes(finalStatus as string),
      "settled to a terminal status",
    );
    for (const body of bodies) {
      assert.equal(body.status, finalStatus, "every racer's response matches the settled outcome");
    }
    assert.equal(
      db
        .rows("proposal_events")
        .filter((row) => ["accepted", "declined"].includes(row.event_type as string)).length,
      1,
      "exactly one decision event recorded despite three concurrent requests",
    );
  }

  checks.push("public decline allows missing, null or blank reason and preserves null on replay");
  for (const reason of [undefined, null, "  "]) {
    const db = harness();
    const ip = freshIp();
    const { request, params } = post("tok-1", { decision: "declined", reason }, ip);
    const response = await run(db, () => handleProposalPost(request, { params }));
    assert.equal(response.status, 200);
    assert.equal(db.rows("proposals")[0]!.status, "declined");
    assert.equal(db.rows("proposals")[0]!.decline_reason, null);
    const replay = post("tok-1", { decision: "declined", reason: "later explanation" }, ip);
    assert.equal(
      (await run(db, () => handleProposalPost(replay.request, { params: replay.params }))).status,
      200,
    );
    assert.equal(db.rows("proposals")[0]!.decline_reason, null);
  }
  checks.push("malformed or excessive public reasons fail before writes; text is sanitized");
  for (const reason of [{ unexpected: true }, 42, "x".repeat(1001)]) {
    const db = harness();
    const { request, params } = post("tok-1", { decision: "declined", reason }, freshIp());
    assert.equal((await run(db, () => handleProposalPost(request, { params }))).status, 400);
    assert.equal(db.rows("proposals")[0]!.status, "sent");
  }
  {
    const db = harness();
    const { request, params } = post(
      "tok-1",
      { decision: "declined", reason: "  Budget\u0001changed  " },
      freshIp(),
    );
    assert.equal((await run(db, () => handleProposalPost(request, { params }))).status, 200);
    assert.equal(db.rows("proposals")[0]!.decline_reason, "Budget changed");
  }

  checks.push(
    "blank public decline preserves null customer reason and truthful linked pipeline context",
  );
  {
    const opportunityId = randomUUID();
    const db = harness({ opportunity_id: opportunityId });
    db.rows("opportunities").push({
      id: opportunityId,
      tenant_id: ACCELERATE_TENANT_ID,
      stage: "proposal",
      probability: 70,
    });
    db.rows("kanban_columns").push(
      ...[
        { key: "proposal", role: "open", probability: 70 },
        { key: "lost", role: "lost", probability: 0 },
      ].map((stage, index) => ({
        id: randomUUID(),
        tenant_id: ACCELERATE_TENANT_ID,
        board_key: "pipeline",
        column_key: stage.key,
        label: stage.key,
        is_default: index === 0,
        sort_order: index,
        metadata: { role: stage.role, probability: stage.probability },
      })),
    );
    const ip = freshIp();
    const first = post("tok-1", { decision: "declined" }, ip);
    const response = await run(db, () =>
      handleProposalPost(first.request, { params: first.params }),
    );
    assert.equal(response.status, 200, JSON.stringify(await json(response)));
    assert.equal(db.rows("proposals")[0]!.decline_reason, null);
    assert.equal(db.rows("opportunities")[0]!.stage, "lost");
    assert.equal(db.rows("opportunities")[0]!.loss_reason, `Proposal declined (${PROPOSAL_ID})`);
    const replay = post("tok-1", { decision: "declined", reason: "later explanation" }, ip);
    assert.equal(
      (await run(db, () => handleProposalPost(replay.request, { params: replay.params }))).status,
      200,
    );
    assert.equal(db.rows("proposals")[0]!.decline_reason, null);
    assert.equal(db.rows("stage_events").length, 1);
    assert.equal(
      db.rows("activities").find((row) => row.activity_type === "proposal_declined")!.summary,
      null,
    );
  }

  // --- AC3: expired or superseded links cannot change pipeline state ------

  checks.push("accept on an expired-but-not-yet-swept link is refused (410) and retires it");
  {
    const db = harness({ expires_at: "2020-01-01T00:00:00.000Z" });
    const ip = freshIp();
    const { request, params } = post("tok-1", { decision: "accepted" }, ip);
    const response = await run(db, () => handleProposalPost(request, { params }));
    assert.equal(response.status, 410, "expired decision is refused, not accepted");
    assert.equal(db.rows("proposals")[0]!.status, "expired", "status retired to expired");
    assert.equal(
      db
        .rows("proposal_events")
        .filter((row) => ["accepted", "declined"].includes(row.event_type as string)).length,
      0,
      "no decision event for an expired link",
    );
  }

  checks.push("GET on an expired link retires it to expired and cannot be re-opened by viewing");
  {
    const db = harness({ expires_at: "2020-01-01T00:00:00.000Z" });
    const ip = freshIp();
    const { request, params } = get("tok-1", ip);
    const response = await run(db, () => handleProposalGet(request, { params }));
    const body = await json(response);
    assert.equal((body.proposal as Row).status, "expired");
    assert.equal(db.rows("proposals")[0]!.status, "expired");
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "viewed").length,
      0,
      "an expired link is never recorded as viewed",
    );
    assert.equal(
      db.rows("proposal_events").filter((row) => row.event_type === "expired").length,
      1,
      "exactly one expired event recorded",
    );
  }

  checks.push("decision on an already-expired proposal is refused without re-writing the expiry");
  {
    const db = harness({ status: "expired", expires_at: "2020-01-01T00:00:00.000Z" });
    const ip = freshIp();
    const { request, params } = post("tok-1", { decision: "accepted" }, ip);
    const response = await run(db, () => handleProposalPost(request, { params }));
    assert.equal(response.status, 409, "already-expired proposal is not open for a response");
    assert.equal(db.rows("proposals")[0]!.status, "expired");
  }

  checks.push("decision on a superseded proposal cannot change pipeline state");
  {
    const db = harness({ status: "superseded" });
    const ip = freshIp();
    const { request, params } = post("tok-1", { decision: "accepted" }, ip);
    const response = await run(db, () => handleProposalPost(request, { params }));
    assert.equal(response.status, 409, "superseded proposal is not open for a response");
    assert.equal(db.rows("proposals")[0]!.status, "superseded", "pipeline state unchanged");
    assert.equal(
      db.rows("proposal_events").length,
      0,
      "no event of any kind recorded for a superseded link",
    );
  }

  checks.push("viewing a superseded proposal does not resurrect it as viewed");
  {
    const db = harness({ status: "superseded" });
    const ip = freshIp();
    const { request, params } = get("tok-1", ip);
    const response = await run(db, () => handleProposalGet(request, { params }));
    assert.equal(response.status, 200);
    assert.equal(db.rows("proposals")[0]!.status, "superseded", "status untouched by a view");
  }

  checks.push("decision on an unknown token is a 404, replay-safe and identical");
  {
    const db = harness();
    const ip = freshIp();
    const { request: r1, params: p1 } = post("no-such-token", { decision: "accepted" }, ip);
    const first = await run(db, () => handleProposalPost(r1, { params: p1 }));
    const { request: r2, params: p2 } = post("no-such-token", { decision: "accepted" }, ip);
    const second = await run(db, () => handleProposalPost(r2, { params: p2 }));
    assert.equal(first.status, 404);
    assert.equal(second.status, 404);
    assert.deepEqual(await json(first), await json(second), "identical 404 body on replay");
  }

  console.log(
    JSON.stringify({
      result: "proposal-public-decisions checks covered",
      checks,
    }),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(restoreFetchAndEnv);

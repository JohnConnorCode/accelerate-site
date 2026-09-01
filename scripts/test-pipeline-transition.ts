import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transitionOpportunity, transitionStatusFromError } from "../src/lib/revenue-os/pipeline";

type Row = Record<string, unknown>;

type QueryResult = {
  data: Row[] | Row | null;
  error: { code?: string; message: string } | null;
};

type ReadSnapshot = {
  table: string;
  rows: Row[];
  rawRows: Row[];
};

type ReadHook = (snapshot: ReadSnapshot) => void;

class MemoryQuery implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private operation: "read" | "insert" | "update" = "read";
  private payload: Row | Row[] | null = null;
  private one = false;

  constructor(
    private readonly db: MemorySupabase,
    private readonly table: string,
    private readonly onRead?: ReadHook,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  maybeSingle() {
    this.one = true;
    return this;
  }

  single() {
    this.one = true;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  private rowsForRead() {
    const rows = this.db.rowsFor(this.table);
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  private read(): QueryResult {
    this.db.touched.add(this.table);
    const rows = this.rowsForRead();
    const snapshot = rows.map((row) => ({ ...row }));
    this.onRead?.({ table: this.table, rows: snapshot, rawRows: rows });
    if (this.operation === "read") {
      const selected = snapshot;
      return { data: this.one ? (selected[0] ?? null) : selected, error: null };
    }
    return { data: null, error: null };
  }

  private insertRows(): QueryResult {
    const tableRows = this.db.rowsFor(this.table);
    const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const inserted: Row[] = [];
    for (const payload of payloads) {
      const row = { ...payload, id: payload.id ?? this.db.nextId(this.table) };
      tableRows.push(row);
      inserted.push(row);
    }
    return { data: this.one ? (inserted[0] ?? null) : inserted, error: null };
  }

  private updateRows(): QueryResult {
    const tableRows = this.db.rowsFor(this.table);
    const matching = tableRows.filter((row) => this.filters.every((filter) => filter(row)));
    for (const row of matching) Object.assign(row, this.payload ?? {});
    const selected = matching.map((row) => ({ ...row }));
    return { data: this.one ? (selected[0] ?? null) : selected, error: null };
  }

  private execute(): QueryResult {
    if (this.operation === "insert") return this.insertRows();
    if (this.operation === "update") return this.updateRows();
    return this.read();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

class MemorySupabase {
  readonly touched = new Set<string>();
  private sequence = 0;
  constructor(
    public readonly rows: Record<string, Row[]>,
    private readonly onRead?: ReadHook,
  ) {}

  nextId(table: string) {
    this.sequence += 1;
    return `${table}-${this.sequence}`;
  }

  rowsFor(table: string) {
    return this.rows[table] ?? (this.rows[table] = []);
  }

  from(table: string) {
    return new MemoryQuery(this, table, this.onRead);
  }
}

function rows(db: MemorySupabase, table: string) {
  return db.rowsFor(table);
}

function memorySupabase(rows: Record<string, Row[]>, onRead?: ReadHook) {
  return new MemorySupabase(rows, onRead);
}

async function run() {
  const pipelineRoute = readFileSync(
    new URL("../src/app/api/admin/revenue-os/pipeline/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    pipelineRoute,
    /createOpportunity\(/,
    "Pipeline API must use the canonical creation service.",
  );
  assert.match(
    pipelineRoute,
    /updateOpportunityDetails\(/,
    "Pipeline API must use the canonical detail-update service.",
  );
  assert.doesNotMatch(
    pipelineRoute,
    /from\("opportunities"\)\.insert\(/,
    "Pipeline API must not create opportunities directly.",
  );
  assert.doesNotMatch(
    pipelineRoute,
    /from\("opportunities"\)\.update\(/,
    "Pipeline API must not update opportunities directly.",
  );

  const db = memorySupabase({
    opportunities: [
      {
        id: "o1",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 7500,
        loss_reason: null,
      },
      {
        id: "o2",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 2500,
        loss_reason: null,
      },
      {
        id: "o3",
        stage: "lost",
        probability: 0,
        won_value: 0,
        estimated_value: 0,
        loss_reason: "legacy-close",
      },
      {
        id: "o4",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 2000,
        loss_reason: null,
      },
      {
        id: "o5",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 1250,
        loss_reason: null,
      },
    ],
    stage_events: [],
    audit_log: [],
  });

  const lostTransition = await transitionOpportunity(db as never, {
    id: "o1",
    to: "lost",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Qualification path stale",
    lossReason: "Duplicate lead source",
  });
  assert.equal(lostTransition.stage, "lost");
  assert.equal(lostTransition.closed_at, lostTransition.last_activity_at);
  assert.equal(rows(db, "stage_events").length, 1);
  assert.equal(rows(db, "stage_events")[0]?.from_stage, "qualified");
  assert.equal(rows(db, "stage_events")[0]?.to_stage, "lost");
  assert.equal(rows(db, "stage_events")[0]?.actor_email, "founder@example.com");
  assert.equal(
    (rows(db, "stage_events")[0]?.metadata as { loss_reason?: string } | undefined)?.loss_reason,
    "Duplicate lead source",
  );
  assert.equal(rows(db, "audit_log").length, 1);
  assert.equal(
    (rows(db, "audit_log")[0] as { action?: string } | undefined)?.action,
    "opportunity.stage_changed",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db as never, {
        id: "o2",
        to: "lost",
        actorEmail: "founder@example.com",
        source: "test",
      }),
    /loss reason is required/i,
    "Lost transitions require lossReason.",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db as never, {
        id: "o3",
        to: "contacted",
        actorEmail: "founder@example.com",
        source: "test",
        reason: "Reopen blocked intentionally",
      }),
    /Reopen policy/,
    "Terminal reopen defaults to blocked.",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db as never, {
        id: "o3",
        to: "contacted",
        actorEmail: "founder@example.com",
        source: "test",
        allowTerminalReopen: true,
      }),
    /reason is required/i,
    "Reopen must include a reason.",
  );

  const reopened = await transitionOpportunity(db as never, {
    id: "o3",
    to: "contacted",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Operator chose explicit loss correction",
    allowTerminalReopen: true,
  });
  assert.equal(reopened.stage, "contacted");
  assert.equal(rows(db, "stage_events").at(-1)?.to_stage, "contacted");

  const legacyInput = await transitionOpportunity(db as never, {
    id: "o4",
    to: "booked",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Calendly lead captured",
  });
  assert.equal(legacyInput.stage, "meeting");
  assert.equal(rows(db, "stage_events").at(-1)?.to_stage, "meeting");

  await assert.rejects(
    () =>
      transitionOpportunity(db as never, {
        id: "o4",
        to: "won",
        actorEmail: "founder@example.com",
        source: "test",
        reason: "Invalid move should fail",
      }),
    /Cannot move an opportunity from/,
    "Invalid transition must be blocked.",
  );

  const staleDb = memorySupabase(
    {
      opportunities: [
        {
          id: "o6",
          stage: "qualified",
          probability: 40,
          won_value: 0,
          estimated_value: 1500,
          loss_reason: null,
        },
      ],
      stage_events: [],
      audit_log: [],
    },
    ({ table, rawRows }) => {
      if (table !== "opportunities") return;
      const row = rawRows.find((entry) => entry.id === "o6");
      if (row) row.stage = "won";
    },
  );

  await assert.rejects(
    () =>
      transitionOpportunity(staleDb as never, {
        id: "o6",
        to: "meeting",
        actorEmail: "founder@example.com",
        source: "test",
        reason: "Concurrent editor changed the stage",
      }),
    /changed while you were editing/i,
    "Optimistic lock check should reject stale edits.",
  );
  assert.equal(rows(staleDb, "stage_events").length, 0, "No stage event on stale transition.");

  await assert.rejects(
    () =>
      transitionOpportunity(db as never, {
        id: "o2",
        to: "not_a_stage",
        actorEmail: "founder@example.com",
        source: "test",
      }),
    /unknown stage/i,
    "Unknown stage inputs must be rejected.",
  );

  assert.equal(
    transitionStatusFromError(
      new Error("The opportunity changed while you were editing it. Refresh and try again."),
    ),
    409,
    "Transition failures for optimistic concurrency map to 409.",
  );
  assert.equal(
    transitionStatusFromError(new Error("Cannot move an opportunity from qualified to won")),
    400,
    "Other transition failures map to 400 for bad request.",
  );

  console.log(
    JSON.stringify({
      checks: [
        "loss reason is required for lost",
        "reopen policy blocks by default",
        "reopen requires reason",
        "terminal reopen is explicitly allowed with reason",
        "legacy stage input is canonicalized",
        "invalid transition is rejected",
        "optimistic concurrency is detected",
        "unknown input stage is rejected",
        "transition error mapping returns 409 for stale writes",
      ],
    }),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import {
  attachRevenueLinkageWithTelemetry,
  getLegacyAdapterUsage,
  recordLegacyAdapterUse,
  LEGACY_ADAPTER_CONSUMERS,
} from "../src/lib/revenue-os/legacy-adapter";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

class MockSupabase {
  public tables: Record<string, Row[]>;
  public failTables = new Set<string>();

  constructor(tables: Record<string, Row[]> = {}) {
    this.tables = {
      contacts: [],
      opportunities: [],
      legacy_adapter_usage: [],
      ...tables,
    };
  }

  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    return new MockQueryBuilder(this, table);
  }
}

class MockQueryBuilder implements PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> {
  private filters: Array<(row: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private op: "select" | "insert" | "update" = "select";
  private opPayload: unknown = null;

  constructor(
    private readonly db: MockSupabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((row) => set.has(row[col]));
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(payload: unknown) {
    this.op = "insert";
    this.opPayload = payload;
    return this;
  }

  update(payload: unknown) {
    this.op = "update";
    this.opPayload = payload;
    return this;
  }

  private failed() {
    return this.db.failTables.has(this.table);
  }

  then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: { message: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this.failed()) {
      return Promise.resolve({ data: null, error: { message: `${this.table} unavailable` } }).then(
        onfulfilled,
        onrejected,
      );
    }
    const rows = this.db.tables[this.table] ?? [];

    if (this.op === "insert") {
      const items = Array.isArray(this.opPayload)
        ? (this.opPayload as Row[])
        : [this.opPayload as Row];
      const inserted = items.map((item) => ({ ...item }));
      rows.push(...inserted);
      return Promise.resolve({ data: this.isSingle ? inserted[0] : inserted, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }

    if (this.op === "update") {
      const patch = (this.opPayload as Row) || {};
      let count = 0;
      for (const row of rows) {
        if (this.filters.every((f) => f(row))) {
          Object.assign(row, patch);
          count += 1;
        }
      }
      void count;
      return Promise.resolve({
        data: rows.filter((r) => this.filters.every((f) => f(r))),
        error: null,
      }).then(onfulfilled, onrejected);
    }

    let matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.orderCol) {
      const col = this.orderCol;
      matched = [...matched].sort((a, b) => {
        if (a[col] === b[col]) return 0;
        if (a[col] == null) return 1;
        if (b[col] == null) return -1;
        return this.orderAsc ? (a[col]! < b[col]! ? -1 : 1) : a[col]! > b[col]! ? -1 : 1;
      });
    }
    if (this.limitCount !== null) matched = matched.slice(0, this.limitCount);
    if (this.isSingle) {
      return Promise.resolve({
        data: matched[0] || null,
        error: matched[0] ? null : { message: "No rows found" },
      }).then(onfulfilled, onrejected);
    }
    if (this.isMaybeSingle) {
      return Promise.resolve({ data: matched[0] || null, error: null }).then(
        onfulfilled,
        onrejected,
      );
    }
    return Promise.resolve({ data: matched, error: null }).then(onfulfilled, onrejected);
  }
}

async function runTelemetrySuite() {
  console.log("Running Legacy Adapter Telemetry test suite...");
  const client = (db: MockSupabase) => db as unknown as SupabaseClient;

  // Test 1: wrapper links rows and records first-use telemetry.
  {
    const db = new MockSupabase({
      contacts: [
        {
          id: "c-1",
          company_id: "co-1",
          primary_email: "sam@example.com",
          source_record_id: "s-1",
        },
      ],
      opportunities: [],
    });
    const result = await attachRevenueLinkageWithTelemetry(
      client(db),
      [{ id: "s-1", email: "sam@example.com" }],
      { sourceRecordType: "crm" },
      { route: "admin-test" },
    );
    assert.equal(result.schemaReady, true);
    assert.equal(result.records[0]?.revenue_os.contact_id, "c-1");
    const usage = db.tables.legacy_adapter_usage!;
    assert.equal(usage.length, 1);
    assert.equal(usage[0]?.route, "admin-test");
    assert.equal(usage[0]?.calls, 1);
    assert.equal(usage[0]?.total_rows, 1);
    assert.equal(usage[0]?.linked_rows, 1);
  }

  // Test 2: repeat calls accumulate instead of duplicating rows.
  {
    const db = new MockSupabase({ contacts: [], opportunities: [] });
    const supabase = client(db);
    await attachRevenueLinkageWithTelemetry(
      supabase,
      [{ id: "a" }],
      { sourceRecordType: "crm" },
      { route: "admin-test" },
    );
    await attachRevenueLinkageWithTelemetry(
      supabase,
      [{ id: "a" }, { id: "b" }],
      { sourceRecordType: "crm" },
      { route: "admin-test" },
    );
    const usage = db.tables.legacy_adapter_usage!;
    assert.equal(usage.length, 1, "One ledger row per route");
    assert.equal(usage[0]?.calls, 2);
    assert.equal(usage[0]?.total_rows, 3);
    assert.equal(usage[0]?.linked_rows, 0);
  }

  // Test 3: adapter degradation still returns rows and records unlinked telemetry.
  {
    const db = new MockSupabase({ contacts: [], opportunities: [] });
    db.failTables.add("contacts");
    const result = await attachRevenueLinkageWithTelemetry(
      client(db),
      [{ id: "s-9", email: "x@y.zz" }],
      { sourceRecordType: "crm" },
      { route: "admin-test" },
    );
    assert.equal(result.schemaReady, false);
    assert.equal(result.records[0]?.revenue_os.contact_id, null);
    assert.equal(db.tables.legacy_adapter_usage![0]?.linked_rows, 0);
  }

  // Test 4: telemetry failure never breaks the read.
  {
    const db = new MockSupabase({
      contacts: [
        { id: "c-1", company_id: null, primary_email: "sam@example.com", source_record_id: null },
      ],
      opportunities: [],
    });
    db.failTables.add("legacy_adapter_usage");
    const result = await attachRevenueLinkageWithTelemetry(
      client(db),
      [{ id: "s-1", email: "sam@example.com" }],
      { sourceRecordType: "crm" },
      { route: "admin-test" },
    );
    assert.equal(
      result.records[0]?.revenue_os.contact_id,
      "c-1",
      "Read succeeds without telemetry",
    );
    const report = await getLegacyAdapterUsage(client(db));
    assert.equal(report.telemetryReady, false);
    assert.equal(report.consumers.length, LEGACY_ADAPTER_CONSUMERS.length);
  }

  // Test 5: registry names every compatibility consumer.
  {
    const routes = LEGACY_ADAPTER_CONSUMERS.map((c) => c.route).sort();
    assert.deepEqual(routes, [
      "admin-chat-leads",
      "admin-clients",
      "admin-contacts",
      "admin-inbox",
      "admin-leads",
      "admin-partners",
      "admin-resources",
      "admin-subscribers",
      "admin-website-grades",
    ]);
    for (const consumer of LEGACY_ADAPTER_CONSUMERS) {
      assert.ok(consumer.sourceTables.length > 0, `${consumer.route} must name its source tables`);
    }
  }

  // Test 6: reader joins runtime counters onto the registry.
  {
    const db = new MockSupabase({
      legacy_adapter_usage: [
        {
          route: "admin-leads",
          calls: 4,
          total_rows: 100,
          linked_rows: 70,
          first_used_at: "2026-09-01T00:00:00Z",
          last_used_at: "2026-09-03T00:00:00Z",
        },
      ],
    });
    const report = await getLegacyAdapterUsage(client(db));
    assert.equal(report.contract, "revenue-os-legacy-adapter-usage.v1");
    assert.equal(report.telemetryReady, true);
    const leads = report.consumers.find((c) => c.route === "admin-leads")!;
    assert.equal(leads.calls, 4);
    assert.equal(leads.linkedRows, 70);
    assert.deepEqual(leads.sourceTables, ["solution_requests"]);
    const idle = report.consumers.find((c) => c.route === "admin-inbox")!;
    assert.equal(idle.calls, 0, "Unhit routes list with zero counters, not absence");
  }

  // Test 7: recordLegacyAdapterUse returns false (not throw) when the table is missing.
  {
    const db = new MockSupabase();
    db.failTables.add("legacy_adapter_usage");
    const ok = await recordLegacyAdapterUse(client(db), {
      route: "admin-test",
      rows: 5,
      linked: 1,
    });
    assert.equal(ok, false);
  }

  console.log("All 7 Legacy Adapter Telemetry tests passed successfully!");
}

runTelemetrySuite().catch((err) => {
  console.error("Legacy Adapter Telemetry test suite failed:", err);
  process.exit(1);
});

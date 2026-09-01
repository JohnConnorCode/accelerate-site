/**
 * An in-memory stand-in for the Supabase client, for deterministic tests.
 *
 * It keeps rows, so an update genuinely changes what a later read returns.
 * That matters more than it sounds: most of the bugs these tests exist to catch
 * are sequencing bugs (a claim that must only fire once, a row that must be
 * retired before a key is free again), and a stub that forgets writes cannot
 * express them.
 *
 * It supports the PostgREST subset the Revenue OS actually uses. Anything
 * outside that subset is better added here than worked around in a test, so
 * there stays one harness rather than a slightly different one per file.
 */
export type Row = Record<string, unknown>;
export type QueryFailure = { code?: string; message: string };

/** Parse the `or()` filter string form, e.g. `expires_at.is.null,expires_at.gt.2026-01-01`. */
function orPredicate(expression: string): (row: Row) => boolean {
  const clauses = expression.split(",").map((clause) => {
    const [column, op, ...rest] = clause.split(".");
    const value = rest.join(".");
    return (row: Row) => {
      const actual = row[column ?? ""];
      switch (op) {
        case "is":
          return value === "null" ? actual === null || actual === undefined : actual === value;
        case "eq":
          return String(actual) === value;
        case "gt":
          return actual !== null && actual !== undefined && String(actual) > value;
        case "lt":
          return actual !== null && actual !== undefined && String(actual) < value;
        default:
          throw new Error(`memory-supabase: unsupported or() operator "${op}" in "${clause}"`);
      }
    };
  });
  return (row) => clauses.some((matches) => matches(row));
}

export class MemorySupabase {
  readonly tables: Record<string, Row[]>;
  private readonly failures: Record<string, QueryFailure> = {};
  private sequence = 0;

  constructor(seed: Record<string, Row[]> = {}) {
    this.tables = JSON.parse(JSON.stringify(seed));
  }

  /** Make every query against `table` return this error, as supabase-js would. */
  fail(table: string, error: QueryFailure) {
    this.failures[table] = error;
  }
  recover(table: string) {
    delete this.failures[table];
  }
  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }

  /**
   * Stub a Postgres function. The atomic claims live in RPCs, so anything
   * testing recovery or single-shot behaviour needs to drive them.
   */
  rpc(name: string, handler: (args: Record<string, unknown>) => unknown) {
    this.procedures[name] = handler;
  }

  /** Every rpc() call made, in order, for asserting what was invoked. */
  readonly rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  private readonly procedures: Record<string, (args: Record<string, unknown>) => unknown> = {};

  /** The object to hand to code expecting a SupabaseClient. */
  get client() {
    return {
      from: (table: string) => this.query(table),
      rpc: (name: string, args: Record<string, unknown>) => {
        this.rpcCalls.push({ name, args });
        const handler = this.procedures[name];
        const settle = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
          if (!handler)
            return resolve({
              data: null,
              error: { message: `memory-supabase: no stub registered for rpc "${name}"` },
            });
          try {
            const value = handler(args);
            // A handler may return `{ error }` to simulate a failing function.
            if (value && typeof value === "object" && "error" in (value as Row))
              return resolve(value as { data: unknown; error: unknown });
            return resolve({ data: value, error: null });
          } catch (error) {
            return resolve({
              data: null,
              error: { message: error instanceof Error ? error.message : String(error) },
            });
          }
        };
        const self: Record<string, unknown> = {};
        self.single = self.maybeSingle = () => self;
        self.then = settle;
        return self;
      },
    } as never;
  }

  private query(table: string) {
    this.tables[table] ??= [];
    const filters: Array<(row: Row) => boolean> = [];
    let op: "read" | "insert" | "update" | "upsert" | "delete" = "read";
    let conflictColumns: string[] = [];
    let ignoreDuplicates = false;
    let payload: Row = {};
    let one = false;
    let sort: { column: string; ascending: boolean } | null = null;
    let cap: number | null = null;

    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const method of ["select", "range", "filter"]) self[method] = chain;

    self.single = self.maybeSingle = () => {
      one = true;
      return self;
    };
    self.limit = (count: number) => {
      cap = count;
      return self;
    };
    self.order = (column: string, options?: { ascending?: boolean }) => {
      sort = { column, ascending: options?.ascending !== false };
      return self;
    };

    self.eq = (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return self;
    };
    self.neq = (column: string, value: unknown) => {
      filters.push((row) => row[column] !== value);
      return self;
    };
    self.gt = (column: string, value: string) => {
      filters.push((row) => row[column] != null && String(row[column]) > value);
      return self;
    };
    self.gte = (column: string, value: string) => {
      filters.push((row) => row[column] != null && String(row[column]) >= value);
      return self;
    };
    self.lt = (column: string, value: string) => {
      filters.push((row) => row[column] != null && String(row[column]) < value);
      return self;
    };
    self.lte = (column: string, value: string) => {
      filters.push((row) => row[column] != null && String(row[column]) <= value);
      return self;
    };
    self.in = (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return self;
    };
    self.is = (column: string, value: unknown) => {
      filters.push((row) => (value === null ? row[column] == null : row[column] === value));
      return self;
    };
    self.not = (column: string, _operator: string, value: unknown) => {
      filters.push((row) => (value === null ? row[column] != null : row[column] !== value));
      return self;
    };
    self.or = (expression: string) => {
      filters.push(orPredicate(expression));
      return self;
    };
    // Array containment, as used for `recipient_emails`.
    self.contains = (column: string, values: unknown[]) => {
      filters.push((row) => {
        const actual = Array.isArray(row[column]) ? (row[column] as unknown[]) : [];
        return values.every((value) => actual.includes(value));
      });
      return self;
    };

    self.insert = (next: Row) => {
      op = "insert";
      payload = next;
      return self;
    };
    self.update = (next: Row) => {
      op = "update";
      payload = next;
      return self;
    };
    self.delete = () => {
      op = "delete";
      return self;
    };
    /**
     * Upsert on a composite conflict target, as the communication sender uses
     * to make an idempotent retry reuse its conversation. `ignoreDuplicates`
     * returns no row on a conflict, which the caller then re-reads, so that
     * branch has to be reproduced faithfully or the retry path goes untested.
     */
    self.upsert = (next: Row, options?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
      op = "upsert";
      payload = next;
      conflictColumns = (options?.onConflict ?? "")
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
      ignoreDuplicates = Boolean(options?.ignoreDuplicates);
      return self;
    };

    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      const failure = this.failures[table];
      if (failure) return resolve({ data: null, error: failure });

      if (op === "upsert") {
        const existing = conflictColumns.length
          ? this.tables[table]!.find((row) =>
              conflictColumns.every((column) => row[column] === payload[column]),
            )
          : undefined;
        if (existing) {
          // Postgres returns nothing for an ignored duplicate, and the caller
          // re-reads. Reproducing that is the point.
          if (ignoreDuplicates) return resolve({ data: one ? null : [], error: null });
          Object.assign(existing, payload);
          return resolve({ data: one ? existing : [existing], error: null });
        }
        const created: Row = { id: `row-${++this.sequence}`, ...payload };
        this.tables[table]!.push(created);
        return resolve({ data: one ? created : [created], error: null });
      }

      if (op === "insert") {
        if (
          table === "ai_messages" &&
          payload.client_message_id &&
          this.tables[table]!.some(
            (row) =>
              row.conversation_id === payload.conversation_id &&
              row.client_message_id === payload.client_message_id,
          )
        ) {
          return resolve({
            data: null,
            error: { code: "23505", message: "duplicate AI client message" },
          });
        }
        // Honour the partial unique index the real action_queue carries: one
        // pending row per dedupe key. Several tests hinge on that constraint.
        const key = payload.dedupe_key;
        if (
          key &&
          this.tables[table]!.some((row) => row.dedupe_key === key && row.status === "pending")
        ) {
          return resolve({
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          });
        }
        const row: Row = { id: `row-${++this.sequence}`, status: "pending", ...payload };
        this.tables[table]!.push(row);
        return resolve({ data: one ? row : [row], error: null });
      }

      let matched = this.tables[table]!.filter((row) => filters.every((keep) => keep(row)));
      if (op === "update") for (const row of matched) Object.assign(row, payload);
      if (op === "delete") {
        const removing = new Set(matched);
        this.tables[table] = this.tables[table]!.filter((row) => !removing.has(row));
      }
      if (sort) {
        const { column, ascending } = sort;
        matched = [...matched].sort(
          (a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1),
        );
      }
      if (cap !== null) matched = matched.slice(0, cap);
      return resolve({ data: one ? (matched[0] ?? null) : matched, error: null });
    };
    return self;
  }
}

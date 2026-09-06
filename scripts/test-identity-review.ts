import assert from "node:assert/strict";
import {
  listIdentityReviewItems,
  resolveIdentityReview,
  IDENTITY_REVIEW_CONTRACT,
} from "../src/lib/revenue-os/identity-review";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

class MockSupabase {
  public tables: Record<string, Row[]> = {
    action_queue: [],
    conversations: [],
    contacts: [],
    companies: [],
    opportunities: [],
    activities: [],
    audit_log: [],
    claims: [],
    evidence: [],
    learned_policies: [],
    agent_memory: [],
  };

  from(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
    return new MockQueryBuilder(this, table);
  }

  rpc(fn: string, params: Row = {}) {
    const tables = this.tables;
    const runner = {
      single() {
        return runner;
      },
      then<TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
        onfulfilled?:
          | ((value: {
              data: unknown;
              error: { message: string } | null;
            }) => TResult1 | PromiseLike<TResult1>)
          | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): Promise<TResult1 | TResult2> {
        if (fn === "record_evidence") {
          if (!tables["claims"]) tables["claims"] = [];
          if (!tables["evidence"]) tables["evidence"] = [];
          const key = `${params.p_entity_type}|${params.p_entity_id}|${params.p_field}|${params.p_proposed_value}`;
          let claim = tables["claims"].find((c) => c._key === key);
          let isNew = false;
          if (!claim) {
            claim = {
              id: `claim-${tables["claims"].length + 1}`,
              _key: key,
              entity_type: params.p_entity_type,
              entity_id: params.p_entity_id,
              field: params.p_field,
              proposed_value: params.p_proposed_value,
              status: "supported",
              best_evidence: params.p_strength,
            };
            tables["claims"].push(claim);
            isNew = true;
          }
          const evidenceRow = {
            id: `ev-${tables["evidence"].length + 1}`,
            claim_id: claim.id,
            source_type: params.p_source_type,
            observation: params.p_observation,
            strength: params.p_strength,
          };
          tables["evidence"].push(evidenceRow);
          return Promise.resolve({
            data: {
              claim_id: claim.id,
              evidence_id: evidenceRow.id,
              claim_status: claim.status,
              best_evidence: claim.best_evidence,
              is_new_claim: isNew,
            },
            error: null,
          }).then(onfulfilled, onrejected);
        }
        return Promise.resolve({
          data: null,
          error: { message: `unknown rpc ${fn}` },
        }).then(onfulfilled, onrejected);
      },
    };
    return runner;
  }
}

class MockQueryBuilder implements PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> {
  private filters: Array<(row: Row) => boolean> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private nullsFirst = false;
  private limitCount: number | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private op: "select" | "insert" | "update" | "delete" = "select";
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

  neq(col: string, val: unknown) {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  not(col: string, op: string, val: unknown) {
    this.filters.push((row) => {
      if (op === "is") return row[col] !== val;
      return true;
    });
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push((row) => {
      const actual = row[col];
      if (actual == null || val == null) return false;
      return actual < val;
    });
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push((row) => {
      const actual = row[col];
      if (actual == null || val == null) return false;
      return actual > val;
    });
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = pattern.replace(/\\/g, "").replace(/%/g, "").toLowerCase();
    this.filters.push((row) => {
      const val = String(row[col] ?? "").toLowerCase();
      return val.includes(clean);
    });
    return this;
  }

  contains(col: string, val: unknown) {
    this.filters.push((row) => {
      const fieldVal = row[col];
      if (Array.isArray(fieldVal) && Array.isArray(val)) {
        return val.every((v) => fieldVal.includes(v));
      }
      return false;
    });
    return this;
  }

  in(col: string, vals: unknown[]) {
    const set = new Set(vals);
    this.filters.push((row) => set.has(row[col]));
    return this;
  }

  or(conditions: string) {
    const parts = conditions.split(",");
    this.filters.push((row) => {
      return parts.some((part) => {
        const [field, op, ...rest] = part.split(".");
        const val = rest.join(".");
        if (!field || !op) return false;
        if (op === "eq") return String(row[field]) === val;
        if (op === "is") return val === "null" ? row[field] == null : row[field] === val;
        if (op === "gt") return row[field] != null && row[field]! > val;
        if (op === "lt") return row[field] != null && row[field]! < val;
        return false;
      });
    });
    return this;
  }

  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending ?? true;
    this.nullsFirst = options?.nullsFirst ?? false;
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

  delete() {
    this.op = "delete";
    return this;
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
    const rows = this.db.tables[this.table] ?? [];

    if (this.op === "insert") {
      const items = Array.isArray(this.opPayload)
        ? (this.opPayload as Row[])
        : [this.opPayload as Row];
      if (this.table === "action_queue") {
        for (const item of items) {
          const key = (item as Row).dedupe_key;
          if (
            key &&
            rows.some((row) => row.dedupe_key === key && (row.status ?? "pending") === "pending")
          ) {
            return Promise.resolve({
              data: null,
              error: { message: "duplicate key value violates unique constraint", code: "23505" },
            }).then(onfulfilled, onrejected);
          }
        }
      }
      const inserted: Row[] = items.map((item: Row) => ({
        id: (item.id as string) || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(this.table === "action_queue" ? { status: "pending" } : {}),
        ...item,
      }));
      rows.push(...inserted);
      const res = {
        data: this.isSingle ? inserted[0] : inserted,
        error: null,
      };
      return Promise.resolve(res).then(onfulfilled, onrejected);
    }

    if (this.op === "update") {
      const updatedRows: Row[] = [];
      const patch = (this.opPayload as Row) || {};
      for (let i = 0; i < rows.length; i++) {
        if (this.filters.every((f) => f(rows[i]!))) {
          rows[i] = { ...rows[i], ...patch, updated_at: new Date().toISOString() };
          updatedRows.push(rows[i]!);
        }
      }
      const first = updatedRows[0] || null;
      const res = {
        data: this.isSingle ? first : this.isMaybeSingle ? first : updatedRows,
        error: null,
      };
      return Promise.resolve(res).then(onfulfilled, onrejected);
    }

    let matched = rows.filter((r) => this.filters.every((f) => f(r)));

    if (this.orderCol) {
      const col = this.orderCol;
      matched.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return this.nullsFirst ? -1 : 1;
        if (valB == null) return this.nullsFirst ? 1 : -1;
        return this.orderAsc ? (valA < valB ? -1 : 1) : valA > valB ? -1 : 1;
      });
    }

    if (this.limitCount !== null) {
      matched = matched.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return Promise.resolve({
        data: matched[0] || null,
        error: matched[0] ? null : { message: "No rows found" },
      }).then(onfulfilled, onrejected);
    }

    if (this.isMaybeSingle) {
      return Promise.resolve({
        data: matched[0] || null,
        error: null,
      }).then(onfulfilled, onrejected);
    }

    return Promise.resolve({ data: matched, error: null }).then(onfulfilled, onrejected);
  }
}

function seedReviewAction(db: MockSupabase, overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: `review-${db.tables.action_queue!.length + 1}`,
    action_type: "identity_review",
    status: "pending",
    payload: {
      conversation_id: "conv-1",
      participant_email: "sam@example.com",
      reason: "unknown",
      candidates: [],
      thread_id: "thread-1",
    },
    source_context: "gmail_record_association",
    entity_type: "conversation",
    entity_id: "conv-1",
    dedupe_key: `identity-review:conv-1:sam@example.com:${db.tables.action_queue!.length + 1}`,
    created_at: new Date().toISOString(),
    ...overrides,
  };
  db.tables.action_queue!.push(row);
  return row;
}

async function runIdentityReviewSuite() {
  console.log("Running Identity Review test suite...");

  // Test 1: empty queue lists nothing.
  {
    const db = new MockSupabase();
    const result = await listIdentityReviewItems(db as unknown as SupabaseClient, {});
    assert.equal(result.contract, IDENTITY_REVIEW_CONTRACT);
    assert.deepEqual(result.items, []);
  }

  // Test 2: bounded read model hydrates source, candidates, evidence, downstream.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.contacts!.push(
      { id: "c-1", full_name: "Sam One", primary_email: "sam@example.com", company_id: "co-1" },
      { id: "c-2", full_name: "Sam Two", primary_email: "sam@example.com", company_id: null },
    );
    db.tables.companies!.push({ id: "co-1", name: "Example Co", domain: "example.com" });
    db.tables.conversations!.push({
      id: "conv-1",
      subject: "Hello",
      status: "open",
      contact_id: null,
      company_id: null,
      opportunity_id: null,
    });
    db.tables.claims!.push({
      id: "claim-1",
      entity_type: "conversation",
      entity_id: "conv-1",
      field: "contact_id",
      best_evidence: "verified_external",
    });
    db.tables.evidence!.push({
      id: "ev-1",
      claim_id: "claim-1",
      strength: "verified_external",
      observation: "Exact email match",
      source_type: "gmail_thread",
    });
    seedReviewAction(db, {
      id: "review-1",
      payload: {
        conversation_id: "conv-1",
        participant_email: "sam@example.com",
        reason: "ambiguous",
        candidates: [
          { id: "c-1", full_name: "Sam One", primary_email: "sam@example.com" },
          { id: "c-2", full_name: "Sam Two", primary_email: "sam@example.com" },
        ],
        thread_id: "thread-1",
      },
    });
    const result = await listIdentityReviewItems(supabase, {});
    assert.equal(result.items.length, 1);
    const item = result.items[0]!;
    assert.equal(item.actionId, "review-1");
    assert.equal(item.reason, "ambiguous");
    assert.equal(item.source, "gmail_record_association");
    assert.equal(item.participantEmail, "sam@example.com");
    assert.equal(item.candidates.length, 2);
    assert.equal(item.candidates[0]?.company_name, "Example Co");
    assert.equal(item.evidence.length, 1);
    assert.equal(item.evidence[0]?.strength, "verified_external");
    assert.equal(item.downstream.conversationSubject, "Hello");
    assert.equal(item.downstream.contactId, null);
  }

  // Test 3: link resolves with canonical IDs and writes human evidence.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.contacts!.push({
      id: "c-1",
      full_name: "Sam One",
      primary_email: "sam@example.com",
      company_id: "co-1",
    });
    db.tables.companies!.push({ id: "co-1", name: "Example Co", domain: "example.com" });
    db.tables.conversations!.push({
      id: "conv-1",
      subject: "Hello",
      status: "open",
      contact_id: null,
      company_id: null,
      opportunity_id: null,
      metadata: {},
    });
    seedReviewAction(db, { id: "review-1" });
    const result = await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "link",
      contactId: "c-1",
      actorEmail: "founder@test.local",
    });
    assert.equal(result.decision, "link");
    assert.equal(result.replayed, false);
    assert.equal(result.contactId, "c-1");
    assert.equal(result.companyId, "co-1");
    assert.equal(db.tables.conversations!.find((c) => c.id === "conv-1")?.contact_id, "c-1");
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "executed");
    assert.ok(
      db.tables.claims!.some((c) => c.best_evidence === "human_entered"),
      "Link must record human-entered evidence",
    );
    assert.ok(
      db.tables.activities!.some((a) => a.activity_type === "identity_review_resolved"),
      "Link must write a decision receipt",
    );
    assert.ok(
      db.tables.audit_log!.some((a) => a.action === "identity_review.resolved"),
      "Link must write an audit row",
    );
  }

  // Test 4: stale candidates refuse instead of linking the wrong record.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.contacts!.push({
      id: "c-9",
      full_name: "Other Sam",
      primary_email: "other@example.com",
      company_id: null,
    });
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, { id: "review-1" });
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-1",
        decision: "link",
        contactId: "c-9",
        actorEmail: "founder@test.local",
      }),
      /Identity changed after review/,
    );
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "failed");
    assert.equal(db.tables.conversations!.find((c) => c.id === "conv-1")?.contact_id, null);
  }

  // Test 5: create writes a new contact, links it, and never seeds companies from personal domains.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, {
      id: "review-1",
      payload: {
        conversation_id: "conv-1",
        participant_email: "newfriend@gmail.com",
        reason: "unknown",
        candidates: [],
        thread_id: "thread-1",
      },
    });
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-1",
        decision: "create",
        fullName: "New Friend",
        companyName: "Friend Co",
        actorEmail: "founder@test.local",
      }),
      /personal email address cannot seed a company/,
    );
    assert.equal(db.tables.companies!.length, 0);
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "failed");
    seedReviewAction(db, {
      id: "review-2",
      payload: {
        conversation_id: "conv-1",
        participant_email: "newfriend@gmail.com",
        reason: "unknown",
        candidates: [],
        thread_id: "thread-1",
      },
    });
    const created = await resolveIdentityReview(supabase, {
      actionId: "review-2",
      decision: "create",
      fullName: "New Friend",
      actorEmail: "founder@test.local",
    });
    assert.equal(created.decision, "create");
    assert.ok(created.contactId, "Create must return the new contact");
    assert.equal(created.companyId, null);
    assert.equal(
      db.tables.conversations!.find((c) => c.id === "conv-1")?.contact_id,
      created.contactId,
    );
  }

  // Test 6: create with a business domain and founder company name succeeds.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, {
      id: "review-1",
      payload: {
        conversation_id: "conv-1",
        participant_email: "sam@bigco.io",
        reason: "unknown",
        candidates: [],
        thread_id: "thread-1",
      },
    });
    const created = await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "create",
      fullName: "Sam Big",
      companyName: "Big Co",
      actorEmail: "founder@test.local",
    });
    assert.ok(created.companyId, "Business domain plus founder name creates the company");
    assert.equal(db.tables.companies!.find((c) => c.id === created.companyId)?.domain, "bigco.io");
  }

  // Test 7: no_match records the decision and leaves the conversation unlinked.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, { id: "review-1" });
    const result = await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "no_match",
      actorEmail: "founder@test.local",
    });
    assert.equal(result.decision, "no_match");
    assert.equal(db.tables.conversations!.find((c) => c.id === "conv-1")?.contact_id, null);
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "executed");
    assert.ok(
      db.tables.claims!.some((c) => c.best_evidence === "human_entered"),
      "No-match must write immutable decision evidence",
    );
  }

  // Test 8: defer keeps the item pending with receipts.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, { id: "review-1" });
    const result = await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "defer",
      actorEmail: "founder@test.local",
    });
    assert.equal(result.decision, "defer");
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "pending");
    assert.ok(
      db.tables.activities!.some((a) => a.activity_type === "identity_review_deferred"),
      "Defer must write a receipt",
    );
  }

  // Test 9: replay of an executed action returns the stored result without new writes.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.contacts!.push({
      id: "c-1",
      full_name: "Sam One",
      primary_email: "sam@example.com",
      company_id: null,
    });
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, { id: "review-1" });
    await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "link",
      contactId: "c-1",
      actorEmail: "founder@test.local",
    });
    const activitiesBefore = db.tables.activities!.length;
    const replayed = await resolveIdentityReview(supabase, {
      actionId: "review-1",
      decision: "link",
      contactId: "c-1",
      actorEmail: "founder@test.local",
    });
    assert.equal(replayed.replayed, true);
    assert.equal(replayed.contactId, "c-1");
    assert.equal(db.tables.activities!.length, activitiesBefore, "Replay must not write again");
  }

  // Test 10: a claimed-by-other action refuses the second resolver.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    db.tables.conversations!.push({ id: "conv-1", contact_id: null, metadata: {} });
    seedReviewAction(db, { id: "review-1", status: "executing" });
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-1",
        decision: "no_match",
        actorEmail: "founder@test.local",
      }),
      /already handled/,
    );
  }

  // Test 11: generic approval of a review item fails closed with guidance.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    seedReviewAction(db, { id: "review-1" });
    await assert.rejects(
      approveAndExecuteAction(supabase, "review-1", "founder@test.local"),
      /Identity review workbench/,
    );
    assert.equal(db.tables.action_queue!.find((a) => a.id === "review-1")?.status, "failed");
  }

  // Test 12: invalid input fails loud with no writes.
  {
    const db = new MockSupabase();
    const supabase = db as unknown as SupabaseClient;
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "  ",
        decision: "link",
        contactId: "c-1",
        actorEmail: "founder@test.local",
      }),
      /Action id is required/,
    );
    seedReviewAction(db, { id: "review-link" });
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-link",
        decision: "link",
        actorEmail: "founder@test.local",
      }),
      /canonical contact id/,
    );
    seedReviewAction(db, { id: "review-create" });
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-create",
        decision: "create",
        actorEmail: "founder@test.local",
      }),
      /full name/,
    );
    await assert.rejects(
      resolveIdentityReview(supabase, {
        actionId: "review-missing",
        decision: "no_match",
        actorEmail: "founder@test.local",
      }),
      /not found/,
    );
    assert.equal(db.tables.activities!.length, 0, "Invalid input must write nothing");
  }

  console.log("All 12 Identity Review tests passed successfully!");
}

runIdentityReviewSuite().catch((err) => {
  console.error("Identity Review test suite failed:", err);
  process.exit(1);
});

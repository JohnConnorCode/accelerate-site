import assert from "node:assert/strict";
import {
  listConversations,
  getConversationDetail,
  updateConversationStatus,
  linkConversationRecord,
  createOpportunityFromConversation,
  createTaskFromConversation,
  associateConversationParticipants,
  CONVERSATION_ASSOCIATION_CONTRACT,
  CONVERSATIONS_CONTRACT,
} from "../src/lib/revenue-os/conversations";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

class MockSupabase {
  public tables: Record<string, Row[]> = {
    conversations: [],
    messages: [],
    contacts: [],
    companies: [],
    opportunities: [],
    tasks: [],
    activities: [],
    audit_log: [],
    stage_events: [],
    action_queue: [],
    claims: [],
    evidence: [],
    learned_policies: [],
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
          | ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
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
    const clean = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((row) => {
      const val = String(row[col] ?? "").toLowerCase();
      return val.includes(clean);
    });
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push((row) => row[col] === val);
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
        const [field, op, val] = part.split(".");
        if (field && op === "eq") {
          return String(row[field]) === val;
        }
        return false;
      });
    });
    return this;
  }

  order(col: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
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
      // The real action_queue has a unique pending-dedupe-key index; replaying
      // the same proposal must collide rather than duplicate.
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
      const res = {
        data: this.isSingle ? updatedRows[0] || null : updatedRows,
        error: null,
      };
      return Promise.resolve(res).then(onfulfilled, onrejected);
    }

    // Select
    let matched = rows.filter((r) => this.filters.every((f) => f(r)));

    if (this.orderCol) {
      const col = this.orderCol;
      matched.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
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

async function runConversationsSuite() {
  console.log("Running Conversations Omnichannel Inbox test suite...");

  const db = new MockSupabase();
  const supabase = db as unknown as SupabaseClient;

  // 1. Seed test data
  const contactId = "contact-100";
  const companyId = "company-100";
  const oppId = "opp-100";

  db.tables.contacts!.push({
    id: contactId,
    full_name: "Sarah Connor",
    primary_email: "sarah@techcorp.io",
    phone: "555-0199",
    company_id: companyId,
  });

  db.tables.companies!.push({
    id: companyId,
    name: "TechCorp Systems",
    domain: "techcorp.io",
  });

  db.tables.opportunities!.push({
    id: oppId,
    contact_id: contactId,
    company_id: companyId,
    name: "TechCorp Enterprise Deal",
    stage: "qualified",
    estimated_value: 25000,
  });

  const conv1 = {
    id: "conv-1",
    channel: "gmail",
    subject: "Pricing inquiry for Enterprise",
    status: "open",
    intent: "pricing",
    unread_count: 2,
    contact_id: contactId,
    company_id: companyId,
    opportunity_id: oppId,
    last_message_at: "2026-09-01T14:00:00Z",
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T14:00:00Z",
  };

  const conv2 = {
    id: "conv-2",
    channel: "form",
    subject: "Inbound website lead",
    status: "waiting",
    intent: "demo",
    unread_count: 0,
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    last_message_at: "2026-08-30T10:00:00Z",
    created_at: "2026-08-30T10:00:00Z",
    updated_at: "2026-08-30T10:00:00Z",
  };

  const conv3 = {
    id: "conv-3",
    channel: "chat",
    subject: "Support question",
    status: "resolved",
    intent: "support",
    unread_count: 0,
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    last_message_at: "2026-08-28T09:00:00Z",
    created_at: "2026-08-28T09:00:00Z",
    updated_at: "2026-08-28T09:00:00Z",
  };

  db.tables.conversations!.push(conv1, conv2, conv3);

  db.tables.messages!.push(
    {
      id: "msg-1",
      conversation_id: "conv-1",
      direction: "inbound",
      sender_email: "sarah@techcorp.io",
      recipient_emails: ["founder@company.com"],
      subject: "Pricing inquiry for Enterprise",
      body_text: "Hi, can you send over the pricing and cost breakdown for 50 seats?",
      status: "received",
      created_at: "2026-09-01T12:00:00Z",
    },
    {
      id: "msg-2",
      conversation_id: "conv-1",
      direction: "outbound",
      sender_email: "founder@company.com",
      recipient_emails: ["sarah@techcorp.io"],
      subject: "Re: Pricing inquiry for Enterprise",
      body_text: "Hi Sarah, absolutely! I will prepare the numbers for you.",
      status: "sent",
      created_at: "2026-09-01T13:00:00Z",
    },
  );

  // Test 1: listConversations and stats
  const listAll = await listConversations(supabase, { status: "all" });
  assert.equal(listAll.conversations.length, 3, "Should return all 3 conversations");
  assert.equal(listAll.stats.total, 3, "Total should be 3");
  assert.equal(listAll.stats.open, 1, "Open count should be 1");
  assert.equal(listAll.stats.waiting, 1, "Waiting count should be 1");
  assert.equal(listAll.stats.resolved, 1, "Resolved count should be 1");
  assert.equal(listAll.stats.unread, 1, "Unread count should be 1");

  // Test 2: Filter by unread
  const unreadOnly = await listConversations(supabase, { unreadOnly: true });
  assert.equal(unreadOnly.conversations.length, 1, "Should filter to 1 unread conversation");
  assert.equal(unreadOnly.conversations[0]?.id, "conv-1");

  // Test 3: Filter by channel
  const formChannel = await listConversations(supabase, { channel: "form" });
  assert.equal(formChannel.conversations.length, 1);
  assert.equal(formChannel.conversations[0]?.id, "conv-2");

  // Test 4: Filter by linked records
  const linkedOnly = await listConversations(supabase, { record: "linked" });
  assert.equal(linkedOnly.conversations.length, 1);
  assert.equal(linkedOnly.conversations[0]?.id, "conv-1");
  assert.equal(linkedOnly.conversations[0]?.contact?.full_name, "Sarah Connor");
  assert.equal(linkedOnly.conversations[0]?.opportunity?.name, "TechCorp Enterprise Deal");

  // Test 5: Search
  const searchRes = await listConversations(supabase, { search: "TechCorp" });
  assert.equal(searchRes.conversations.length, 1);
  assert.equal(searchRes.conversations[0]?.id, "conv-1");

  // Test 6: getConversationDetail
  const detail = await getConversationDetail(supabase, "conv-1");
  assert.ok(detail, "Detail should exist");
  assert.equal(detail.contract, CONVERSATIONS_CONTRACT);
  assert.equal(detail.messages.length, 2, "Should load 2 messages");
  assert.equal(detail.contact?.full_name, "Sarah Connor");
  assert.equal(detail.company?.name, "TechCorp Systems");
  assert.ok(detail.suggestedReply, "Should generate suggested AI reply based on pricing keywords");
  assert.equal(detail.suggestedReply?.intent, "pricing_inquiry");

  // Test 7: updateConversationStatus
  const updated = await updateConversationStatus(supabase, {
    id: "conv-1",
    status: "resolved",
    actorEmail: "founder@accelerate.local",
  });
  assert.equal(updated.status, "resolved");
  assert.equal(updated.unread_count, 0, "Unread count must reset to 0 on resolve");
  assert.ok(
    db.tables.activities!.some((a) => a.activity_type === "conversation_status_updated"),
    "Should record activity receipt",
  );
  assert.ok(
    db.tables.audit_log!.some((a) => a.action === "conversation.status_resolved"),
    "Should record audit log",
  );

  // Test 8: linkConversationRecord
  const linked = await linkConversationRecord(supabase, {
    conversationId: "conv-2",
    opportunityId: oppId,
    actorEmail: "founder@accelerate.local",
  });
  assert.equal(linked.opportunity_id, oppId);

  // Test 9: createTaskFromConversation
  const taskRes = await createTaskFromConversation(supabase, {
    conversationId: "conv-1",
    title: "Send custom enterprise quote",
    dueDate: "2026-09-05",
    priority: "high",
    actorEmail: "founder@accelerate.local",
  });
  assert.ok(taskRes.task, "Task must be created");
  assert.equal(taskRes.task.title, "Send custom enterprise quote");
  assert.equal(taskRes.task.opportunity_id, oppId);

  // Test 10: createOpportunityFromConversation
  const oppRes = await createOpportunityFromConversation(supabase, {
    conversationId: "conv-2",
    name: "New Inbound Contract",
    email: "lead@example.com",
    estimatedValue: 15000,
    actorEmail: "founder@accelerate.local",
  });
  assert.ok(oppRes.opportunity, "Opportunity must be created");
  assert.equal(oppRes.opportunity.name, "New Inbound Contract");
  assert.equal(oppRes.conversation.opportunity_id, oppRes.opportunity.id);

  // Test 11: deterministic auto-link with recorded evidence.
  db.tables.conversations!.push({
    id: "conv-10",
    channel: "gmail",
    subject: "Follow-up",
    status: "open",
    unread_count: 1,
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    metadata: { contact_email: "sarah@techcorp.io" },
    created_at: "2026-09-02T10:00:00Z",
    updated_at: "2026-09-02T10:00:00Z",
  });
  const assoc = await associateConversationParticipants(supabase, {
    conversationId: "conv-10",
    participantEmails: ["sarah@techcorp.io"],
    threadExternalId: "thread-abc",
    actorEmail: "system",
  });
  assert.equal(assoc.contract, CONVERSATION_ASSOCIATION_CONTRACT);
  assert.equal(assoc.contactId, contactId);
  assert.equal(assoc.companyId, companyId);
  assert.equal(assoc.opportunityId, oppId);
  assert.deepEqual(assoc.reviewActionIds, []);
  assert.equal(assoc.participants[0]?.outcome, "linked");
  const conv10 = db.tables.conversations!.find((c) => c.id === "conv-10");
  assert.equal(conv10?.contact_id, contactId, "Row links must be filled");
  assert.equal(conv10?.company_id, companyId);
  assert.equal(conv10?.opportunity_id, oppId);
  assert.ok(
    db.tables.claims!.some(
      (c) =>
        c.entity_type === "conversation" &&
        c.entity_id === "conv-10" &&
        c.field === "contact_id" &&
        c.best_evidence === "verified_external",
    ),
    "Exact match must record verified_external evidence",
  );
  assert.ok(
    db.tables.activities!.some(
      (a) => a.activity_type === "conversation_associated" && a.conversation_id === "conv-10",
    ),
    "Association must write an activity receipt",
  );
  assert.ok(
    db.tables.audit_log!.some(
      (a) => a.action === "conversation.associated" && a.entity_id === "conv-10",
    ),
    "Association must write an audit row",
  );

  // Test 12: ambiguous participants never merge and never throw.
  db.tables.contacts!.push(
    { id: "contact-dup-1", full_name: "Dup One", primary_email: "dup@example.com" },
    { id: "contact-dup-2", full_name: "Dup Two", primary_email: "dup@example.com" },
  );
  db.tables.conversations!.push({
    id: "conv-11",
    channel: "gmail",
    subject: "Ambiguous thread",
    status: "open",
    unread_count: 1,
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    metadata: {},
    created_at: "2026-09-02T11:00:00Z",
    updated_at: "2026-09-02T11:00:00Z",
  });
  const ambiguous = await associateConversationParticipants(supabase, {
    conversationId: "conv-11",
    participantEmails: ["dup@example.com"],
    threadExternalId: "thread-dup",
    actorEmail: "system",
  });
  assert.equal(ambiguous.contactId, null, "Ambiguity must not link");
  assert.equal(ambiguous.participants[0]?.outcome, "ambiguous");
  assert.ok(
    (ambiguous.participants[0]?.candidates.length ?? 0) >= 2,
    "Review action must carry the candidates",
  );
  assert.equal(ambiguous.reviewActionIds.length, 1);
  const reviewRow = db.tables.action_queue!.find((a) => a.action_type === "identity_review");
  assert.ok(reviewRow, "Ambiguity must enter a founder review action");
  assert.equal(reviewRow?.entity_id, "conv-11");
  assert.equal(reviewRow?.dedupe_key, "identity-review:conv-11:dup@example.com");
  const conv11 = db.tables.conversations!.find((c) => c.id === "conv-11");
  assert.equal(conv11?.contact_id, null, "Ambiguity must not write a link");

  // Test 13: unknown participants enter review and invent nothing.
  const companyCount = db.tables.companies!.length;
  db.tables.conversations!.push({
    id: "conv-12",
    channel: "gmail",
    subject: "Unknown thread",
    status: "open",
    unread_count: 1,
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    metadata: {},
    created_at: "2026-09-02T12:00:00Z",
    updated_at: "2026-09-02T12:00:00Z",
  });
  const unknown = await associateConversationParticipants(supabase, {
    conversationId: "conv-12",
    participantEmails: ["stranger@newbusiness.io"],
    threadExternalId: "thread-new",
    actorEmail: "system",
  });
  assert.equal(unknown.participants[0]?.outcome, "unknown");
  assert.equal(unknown.reviewActionIds.length, 1);
  assert.equal(db.tables.companies!.length, companyCount, "Unknown senders must not invent companies");
  assert.equal(
    db.tables.conversations!.find((c) => c.id === "conv-12")?.contact_id,
    null,
  );

  // Test 14: replay is idempotent — no duplicate reviews or claims.
  const actionsBefore = db.tables.action_queue!.length;
  const claimsBefore = db.tables.claims!.length;
  await associateConversationParticipants(supabase, {
    conversationId: "conv-11",
    participantEmails: ["dup@example.com"],
    threadExternalId: "thread-dup",
    actorEmail: "system",
  });
  assert.equal(db.tables.action_queue!.length, actionsBefore, "Replay must not duplicate review actions");
  await associateConversationParticipants(supabase, {
    conversationId: "conv-10",
    participantEmails: ["sarah@techcorp.io"],
    threadExternalId: "thread-abc",
    actorEmail: "system",
  });
  assert.equal(db.tables.claims!.length, claimsBefore, "Replay must not duplicate evidence claims");

  // Test 15: existing human links are never overwritten by automation.
  db.tables.conversations!.push({
    id: "conv-13",
    channel: "gmail",
    subject: "Human-linked thread",
    status: "open",
    unread_count: 1,
    contact_id: contactId,
    company_id: companyId,
    opportunity_id: oppId,
    metadata: {},
    created_at: "2026-09-02T13:00:00Z",
    updated_at: "2026-09-02T13:00:00Z",
  });
  const preserved = await associateConversationParticipants(supabase, {
    conversationId: "conv-13",
    participantEmails: ["dup@example.com", "stranger@newbusiness.io"],
    threadExternalId: "thread-mixed",
    actorEmail: "system",
  });
  assert.equal(preserved.contactId, contactId, "Human link must win over new participants");
  assert.equal(
    db.tables.conversations!.find((c) => c.id === "conv-13")?.contact_id,
    contactId,
  );

  // Test 16: manual links record human-entered evidence; invalid input fails loud.
  await linkConversationRecord(supabase, {
    conversationId: "conv-3",
    contactId,
    actorEmail: "founder@accelerate.local",
  });
  assert.ok(
    db.tables.claims!.some(
      (c) =>
        c.entity_type === "conversation" &&
        c.entity_id === "conv-3" &&
        c.field === "contact_id" &&
        c.best_evidence === "human_entered",
    ),
    "Manual links must record human-entered evidence",
  );
  await assert.rejects(
    associateConversationParticipants(supabase, { conversationId: "  ", participantEmails: [] }),
    /Conversation id is required/,
  );
  await assert.rejects(
    associateConversationParticipants(supabase, {
      conversationId: "conv-missing",
      participantEmails: ["sarah@techcorp.io"],
    }),
    /Conversation not found/,
  );

  console.log("All 16 Conversations tests passed successfully!");
}

runConversationsSuite().catch((err) => {
  console.error("Conversations test suite failed:", err);
  process.exit(1);
});

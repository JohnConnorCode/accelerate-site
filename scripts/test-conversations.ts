import assert from "node:assert/strict";
import {
  assignConversation,
  listConversations,
  getConversationDetail,
  updateConversationStatus,
  linkConversationRecord,
  createOpportunityFromConversation,
  createTaskFromConversation,
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
  };

  from(table: string) {
    if (!this.tables[table]) {
      this.tables[table] = [];
    }
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
      const inserted: Row[] = items.map((item: Row) => ({
        id: (item.id as string) || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
    campaign_id: "camp-1",
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

  db.tables.tasks!.push(
    {
      id: "task-open-1",
      title: "Call back about the demo",
      related_id: "conv-2",
      status: "pending",
    },
    {
      id: "task-done-1",
      title: "Answered support question",
      related_id: "conv-3",
      status: "completed",
    },
  );

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

  // Test 5b: Filter by intent (case-insensitive) and distinct intent list
  const intentRes = await listConversations(supabase, { intent: "PRICING" });
  assert.equal(intentRes.conversations.length, 1);
  assert.equal(intentRes.conversations[0]?.id, "conv-1");
  assert.deepEqual(intentRes.intents, ["demo", "pricing", "support"]);

  // Test 5c: Filter by campaign linkage
  const campLinked = await listConversations(supabase, { campaign: "linked" });
  assert.equal(campLinked.conversations.length, 1);
  assert.equal(campLinked.conversations[0]?.id, "conv-1");
  const campUnlinked = await listConversations(supabase, { campaign: "unlinked" });
  assert.equal(campUnlinked.conversations.length, 2);

  // Test 5d: Follow-up filter keeps only threads with open tasks.
  // conv-2 has a pending task, conv-3's task is completed, conv-1 has none yet.
  const followUp = await listConversations(supabase, { followUp: true });
  assert.equal(followUp.conversations.length, 1);
  assert.equal(followUp.conversations[0]?.id, "conv-2");

  // Test 5e: Assignment writes metadata, receipts, and filters.
  const assigned = await assignConversation(supabase, {
    id: "conv-3",
    assigneeEmail: "Founder@Accelerate.Local",
    actorEmail: "founder@accelerate.local",
  });
  assert.equal(assigned.assignee_email, "founder@accelerate.local", "assignee normalizes case");
  assert.ok(
    db.tables.audit_log!.some((a) => a.action === "conversation.assigned"),
    "Assignment must record an audit receipt",
  );
  assert.ok(
    db.tables.activities!.some((a) => a.activity_type === "conversation_assigned"),
    "Assignment must record an activity receipt",
  );
  const mineOnly = await listConversations(supabase, { assignee: "founder@accelerate.local" });
  assert.equal(mineOnly.conversations.length, 1);
  assert.equal(mineOnly.conversations[0]?.id, "conv-3");
  const unassigned = await listConversations(supabase, { assignee: "unassigned" });
  assert.equal(unassigned.conversations.length, 2);
  const cleared = await assignConversation(supabase, {
    id: "conv-3",
    assigneeEmail: null,
    actorEmail: "founder@accelerate.local",
  });
  assert.equal(cleared.assignee_email, null);
  await assert.rejects(
    () =>
      assignConversation(supabase, {
        id: "conv-1",
        assigneeEmail: "not-an-email",
        actorEmail: "founder@accelerate.local",
      }),
    /Invalid assignee email/,
    "Assignment must validate the address",
  );
  await assert.rejects(
    () =>
      assignConversation(supabase, {
        id: "conv-missing",
        assigneeEmail: "founder@accelerate.local",
        actorEmail: "founder@accelerate.local",
      }),
    /not found/i,
    "Assignment to a missing thread must fail closed",
  );

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
  await assert.rejects(
    () =>
      linkConversationRecord(supabase, {
        conversationId: "conv-missing",
        opportunityId: oppId,
        actorEmail: "founder@accelerate.local",
      }),
    /Could not link conversation record|not found/i,
    "Linking a missing thread must fail closed",
  );

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

  console.log("All Conversations tests passed successfully!");
}

runConversationsSuite().catch((err) => {
  console.error("Conversations test suite failed:", err);
  process.exit(1);
});

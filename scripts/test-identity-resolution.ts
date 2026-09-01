import assert from "node:assert/strict";
import {
  exactIlike,
  findCanonicalContactByEmail,
  importApprovedContact,
  inspectContactImportIdentity,
  resolveOrCreateIdentity,
} from "../src/lib/revenue-os/identity";
import { isConfiguredAdmin, normalizeAdminEmail } from "../src/lib/admin/access";

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | Row | null; error: { code?: string; message: string } | null };

class MemoryQuery implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private operation: "read" | "insert" | "update" = "read";
  private payload: Row | Row[] | null = null;
  private one = false;
  private limitCount: number | null = null;

  constructor(
    private readonly db: MemorySupabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  ilike(column: string, value: string) {
    const exact = value.replace(/\\([\\%_])/g, "$1").toLowerCase();
    this.filters.push((row) => String(row[column] ?? "").toLowerCase() === exact);
    return this;
  }
  contains(column: string, values: unknown[]) {
    this.filters.push(
      (row) =>
        Array.isArray(row[column]) &&
        values.every((value) => (row[column] as unknown[]).includes(value)),
    );
    return this;
  }
  limit(limit: number) {
    this.limitCount = limit;
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

  private execute(): QueryResult {
    this.db.touched.add(this.table);
    const rows = this.db.rows[this.table] ?? (this.db.rows[this.table] = []);
    if (this.operation === "insert") {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted: Row[] = [];
      for (const payload of payloads) {
        if (
          this.table === "activities" &&
          rows.some(
            (row) => row.source === payload.source && row.external_id === payload.external_id,
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate activity receipt" } };
        }
        const row = { ...payload, id: payload.id ?? this.db.nextId(this.table) };
        rows.push(row);
        inserted.push(row);
      }
      return { data: this.one ? (inserted[0] ?? null) : inserted, error: null };
    }
    const matching = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === "update") {
      for (const row of matching) Object.assign(row, this.payload ?? {});
    }
    const selected = this.limitCount === null ? matching : matching.slice(0, this.limitCount);
    return { data: this.one ? (selected[0] ?? null) : selected, error: null };
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
  constructor(readonly rows: Record<string, Row[]>) {}
  nextId(table: string) {
    this.sequence += 1;
    return `${table}-${this.sequence}`;
  }
  from(table: string) {
    this.touched.add(table);
    return new MemoryQuery(this, table);
  }
}

function memorySupabase(data: Record<string, Row[]>) {
  return new MemorySupabase(data);
}

async function run() {
  process.env.ADMIN_EMAIL = "founder@example.com";
  assert.equal(normalizeAdminEmail(" Founder@Example.Com "), "founder@example.com");
  assert.equal(isConfiguredAdmin("founder@example.com"), true);
  assert.equal(isConfiguredAdmin("other@example.com"), false);

  const canonical = memorySupabase({
    contacts: [
      {
        id: "contact-source",
        full_name: "Source Owner",
        primary_email: "old@example.com",
        alternate_emails: [],
        source_record_type: "crm",
        source_record_id: "lead-1",
      },
      {
        id: "contact-email",
        full_name: "Email Owner",
        primary_email: "owner@example.com",
        alternate_emails: ["alias@example.com"],
      },
    ],
    companies: [
      {
        id: "company-source",
        name: "Source Company",
        domain: "source.example",
        source_record_type: "crm",
        source_record_id: "lead-1",
      },
      { id: "company-domain", name: "Domain Company", domain: "example.com" },
    ],
  });

  const primary = await findCanonicalContactByEmail(canonical as never, " OWNER@EXAMPLE.COM ");
  assert.equal(
    primary?.id,
    "contact-email",
    "normalized primary email must resolve deterministically",
  );
  const alternate = await findCanonicalContactByEmail(canonical as never, "alias@example.com");
  assert.equal(
    alternate?.id,
    "contact-email",
    "alternate email must resolve to the same canonical contact",
  );
  assert.equal(
    exactIlike("person_%@example.com"),
    "person\\_\\%@example.com",
    "identity lookups must escape SQL LIKE metacharacters",
  );

  const sourceFirst = await resolveOrCreateIdentity(canonical as never, {
    name: "Ignored display name",
    email: "owner@example.com",
    source: "test",
    sourceRecordType: "crm",
    sourceRecordId: "lead-1",
  });
  assert.equal(
    sourceFirst.contact.id,
    "contact-source",
    "source record identity must take precedence over email",
  );
  assert.equal(
    sourceFirst.company.id,
    "company-source",
    "source record company identity must take precedence over domain",
  );

  const replay = await resolveOrCreateIdentity(canonical as never, {
    name: "Changed display name",
    email: "other@example.com",
    source: "test",
    sourceRecordType: "crm",
    sourceRecordId: "lead-1",
  });
  assert.deepEqual(
    replay,
    sourceFirst,
    "replayed source records must resolve to the same canonical identity",
  );

  const ambiguous = memorySupabase({
    contacts: [
      {
        id: "contact-primary",
        full_name: "Primary",
        primary_email: "shared@example.com",
        alternate_emails: [],
      },
      {
        id: "contact-alternate",
        full_name: "Alternate",
        primary_email: "other@example.com",
        alternate_emails: ["shared@example.com"],
      },
    ],
  });
  await assert.rejects(
    () => findCanonicalContactByEmail(ambiguous as never, "shared@example.com"),
    /Ambiguous contact identity/,
    "conflicting primary and alternate matches must require review rather than guessing",
  );

  const ambiguousMatch = await inspectContactImportIdentity(ambiguous as never, {
    fullName: "Ambiguous Match",
    email: "shared@example.com",
    phone: null,
    companyName: null,
    role: null,
    website: null,
    industry: null,
    source: null,
    notes: null,
  });
  assert.equal(
    ambiguousMatch.status,
    "ambiguous",
    "import identity inspection must surface ambiguity explicitly",
  );
  assert.equal(
    ambiguousMatch.contactCandidates.length,
    2,
    "ambiguous match must include both contact candidates",
  );

  const approved = memorySupabase({
    contacts: [
      {
        id: "identity-target",
        full_name: "Identity Target",
        primary_email: "owner@replay.example",
        alternate_emails: [],
        metadata: {},
      },
      {
        id: "identity-stale",
        full_name: "Stale Target",
        primary_email: "other@replay.example",
        alternate_emails: [],
      },
    ],
    companies: [{ id: "company-a", name: "Replay Co", domain: null }],
    activities: [],
    audit_log: [],
  });
  const approvedData = {
    fullName: "Replayable Owner",
    email: "new-owner@replay.example",
    phone: "512-555-0100",
    companyName: "Replayable Company",
    role: "Owner",
    website: "https://replay.example",
    industry: "Roofing",
    source: "identity test",
    notes: "deterministic replay fixture",
  };
  const approvedInput = {
    rowId: "11111111-1111-4111-8111-111111111111",
    batchId: "22222222-2222-4222-8222-222222222222",
    actorEmail: "founder@example.com",
    action: "create" as const,
    data: approvedData,
  };
  const firstImport = await importApprovedContact(approved as never, approvedInput);
  const secondImport = await importApprovedContact(approved as never, approvedInput);
  assert.equal(firstImport.replayed, false);
  assert.equal(secondImport.replayed, true);
  assert.equal(
    secondImport.contactId,
    firstImport.contactId,
    "replay must return the original contact ID",
  );
  assert.equal(
    secondImport.companyId,
    firstImport.companyId,
    "replay must return the original company ID",
  );
  assert.equal(
    approved.rows.contacts!.filter(
      (contact) =>
        contact.source_record_type === "contact_import_row" &&
        contact.source_record_id === approvedInput.rowId,
    ).length,
    1,
    "replay must not create a second contact for the same import row",
  );
  assert.equal(
    approved.rows.activities!.length,
    1,
    "duplicate replay activity receipt must be tolerated",
  );
  assert.equal(
    approved.rows.audit_log!.length,
    2,
    "first import and replay must both be auditable",
  );
  assert.equal(approved.rows.audit_log![1]?.action, "contact.import_reconciled");
  assert.deepEqual(secondImport.changedFields, [], "replay must report no changed fields");

  const manual = await importApprovedContact(approved as never, {
    rowId: "44444444-4444-4444-4444-444444444444",
    batchId: "55555555-5555-4555-8555-555555555555",
    actorEmail: "founder@example.com",
    action: "update",
    expectedContactId: "identity-target",
    data: {
      fullName: "Replayable Owner",
      email: "owner@replay.example",
      phone: "512-555-0100",
      companyName: "Replayable Company",
      role: null,
      website: "https://replay.example",
      industry: "Roofing",
      source: "identity test",
      notes: "manual selection fixture",
    },
  });
  assert.equal(
    manual.contactId,
    "identity-target",
    "explicit expected contact should update the deterministic target",
  );

  const stale = memorySupabase({
    contacts: [
      {
        id: "identity-target",
        full_name: "Identity Target",
        primary_email: "other@replay.example",
        metadata: {},
      },
      {
        id: "identity-target-2",
        full_name: "Changed Target",
        primary_email: "changed@replay.example",
        metadata: {},
      },
    ],
    companies: [],
    activities: [],
    audit_log: [],
  });
  await assert.rejects(
    () =>
      importApprovedContact(stale as never, {
        rowId: "77777777-7777-4777-8777-777777777777",
        batchId: "88888888-8888-4888-8888-888888888888",
        actorEmail: "founder@example.com",
        action: "update",
        expectedContactId: "identity-target",
        data: {
          fullName: "Manual Stale",
          email: "owner@replay.example",
          phone: null,
          companyName: null,
          role: null,
          website: null,
          industry: null,
          source: "identity test",
          notes: null,
        },
      }),
    /Identity changed after review/,
    "stale contact selection should fail when current deterministic match no longer matches",
  );

  const companyAmbiguous = memorySupabase({
    contacts: [
      {
        id: "contact-domain",
        full_name: "Domain Contact",
        primary_email: "owner@example.net",
        alternate_emails: [],
      },
    ],
    companies: [
      { id: "company-domain-a", name: "Domain A", domain: "example.net" },
      { id: "company-domain-b", name: "Domain B", domain: "example.net" },
    ],
  });
  await assert.rejects(
    () =>
      importApprovedContact(companyAmbiguous as never, {
        rowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        batchId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        actorEmail: "founder@example.com",
        action: "create",
        data: {
          fullName: "Domain User",
          email: "owner@example.net",
          phone: null,
          companyName: "Ambiguous",
          role: null,
          website: null,
          industry: null,
          source: "identity test",
          notes: null,
        },
      }),
    /Identity needs review/,
    "ambiguous company match should fail when expected company is not explicitly selected",
  );
  const companyManual = await importApprovedContact(companyAmbiguous as never, {
    rowId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    batchId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    actorEmail: "founder@example.com",
    action: "create",
    expectedCompanyId: "company-domain-a",
    data: {
      fullName: "Domain User",
      email: "owner@example.net",
      phone: null,
      companyName: "Company A",
      role: null,
      website: null,
      industry: null,
      source: "identity test",
      notes: null,
    },
  });
  assert.equal(
    companyManual.companyId,
    "company-domain-a",
    "manual ambiguous company selection should use the approved canonical ID",
  );

  for (const forbidden of ["opportunities", "messages", "campaign_members", "action_queue"]) {
    assert.equal(
      approved.touched.has(forbidden),
      false,
      `identity import must not touch ${forbidden}`,
    );
  }

  await assert.rejects(
    () =>
      importApprovedContact(approved as never, {
        rowId: "99999999-9999-4999-8999-999999999999",
        batchId: "10101010-1010-4010-8010-101010101010",
        actorEmail: "outsider@example.com",
        action: "create",
        data: {
          fullName: "Nope",
          email: "nope@example.net",
          phone: null,
          companyName: "Nope Co",
          role: null,
          website: null,
          industry: null,
          source: "identity test",
          notes: null,
        },
      }),
    /Forbidden/,
    "non-founder execution should be blocked",
  );

  assert.equal(
    companyAmbiguous.touched.has("companies"),
    true,
    "company ambiguity test should inspect company rows",
  );
  assert.equal(stale.touched.has("contacts"), true, "stale-selection test should inspect contacts");

  console.log(
    "Identity resolution precedence, manual conflict resolution, ambiguity refusal, stale guards, and replay stability passed.",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

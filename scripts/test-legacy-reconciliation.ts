import assert from "node:assert/strict";

import {
  buildLegacyCanonicalReconciliationReport,
  reconcileLegacyCanonicalRows,
  DEFAULT_LEGACY_CAPTURE_SOURCES,
} from "../src/lib/revenue-os/legacy-reconciliation";

function assertSourceIdentity(row: { source_record_type: string; source_record_id: string }) {
  assert.equal(typeof row.source_record_type, "string", "source_record_type should be preserved.");
  assert.equal(typeof row.source_record_id, "string", "source_record_id should be preserved.");
}

function assertCandidateMetadata(row: {
  canonicalCandidates?: Array<{
    id: string;
    source_record_type: string | null;
    source_record_id: string | null;
  }>;
}) {
  assert.equal(
    Array.isArray(row.canonicalCandidates),
    true,
    "canonicalCandidates should be present.",
  );
  for (const candidate of row.canonicalCandidates ?? []) {
    assert.equal(Boolean(candidate.id), true, "candidate id should be present.");
    assert.equal(typeof candidate.id, "string", "candidate id should be string.");
  }
}

const zeroReport = reconcileLegacyCanonicalRows([], [], []);
assert.equal(
  zeroReport.summary.totalRows,
  0,
  "Zero-row fixture should produce zero reconciliation rows.",
);
assert.deepEqual(
  zeroReport.summary,
  {
    totalRows: 0,
    matched: 0,
    missingCanonical: 0,
    ambiguousIdentity: 0,
    duplicateCanonical: 0,
  },
  "Zero-row summary should be all-zero.",
);

const matchingReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-101",
      email: "owner@acme.com",
      company_domain: "acme.com",
    },
  ],
  [
    {
      id: "contact-101",
      full_name: "Owner",
      primary_email: "owner@acme.com",
      company_id: "company-101",
      source_record_type: "crm",
      source_record_id: "lead-101",
    },
  ],
  [
    {
      id: "company-101",
      name: "Acme",
      domain: "acme.com",
      source_record_type: "crm",
      source_record_id: "lead-101",
    },
  ],
);
assert.equal(matchingReport.summary.totalRows, 1, "Matching fixture should return one report row.");
assert.equal(matchingReport.summary.matched, 1, "Exact source-linking should classify as matched.");
assert.equal(
  matchingReport.summary.missingCanonical,
  0,
  "Exact source-linking should not be missing canonical.",
);
const matchingRow = matchingReport.rows.at(0);
assert.ok(matchingRow);
assert.equal(
  matchingRow.type,
  "contact",
  "Matched row should classify as contact when a contact can be linked.",
);
assert.equal(matchingRow.status, "matched", "Matched row should use matched status.");
assertSourceIdentity(matchingRow);
assertCandidateMetadata(matchingRow);

const missingReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-404",
      email: "unknown@example.com",
      company_domain: "unknown.com",
    },
  ],
  [],
  [],
);
assert.equal(
  missingReport.summary.totalRows,
  1,
  "Missing canonical fixture should still produce one report row.",
);
assert.equal(
  missingReport.summary.missingCanonical,
  1,
  "Unknown source IDs should classify as missing canonical.",
);
const missingRow = missingReport.rows.at(0);
assert.ok(missingRow);
assertSourceIdentity(missingRow);

const duplicateContactReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-dup",
      email: "dup@acme.com",
      company_domain: "dup.com",
    },
  ],
  [
    {
      id: "contact-1",
      full_name: "A",
      primary_email: "dup@acme.com",
      company_id: null,
      source_record_type: "crm",
      source_record_id: "lead-dup",
    },
    {
      id: "contact-2",
      full_name: "B",
      primary_email: "dup2@acme.com",
      company_id: null,
      source_record_type: "crm",
      source_record_id: "lead-dup",
    },
  ],
  [],
);
assert.equal(
  duplicateContactReport.summary.duplicateCanonical,
  1,
  "Shared canonical source keys should be reported as duplicate canonical rows.",
);
const duplicateContactRow = duplicateContactReport.rows.at(0);
assert.ok(duplicateContactRow);
assert.equal(
  duplicateContactRow.type,
  "contact",
  "Duplicate contact source-match should keep contact domain.",
);
assert.equal(
  duplicateContactRow.status,
  "duplicate_canonical",
  "Duplicate canonical sources should map to duplicate_canonical.",
);
assertSourceIdentity(duplicateContactRow);

const ambiguousContactReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-amb",
      email: "shared@example.com",
      company_domain: "multi.com",
    },
  ],
  [
    {
      id: "contact-amb-a",
      full_name: "A",
      primary_email: "shared@example.com",
      company_id: null,
      source_record_type: "crm",
      source_record_id: "lead-amb-a",
    },
    {
      id: "contact-amb-b",
      full_name: "B",
      primary_email: "shared@example.com",
      company_id: null,
      source_record_type: "crm",
      source_record_id: "lead-amb-b",
    },
  ],
  [],
);
assert.equal(
  ambiguousContactReport.summary.ambiguousIdentity,
  1,
  "Email-only overlap with multiple canonical rows should classify as ambiguous.",
);
const ambiguousContactRow = ambiguousContactReport.rows.at(0);
assert.ok(ambiguousContactRow);
assert.equal(ambiguousContactRow.type, "contact", "Email overlap should remain in contact domain.");
assert.equal(
  ambiguousContactRow.status,
  "ambiguous_identity",
  "Email overlap should map to ambiguous_identity.",
);
assertSourceIdentity(ambiguousContactRow);
assertCandidateMetadata(ambiguousContactRow);

const companyDuplicateReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-comp-dup",
      email: "owner@acme.com",
      company_domain: "acme.com",
    },
  ],
  [],
  [
    {
      id: "company-1",
      name: "Acme",
      domain: "acme.com",
      source_record_type: "crm",
      source_record_id: "lead-comp-dup",
    },
    {
      id: "company-2",
      name: "Acme Clone",
      domain: "acme.com",
      source_record_type: "crm",
      source_record_id: "lead-comp-dup",
    },
  ],
);
assert.equal(
  companyDuplicateReport.summary.duplicateCanonical,
  1,
  "Company shared source keys should be reported as duplicate.",
);
const companyDuplicateRow = companyDuplicateReport.rows.at(0);
assert.ok(companyDuplicateRow);
assert.equal(
  companyDuplicateRow.type,
  "company",
  "Company-focused source matches should classify as company.",
);
assert.equal(
  companyDuplicateRow.status,
  "duplicate_canonical",
  "Company duplicate canonical sources should map to duplicate_canonical.",
);
assertSourceIdentity(companyDuplicateRow);
assertCandidateMetadata(companyDuplicateRow);

const companyAmbiguousReport = reconcileLegacyCanonicalRows(
  [
    {
      source_record_type: "crm",
      source_record_id: "lead-comp-amb",
      email: "owner2@acme.com",
      company_domain: "acme.com",
    },
  ],
  [],
  [
    {
      id: "company-1",
      name: "Acme",
      domain: "acme.com",
      source_record_type: "crm",
      source_record_id: "lead-comp-amb-1",
    },
    {
      id: "company-2",
      name: "Acme",
      domain: "acme.com",
      source_record_type: "crm",
      source_record_id: "lead-comp-amb-2",
    },
  ],
);
assert.equal(
  companyAmbiguousReport.summary.ambiguousIdentity,
  1,
  "Company candidates from shared domain with distinct source IDs should be ambiguous.",
);
const companyAmbiguousRow = companyAmbiguousReport.rows.at(0);
assert.ok(companyAmbiguousRow);
assert.equal(
  companyAmbiguousRow.type,
  "company",
  "Company-domain overlaps without unique source should classify as company.",
);
assert.equal(
  companyAmbiguousRow.status,
  "ambiguous_identity",
  "Company-domain overlaps should map to ambiguous_identity.",
);
assertSourceIdentity(companyAmbiguousRow);
assertCandidateMetadata(companyAmbiguousRow);

console.log(
  JSON.stringify({
    checks: {
      zero: zeroReport.summary,
      matching: matchingReport.summary,
      missing: missingReport.summary,
      duplicateContact: duplicateContactReport.summary,
      ambiguousContact: ambiguousContactReport.summary,
      duplicateCompany: companyDuplicateReport.summary,
      ambiguousCompany: companyAmbiguousReport.summary,
    },
    result: "legacy/canonical deterministic fixture report design passed",
  }),
);

type QueryResult<T> = { data: T | null; error: { message: string } | null };

class MemoryQuery<T> implements PromiseLike<QueryResult<T>> {
  constructor(
    private readonly data: T,
    private readonly error: { message: string } | null,
  ) {}

  select() {
    return this;
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled, onrejected);
  }
}

class MemorySupabase {
  constructor(
    private readonly rows: Record<string, unknown[]>,
    private readonly errors: Record<string, string> = {},
  ) {}

  from<T extends keyof typeof this.rows>(table: string) {
    const message = this.errors[table];
    const payload = (message ? null : (this.rows[table] ?? [])) as T extends keyof typeof this.rows
      ? never
      : never;
    return new MemoryQuery<Array<T> | null>(payload as never, message ? { message } : null);
  }
}

(async () => {
  const memoryWithMatches = new MemorySupabase({
    solution_requests: [
      {
        id: "lead-101",
        contact_email: "owner@example.com",
        contact_website: null,
        company: null,
      },
    ],
    contacts: [
      {
        id: "contact-101",
        full_name: "Owner",
        primary_email: "owner@example.com",
        company_id: "company-101",
        source_record_type: "solution_request",
        source_record_id: "lead-101",
      },
    ],
    companies: [
      {
        id: "company-101",
        name: "Acme",
        domain: "example.com",
        source_record_type: "solution_request",
        source_record_id: "lead-101",
      },
    ],
  });

  const reportWithMatches = await buildLegacyCanonicalReconciliationReport(
    memoryWithMatches as never,
    DEFAULT_LEGACY_CAPTURE_SOURCES.slice(0, 1),
  );
  assert.equal(
    reportWithMatches.scope,
    "legacy-canonical-diff-plan",
    "Report scope is stable and deterministic.",
  );
  assert.equal(
    reportWithMatches.rows.length,
    1,
    "One mapped row should be emitted for one legacy source row.",
  );
  assert.equal(
    reportWithMatches.summary.matched,
    1,
    "Exact source-linked contacts remain matched in the full report.",
  );
  assert.equal(
    reportWithMatches.canonicalCounts.contacts,
    1,
    "Canonical contact count should reflect fetched count.",
  );
  assert.equal(
    reportWithMatches.canonicalCounts.companies,
    1,
    "Canonical company count should reflect fetched count.",
  );
  assert.equal(
    reportWithMatches.errors.length,
    0,
    "No source or canonical read errors in successful report path.",
  );

  const memoryWithReadErrors = new MemorySupabase(
    { clients: [{ id: "lead-1", email: "lead@sample.com" }] },
    { contacts: "permission denied for table contacts" },
  );
  const reportWithErrors = await buildLegacyCanonicalReconciliationReport(
    memoryWithReadErrors as never,
    DEFAULT_LEGACY_CAPTURE_SOURCES.slice(-1),
  );
  assert.equal(
    reportWithErrors.errors.length > 0,
    true,
    "Canonical read errors should be surfaced in envelope errors.",
  );
  assert.equal(
    reportWithErrors.rows.length,
    1,
    "Canonical read failures should not prevent legacy rows from producing report entries.",
  );
  assert.equal(
    reportWithErrors.summary.missingCanonical,
    1,
    "Canonical failures should not hide unmatched source rows.",
  );
})();

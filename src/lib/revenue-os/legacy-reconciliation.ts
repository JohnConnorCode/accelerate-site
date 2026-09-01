import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromEmailOrWebsite, normalizeEmail } from "./db";

export type LegacyReconciliationRecordType = "contact" | "company";
export type LegacyReconciliationStatus =
  "matched" | "missing" | "ambiguous_identity" | "duplicate_canonical";

export type LegacyCaptureRow = {
  source_record_type: string;
  source_record_id: string;
  email: string;
  company_domain: string;
};

export type CanonicalIdentitySource = {
  id: string;
  source_record_type: string | null;
  source_record_id: string | null;
};

export type CanonicalContact = CanonicalIdentitySource & {
  full_name?: string;
  primary_email: string | null;
  company_id: string | null;
};

export type CanonicalCompany = CanonicalIdentitySource & {
  name: string;
  domain: string | null;
};

export type LegacyReconciliationRow = {
  source_record_type: string;
  source_record_id: string;
  type: LegacyReconciliationRecordType;
  status: LegacyReconciliationStatus;
  canonicalIds: string[];
  canonicalCandidates: CanonicalIdentitySource[];
};

export type LegacyReconciliationReport = {
  scope: string;
  summary: {
    totalRows: number;
    matched: number;
    missingCanonical: number;
    ambiguousIdentity: number;
    duplicateCanonical: number;
  };
  rows: LegacyReconciliationRow[];
};

type LegacyCaptureSourceConfig = {
  sourceRecordType: string;
  table: string;
  idField?: string;
  emailField?: string;
  websiteField?: string;
  companyDomainField?: string;
};

type LegacyReconciliationSourceRead = {
  sourceRecordType: string;
  table: string;
  rowsRead: number;
  error?: string;
};

export type LegacyReconciliationEnvelope = LegacyReconciliationReport & {
  generatedAt: string;
  sourceStats: LegacyReconciliationSourceRead[];
  canonicalCounts: {
    contacts: number;
    companies: number;
  };
  errors: string[];
};

export const DEFAULT_LEGACY_CAPTURE_SOURCES: LegacyCaptureSourceConfig[] = [
  {
    sourceRecordType: "solution_request",
    table: "solution_requests",
    emailField: "contact_email",
    companyDomainField: "contact_email",
  },
  { sourceRecordType: "contact_form", table: "contact_submissions", emailField: "email" },
  { sourceRecordType: "chat", table: "chat_leads", emailField: "email" },
  { sourceRecordType: "partner_application", table: "partner_applications", emailField: "email" },
  { sourceRecordType: "resource_download", table: "resource_downloads", emailField: "email" },
  { sourceRecordType: "website_grade", table: "website_grades", emailField: "email" },
  { sourceRecordType: "subscriber", table: "subscribers", emailField: "email" },
  { sourceRecordType: "client", table: "clients", emailField: "contact_email" },
];

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function extractLegacySourceRow(
  row: Record<string, unknown>,
  config: LegacyCaptureSourceConfig,
): LegacyCaptureRow {
  const id = toText(row[config.idField ?? "id"]);
  const email = toText(row[config.emailField ?? "email"]) ?? "";
  const companyDomainFromUrl = config.companyDomainField
    ? toText(row[config.companyDomainField])
    : null;
  const companyDomainFromWebsite = config.websiteField ? toText(row[config.websiteField]) : null;
  const companyDomain = companyDomainFromUrl
    ? domainFromEmailOrWebsite(undefined, companyDomainFromUrl)
    : domainFromEmailOrWebsite(email, companyDomainFromWebsite);
  return {
    source_record_type: config.sourceRecordType,
    source_record_id: id ?? "",
    email: email,
    company_domain: companyDomain ?? "",
  };
}

function buildSelectFields(config: LegacyCaptureSourceConfig): string[] {
  const fields = new Set<string>([config.idField ?? "id"]);
  if (config.emailField) fields.add(config.emailField);
  if (config.websiteField) fields.add(config.websiteField);
  if (config.companyDomainField) fields.add(config.companyDomainField);
  return [...fields];
}

async function fetchLegacyRows(
  supabase: SupabaseClient,
  config: LegacyCaptureSourceConfig,
): Promise<{ rows: LegacyCaptureRow[]; stat: LegacyReconciliationSourceRead }> {
  const select = buildSelectFields(config);
  const sourceRecordType = config.sourceRecordType;
  const { data, error } = await supabase.from(config.table).select(select.join(","));
  if (error) {
    return {
      rows: [],
      stat: {
        sourceRecordType,
        table: config.table,
        rowsRead: 0,
        error: error.message,
      },
    };
  }
  const mappedRows = (data ?? [])
    .map((row) => extractLegacySourceRow(row as unknown as Record<string, unknown>, config))
    .filter((row) => row.source_record_id);
  return {
    rows: mappedRows,
    stat: {
      sourceRecordType,
      table: config.table,
      rowsRead: mappedRows.length,
    },
  };
}

async function loadCanonicalContactRows(
  supabase: SupabaseClient,
): Promise<{ rows: CanonicalContact[]; error?: string }> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, primary_email, company_id, source_record_type, source_record_id");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CanonicalContact[] };
}

async function loadCanonicalCompanyRows(
  supabase: SupabaseClient,
): Promise<{ rows: CanonicalCompany[]; error?: string }> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, source_record_type, source_record_id");
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as CanonicalCompany[] };
}

function classifyAndSummarize(
  summaryCandidates: Array<{
    sourceRecordType: string;
    table: string;
    rowsRead: number;
    error?: string;
  }>,
) {
  const errors = summaryCandidates
    .filter((candidate) => candidate.error)
    .map((candidate) => `[${candidate.table}] ${candidate.error}`);
  return {
    errors,
    sourceStats: summaryCandidates,
  };
}

/**
 * Load all supported legacy source rows, reconcile against canonical contacts/companies,
 * and return deterministic evidence with read-only execution.
 */
export async function buildLegacyCanonicalReconciliationReport(
  supabase: SupabaseClient,
  sources: LegacyCaptureSourceConfig[] = DEFAULT_LEGACY_CAPTURE_SOURCES,
): Promise<LegacyReconciliationEnvelope> {
  const [sourceReads, canonicalContactsResult, canonicalCompaniesResult] = await Promise.all([
    Promise.all(sources.map((source) => fetchLegacyRows(supabase, source))),
    loadCanonicalContactRows(supabase),
    loadCanonicalCompanyRows(supabase),
  ]);

  const sourceStats = sourceReads.map((read) => read.stat);
  const legacyRows = sourceReads.flatMap((read) => read.rows);
  const canonicalContacts = canonicalContactsResult.rows;
  const canonicalCompanies = canonicalCompaniesResult.rows;
  const { errors } = classifyAndSummarize(
    sourceStats.concat([
      canonicalContactsResult.error
        ? {
            sourceRecordType: "canonical-contacts",
            table: "contacts",
            rowsRead: canonicalContacts.length,
            error: canonicalContactsResult.error,
          }
        : {
            sourceRecordType: "canonical-contacts",
            table: "contacts",
            rowsRead: canonicalContacts.length,
          },
      canonicalCompaniesResult.error
        ? {
            sourceRecordType: "canonical-companies",
            table: "companies",
            rowsRead: canonicalCompanies.length,
            error: canonicalCompaniesResult.error,
          }
        : {
            sourceRecordType: "canonical-companies",
            table: "companies",
            rowsRead: canonicalCompanies.length,
          },
    ]),
  );

  const report = reconcileLegacyCanonicalRows(legacyRows, canonicalContacts, canonicalCompanies);
  return {
    ...report,
    generatedAt: new Date().toISOString(),
    sourceStats,
    canonicalCounts: {
      contacts: canonicalContacts.length,
      companies: canonicalCompanies.length,
    },
    errors,
  };
}

export function serializeLegacyReconciliationReport(
  report: LegacyReconciliationReport | LegacyReconciliationEnvelope,
) {
  return JSON.stringify(report, null, 2);
}

const NO_SPACE_SCOPE = "legacy-canonical-diff-plan";

function normalizeText(value: string | null | undefined) {
  return normalizeEmail(value);
}

function matchCandidateBySource(row: LegacyCaptureRow, candidate: CanonicalIdentitySource) {
  return (
    candidate.source_record_type === row.source_record_type &&
    candidate.source_record_id === row.source_record_id
  );
}

function matchCandidateByNormalizedEmail(row: LegacyCaptureRow, candidate: CanonicalContact) {
  const rowEmail = normalizeText(row.email);
  if (!rowEmail) return false;
  const candidateEmail = normalizeText(candidate.primary_email);
  return Boolean(rowEmail && candidateEmail && rowEmail === candidateEmail);
}

function matchCandidateByDomain(row: LegacyCaptureRow, candidate: CanonicalCompany) {
  const candidateDomain = normalizeText(candidate.domain);
  const rowDomainFromEmailOrWebsite = domainFromEmailOrWebsite(row.email, row.company_domain);
  const rowDomainFromLegacyField = normalizeText(row.company_domain);

  return (
    matchCandidateBySource(row, candidate) ||
    (candidateDomain && rowDomainFromLegacyField && candidateDomain === rowDomainFromLegacyField) ||
    (candidateDomain &&
      rowDomainFromEmailOrWebsite &&
      normalizeText(rowDomainFromEmailOrWebsite) === candidateDomain)
  );
}

function deduplicateCanonicalIds<T extends CanonicalIdentitySource>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isDuplicateCanonicalSourceMatch(candidates: CanonicalIdentitySource[]) {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.source_record_type || !candidate.source_record_id) continue;
    const key = `${candidate.source_record_type}:${candidate.source_record_id}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function classify(candidates: CanonicalIdentitySource[]) {
  if (!candidates.length) return "missing";
  if (candidates.length === 1) return "matched";
  return isDuplicateCanonicalSourceMatch(candidates) ? "duplicate_canonical" : "ambiguous_identity";
}

function withCanonicalCandidates(rows: CanonicalIdentitySource[]) {
  return deduplicateCanonicalIds(
    rows.map((candidate) => ({
      id: candidate.id,
      source_record_type: candidate.source_record_type,
      source_record_id: candidate.source_record_id,
    })),
  );
}

export function reconcileLegacyCanonicalRows(
  legacyRows: LegacyCaptureRow[],
  canonicalContacts: CanonicalContact[],
  canonicalCompanies: CanonicalCompany[],
): LegacyReconciliationReport {
  const rows: LegacyReconciliationRow[] = legacyRows.map((row) => {
    const contactCandidates = withCanonicalCandidates(
      canonicalContacts.filter(
        (candidate) =>
          matchCandidateBySource(row, candidate) || matchCandidateByNormalizedEmail(row, candidate),
      ),
    );
    if (contactCandidates.length) {
      const status = classify(contactCandidates);
      return {
        source_record_type: row.source_record_type,
        source_record_id: row.source_record_id,
        type: "contact",
        status,
        canonicalIds: contactCandidates.map((candidate) => candidate.id),
        canonicalCandidates: contactCandidates,
      };
    }

    const companyCandidates = withCanonicalCandidates(
      canonicalCompanies.filter((candidate) => matchCandidateByDomain(row, candidate)),
    );
    const status = classify(companyCandidates);
    return {
      source_record_type: row.source_record_type,
      source_record_id: row.source_record_id,
      type: "company",
      status,
      canonicalIds: companyCandidates.map((candidate) => candidate.id),
      canonicalCandidates: companyCandidates,
    };
  });

  return {
    scope: NO_SPACE_SCOPE,
    summary: {
      totalRows: rows.length,
      matched: rows.filter((row) => row.status === "matched").length,
      missingCanonical: rows.filter((row) => row.status === "missing").length,
      ambiguousIdentity: rows.filter((row) => row.status === "ambiguous_identity").length,
      duplicateCanonical: rows.filter((row) => row.status === "duplicate_canonical").length,
    },
    rows,
  };
}

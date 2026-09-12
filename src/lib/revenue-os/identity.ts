import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromEmailOrWebsite, normalizeEmail } from "./db";
import { isConfiguredAdmin } from "@/lib/admin/access";

export interface ResolveIdentityInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  website?: string | null;
  industry?: string | null;
  source: string;
  sourceRecordType?: string | null;
  sourceRecordId?: string | null;
}

export type CanonicalEmailMatch = { id: string; full_name: string; primary_email: string | null };

/** Escape PostgreSQL LIKE metacharacters so ilike remains an exact
 * case-insensitive identity comparison rather than a pattern match. */
export function exactIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/** Exact primary/alternate-email lookup shared by imports, communication, and
 * sync. It refuses ambiguity rather than allowing each adapter to guess. */
export async function findCanonicalContactByEmail(
  supabase: SupabaseClient,
  value: string | null | undefined,
): Promise<CanonicalEmailMatch | null> {
  const email = normalizeEmail(value);
  if (!email) return null;
  const [primary, alternate] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,full_name,primary_email")
      .ilike("primary_email", exactIlike(email))
      .limit(3),
    supabase
      .from("contacts")
      .select("id,full_name,primary_email")
      .contains("alternate_emails", [email])
      .limit(3),
  ]);
  if (primary.error) throw new Error(primary.error.message);
  if (alternate.error) throw new Error(alternate.error.message);
  const matches = new Map<string, CanonicalEmailMatch>();
  for (const row of [...(primary.data ?? []), ...(alternate.data ?? [])]) matches.set(row.id, row);
  if (matches.size > 1) throw new Error(`Ambiguous contact identity for ${email}`);
  return [...matches.values()][0] ?? null;
}

/** Exact phone lookup, for channels (WhatsApp, SMS) whose messages often
 * carry no email at all. Phones are matched as given by the caller; callers
 * are expected to normalize (see ingestWhatsAppMessage) before calling this,
 * since two different raw formats of the same number would otherwise create
 * two contacts. Refuses ambiguity the same way the email lookup does. */
export async function findCanonicalContactByPhone(
  supabase: SupabaseClient,
  phone: string | null | undefined,
): Promise<CanonicalEmailMatch | null> {
  const value = phone?.trim();
  if (!value) return null;
  const { data, error } = await supabase
    .from("contacts")
    .select("id,full_name,primary_email")
    .eq("phone", value)
    .limit(2);
  if (error) throw new Error(error.message);
  if ((data?.length ?? 0) > 1) throw new Error(`Ambiguous contact identity for phone ${value}`);
  return data?.[0] ?? null;
}

/** JavaScript remains the normalization owner; SQL owns the atomic identity write. */
export function normalizedIdentityInput(input: ResolveIdentityInput) {
  const email = normalizeEmail(input.email);
  return {
    name: input.name,
    email,
    domain: domainFromEmailOrWebsite(email, input.website),
    phone: input.phone ?? null,
    companyName: input.companyName ?? null,
    website: input.website ?? null,
    industry: input.industry ?? null,
    source: input.source,
    sourceRecordType: input.sourceRecordType ?? null,
    sourceRecordId: input.sourceRecordId ?? null,
  };
}

export async function resolveOrCreateIdentity(
  supabase: SupabaseClient,
  input: ResolveIdentityInput,
): Promise<{
  contact: CanonicalEmailMatch;
  company: { id: string; name: string; domain: string | null };
}> {
  const { data, error } = await supabase.rpc("resolve_revenue_identity", {
    p_input: normalizedIdentityInput(input),
  });
  if (error) throw new Error(error.message);
  if (!data?.contact?.id || !data?.company?.id)
    throw new Error("Identity resolution returned no canonical records");
  return data;
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

/** Consumer domains never seed a company, even on founder-confirmed create:
 *  a personal address is not a business. Exported for the review workbench. */
export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  return !!domain && PERSONAL_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

export interface ApprovedImportedContact {
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  role: string | null;
  website: string | null;
  industry: string | null;
  source: string | null;
  notes: string | null;
  /** Server-normalized company identity included in the approved review digest. */
  identityDomain?: string | null;
}

export interface ContactImportIdentityMatch {
  status: "new" | "exact" | "ambiguous";
  reason: string;
  contact: {
    id: string;
    full_name: string;
    primary_email: string | null;
    phone: string | null;
    title: string | null;
    company_id: string | null;
    metadata: Record<string, unknown>;
  } | null;
  company: {
    id: string;
    name: string;
    domain: string | null;
    website: string | null;
    industry: string | null;
  } | null;
  domain: string | null;
  contactCandidates: Array<{ id: string; full_name: string; primary_email: string | null }>;
  companyCandidates: Array<{ id: string; name: string; domain: string | null }>;
}

export function businessDomain(data: ApprovedImportedContact): string | null {
  const domain = domainFromEmailOrWebsite(data.email, data.website);
  return domain && !PERSONAL_EMAIL_DOMAINS.has(domain) ? domain : null;
}

/** Deterministic import-time matching. Email/alternate email and business
 * domain are acceptable keys; display names are never identity keys. */
export async function inspectContactImportIdentity(
  supabase: SupabaseClient,
  data: ApprovedImportedContact,
): Promise<ContactImportIdentityMatch> {
  const email = normalizeEmail(data.email);
  const domain = businessDomain(data);
  type ContactCandidate = NonNullable<ContactImportIdentityMatch["contact"]>;
  const contacts = new Map<string, ContactCandidate>();
  if (email) {
    const [primary, alternate] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,full_name,primary_email,phone,title,company_id,metadata")
        .ilike("primary_email", exactIlike(email))
        .limit(3),
      supabase
        .from("contacts")
        .select("id,full_name,primary_email,phone,title,company_id,metadata")
        .contains("alternate_emails", [email])
        .limit(3),
    ]);
    if (primary.error) throw new Error(primary.error.message);
    // Old schemas/providers may not support the alternate-email query. Primary
    // matching remains usable, but a real database error must not become a guess.
    if (alternate.error) throw new Error(alternate.error.message);
    for (const row of [...(primary.data ?? []), ...(alternate.data ?? [])]) {
      if (row) contacts.set(row.id, row as ContactCandidate);
    }
  }

  let companies: Array<ContactImportIdentityMatch["company"] | null> = [];
  if (domain) {
    const result = await supabase
      .from("companies")
      .select("id,name,domain,website,industry")
      .ilike("domain", exactIlike(domain))
      .limit(3);
    if (result.error) throw new Error(result.error.message);
    companies = (result.data ?? []).filter(Boolean);
  }

  const contact = [...contacts.values()][0] ?? null;
  const company = companies[0] ?? null;
  const contactCandidates = [...contacts.values()].map((row) => ({
    id: row.id,
    full_name: row.full_name,
    primary_email: row.primary_email,
  }));
  const companyCandidates: Array<{ id: string; name: string; domain: string | null }> = [];
  for (const row of companies) {
    if (!row) continue;
    companyCandidates.push({ id: row.id, name: row.name, domain: row.domain });
  }

  if (contacts.size > 1 || companies.length > 1) {
    return {
      status: "ambiguous",
      reason:
        contacts.size > 1
          ? `More than one contact uses ${email}`
          : `More than one company uses ${domain}`,
      contact: null,
      company: null,
      domain,
      contactCandidates,
      companyCandidates,
    };
  }
  return {
    status: contact ? "exact" : "new",
    reason: contact
      ? `Exact email match: ${email}`
      : company
        ? `New contact; exact company domain match: ${domain}`
        : "No deterministic identity match",
    contact,
    company,
    domain,
    contactCandidates,
    companyCandidates,
  };
}

export interface ImportApprovedContactInput {
  rowId: string;
  batchId: string;
  actorEmail: string;
  action: "create" | "update";
  expectedContactId?: string | null;
  expectedCompanyId?: string | null;
  data: ApprovedImportedContact;
}

/** Shared serialized review contract; its byte digest is the batch approval. */
export function contactImportReviewRow(row: {
  id: string;
  row_index: number;
  action: string;
  included: boolean;
  reviewed_data: ApprovedImportedContact;
  matched_contact_id: string | null;
  matched_company_id: string | null;
}) {
  return {
    id: row.id,
    rowIndex: row.row_index,
    action: row.action,
    included: row.included,
    data: row.reviewed_data,
    matchedContactId: row.matched_contact_id,
    matchedCompanyId: row.matched_company_id,
  };
}

export class ContactImportRowEffectError extends Error {}

/** Applies the exact existing approved row and its receipt in one transaction. */
export async function importApprovedContact(
  supabase: SupabaseClient,
  input: ImportApprovedContactInput,
) {
  if (!isConfiguredAdmin(input.actorEmail)) throw new Error("Forbidden");
  const { data: rows, error: readError } = await supabase
    .from("contact_import_rows")
    .select("id,row_index,action,included,reviewed_data,matched_contact_id,matched_company_id")
    .eq("batch_id", input.batchId)
    .order("row_index", { ascending: true });
  if (readError) throw new Error(readError.message);
  const cohort = (rows ?? []) as Parameters<typeof contactImportReviewRow>[0][];
  const row = cohort.find((candidate) => candidate.id === input.rowId);
  if (
    !row ||
    row.action !== input.action ||
    row.matched_contact_id !== (input.expectedContactId ?? null) ||
    row.matched_company_id !== (input.expectedCompanyId ?? null) ||
    Object.entries(input.data).some(
      ([key, value]) => row.reviewed_data[key as keyof ApprovedImportedContact] !== value,
    )
  )
    throw new Error("Import row differs from the reviewed choice");
  const { data, error } = await supabase.rpc("apply_contact_import_row", {
    p_batch_id: input.batchId,
    p_row_id: input.rowId,
    p_actor: input.actorEmail,
    p_review_snapshot: JSON.stringify(cohort.map(contactImportReviewRow)),
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new ContactImportRowEffectError(String(data.error));
  return data as {
    contactId: string;
    companyId: string | null;
    replayed: boolean;
    changedFields: string[];
  };
}

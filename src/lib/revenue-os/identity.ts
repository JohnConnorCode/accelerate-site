import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromEmailOrWebsite, normalizeEmail } from "./db";

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

export async function resolveOrCreateIdentity(supabase: SupabaseClient, input: ResolveIdentityInput) {
  const email = normalizeEmail(input.email);
  const domain = domainFromEmailOrWebsite(email, input.website);

  let company: { id: string; name: string; domain: string | null } | null = null;
  if (domain) {
    const { data, error } = await supabase.from("companies").select("id, name, domain").ilike("domain", domain).limit(2);
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 1) throw new Error(`Ambiguous company identity for ${domain}`);
    company = data?.[0] ?? null;
  }
  if (!company) {
    const companyName = input.companyName?.trim() || domain || `${input.name.trim()} company`;
    const { data, error } = await supabase.from("companies").insert({
      name: companyName,
      domain,
      website: input.website || null,
      industry: input.industry || null,
      source: input.source,
      source_record_type: input.sourceRecordType || null,
      source_record_id: input.sourceRecordId || null,
    }).select("id, name, domain").single();
    if (error) throw new Error(error.message);
    company = data;
  }

  let contact: { id: string; full_name: string; primary_email: string | null } | null = null;
  if (email) {
    const { data, error } = await supabase.from("contacts").select("id, full_name, primary_email").ilike("primary_email", email).limit(2);
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 1) throw new Error(`Ambiguous contact identity for ${email}`);
    contact = data?.[0] ?? null;
  }
  if (!contact) {
    const { data, error } = await supabase.from("contacts").insert({
      full_name: input.name.trim(),
      primary_email: email,
      phone: input.phone || null,
      company_id: company.id,
      source: input.source,
      source_record_type: input.sourceRecordType || null,
      source_record_id: input.sourceRecordId || null,
    }).select("id, full_name, primary_email").single();
    if (error) throw new Error(error.message);
    contact = data;
  }

  return { contact, company };
}

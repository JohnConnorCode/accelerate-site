import { isConfiguredAdmin } from "../../src/lib/admin/access";
import { recordAudit } from "../../src/lib/revenue-os/audit";
import { recordActivity } from "../../src/lib/revenue-os/activities";
import {
  inspectContactImportIdentity,
  type ImportApprovedContactInput,
} from "../../src/lib/revenue-os/identity";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail, domainFromEmailOrWebsite } from "../../src/lib/revenue-os/db";
import {
  exactIlike,
  findCanonicalContactByEmail,
  findCanonicalContactByPhone,
  type ResolveIdentityInput,
} from "../../src/lib/revenue-os/identity";
/** Preserved identity transport behavior; native PostgreSQL tests own atomicity and authority. */
export async function resolveIdentityFixture(
  supabase: SupabaseClient,
  input: ResolveIdentityInput,
) {
  const email = normalizeEmail(input.email);
  const domain = domainFromEmailOrWebsite(email, input.website);

  let company: { id: string; name: string; domain: string | null } | null = null;
  if (input.sourceRecordType && input.sourceRecordId) {
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,domain")
      .eq("source_record_type", input.sourceRecordType)
      .eq("source_record_id", input.sourceRecordId)
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 1)
      throw new Error(
        `Ambiguous company source identity for ${input.sourceRecordType}:${input.sourceRecordId}`,
      );
    company = data?.[0] ?? null;
  }
  if (!company && domain) {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, domain")
      .ilike("domain", exactIlike(domain))
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 1) throw new Error(`Ambiguous company identity for ${domain}`);
    company = data?.[0] ?? null;
  }
  if (!company) {
    const companyName = input.companyName?.trim() || domain || `${input.name.trim()} company`;
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        domain,
        website: input.website || null,
        industry: input.industry || null,
        source: input.source,
        source_record_type: input.sourceRecordType || null,
        source_record_id: input.sourceRecordId || null,
      })
      .select("id, name, domain")
      .single();
    if (error) throw new Error(error.message);
    company = data;
  }

  let contact: { id: string; full_name: string; primary_email: string | null } | null = null;
  if (input.sourceRecordType && input.sourceRecordId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("source_record_type", input.sourceRecordType)
      .eq("source_record_id", input.sourceRecordId)
      .limit(2);
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) > 1)
      throw new Error(
        `Ambiguous contact source identity for ${input.sourceRecordType}:${input.sourceRecordId}`,
      );
    contact = data?.[0] ?? null;
  }
  if (!contact && email) {
    contact = await findCanonicalContactByEmail(supabase, email);
  }
  if (!contact && input.phone) {
    contact = await findCanonicalContactByPhone(supabase, input.phone);
  }
  if (!contact) {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        full_name: input.name.trim(),
        primary_email: email,
        phone: input.phone || null,
        company_id: company.id,
        source: input.source,
        source_record_type: input.sourceRecordType || null,
        source_record_id: input.sourceRecordId || null,
      })
      .select("id, full_name, primary_email")
      .single();
    if (error) throw new Error(error.message);
    contact = data;
  }

  return { contact, company };
}

/** Applies one already-reviewed row. It deliberately fills blank fields on an
 * existing record instead of overwriting founder-maintained values. */
export async function importApprovedContactFixture(
  supabase: SupabaseClient,
  input: ImportApprovedContactInput,
) {
  if (!isConfiguredAdmin(input.actorEmail)) throw new Error("Forbidden");
  const replay = await supabase
    .from("contacts")
    .select("id,company_id")
    .eq("source_record_type", "contact_import_row")
    .eq("source_record_id", input.rowId)
    .maybeSingle();
  if (replay.error) throw new Error(replay.error.message);
  if (replay.data) {
    await recordActivity(supabase, {
      activityType: "contact_imported",
      title: `Imported contact: ${input.data.fullName}`,
      summary: "Approved contact import replay reconciled",
      contactId: replay.data.id,
      companyId: replay.data.company_id,
      source: "contact_import",
      actorEmail: input.actorEmail,
      externalId: `row:${input.rowId}`,
      metadata: {
        batch_id: input.batchId,
        row_id: input.rowId,
        action: input.action,
        replayed: true,
      },
    });
    await recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "contact.import_reconciled",
      entityType: "contact",
      entityId: replay.data.id,
      source: "admin",
      metadata: { import_batch_id: input.batchId, import_row_id: input.rowId },
    });
    return {
      contactId: replay.data.id,
      companyId: replay.data.company_id,
      replayed: true,
      changedFields: [] as string[],
    };
  }

  const current = await inspectContactImportIdentity(supabase, input.data);
  let contact = current.contact;
  let company = current.company;
  const hasAmbiguousContact = current.contactCandidates.length > 1;
  const hasAmbiguousCompany = current.companyCandidates.length > 1;
  const expectedContact = input.expectedContactId
    ? (current.contactCandidates.find((candidate) => candidate.id === input.expectedContactId) ??
      null)
    : null;
  const expectedCompany = input.expectedCompanyId
    ? (current.companyCandidates.find((candidate) => candidate.id === input.expectedCompanyId) ??
      null)
    : null;

  if (current.status === "ambiguous") {
    if (hasAmbiguousContact && !expectedContact)
      throw new Error(`Identity needs review: ${current.reason}`);
    if (hasAmbiguousCompany && !expectedCompany)
      throw new Error(`Identity needs review: ${current.reason}`);
    if (expectedContact && hasAmbiguousContact) {
      const selected = await supabase
        .from("contacts")
        .select("id,full_name,primary_email,phone,title,company_id,metadata")
        .eq("id", expectedContact.id)
        .maybeSingle();
      if (selected.error) throw new Error(selected.error.message);
      if (!selected.data)
        throw new Error("Identity changed after review: the approved contact match is stale");
      contact = selected.data;
    }
    if (expectedCompany && hasAmbiguousCompany) {
      const selected = await supabase
        .from("companies")
        .select("id,name,domain,website,industry")
        .eq("id", expectedCompany.id)
        .maybeSingle();
      if (selected.error) throw new Error(selected.error.message);
      if (!selected.data)
        throw new Error("Company identity changed after review; analyze the batch again");
      company = selected.data;
    }
  } else {
    if (input.expectedContactId && current.contact?.id !== input.expectedContactId) {
      throw new Error("Identity changed after review: the approved contact match is stale");
    }
    if (input.expectedCompanyId && current.company?.id !== input.expectedCompanyId) {
      throw new Error("Company identity changed after review; analyze the batch again");
    }
  }

  if (input.action === "create" && contact)
    throw new Error("Identity changed after review: this email now belongs to an existing contact");
  if (input.action === "update" && !contact) {
    throw new Error("Identity changed after review: the approved contact match is stale");
  }
  if (
    input.action === "update" &&
    input.expectedContactId &&
    contact?.id !== input.expectedContactId
  ) {
    throw new Error("Identity changed after review: the approved contact match is stale");
  }

  if (!company && current.domain && input.data.companyName) {
    const inserted = await supabase
      .from("companies")
      .insert({
        name: input.data.companyName,
        domain: current.domain,
        website: input.data.website,
        industry: input.data.industry,
        source: input.data.source || "contact_import",
        source_record_type: "contact_import_company_row",
        source_record_id: input.rowId,
        metadata: { import_batch_id: input.batchId },
      })
      .select("id,name,domain,website,industry")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    company = inserted.data;
  } else if (company) {
    const companyUpdates: Record<string, unknown> = {};
    if (!company.website && input.data.website) companyUpdates.website = input.data.website;
    if (!company.industry && input.data.industry) companyUpdates.industry = input.data.industry;
    if (Object.keys(companyUpdates).length) {
      const updated = await supabase
        .from("companies")
        .update(companyUpdates)
        .eq("id", company.id)
        .select("id,name,domain,website,industry")
        .single();
      if (updated.error) throw new Error(updated.error.message);
      company = updated.data;
    }
  }

  const changedFields: string[] = [];
  let contactId: string;
  if (contact) {
    const updates: Record<string, unknown> = {};
    if (!contact.phone && input.data.phone) {
      updates.phone = input.data.phone;
      changedFields.push("phone");
    }
    if (!contact.title && input.data.role) {
      updates.title = input.data.role;
      changedFields.push("role");
    }
    if (!contact.company_id && company?.id) {
      updates.company_id = company.id;
      changedFields.push("company");
    }
    const existingMetadata =
      contact.metadata && typeof contact.metadata === "object" ? contact.metadata : {};
    updates.metadata = {
      ...existingMetadata,
      last_contact_import_batch_id: input.batchId,
      ...(input.data.notes ? { import_notes: input.data.notes } : {}),
      ...(input.data.source ? { imported_source: input.data.source } : {}),
    };
    const updated = await supabase
      .from("contacts")
      .update(updates)
      .eq("id", contact.id)
      .select("id")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    contactId = updated.data.id;
  } else {
    const names = input.data.fullName.trim().split(/\s+/);
    const inserted = await supabase
      .from("contacts")
      .insert({
        first_name: names[0] || null,
        last_name: names.length > 1 ? names.slice(1).join(" ") : null,
        full_name: input.data.fullName,
        primary_email: normalizeEmail(input.data.email),
        phone: input.data.phone,
        title: input.data.role,
        company_id: company?.id ?? null,
        source: input.data.source || "contact_import",
        source_record_type: "contact_import_row",
        source_record_id: input.rowId,
        metadata: {
          import_batch_id: input.batchId,
          ...(input.data.notes ? { import_notes: input.data.notes } : {}),
          ...(input.data.companyName && !company
            ? { unlinked_company_name: input.data.companyName }
            : {}),
        },
      })
      .select("id")
      .single();
    if (inserted.error) throw new Error(inserted.error.message);
    contactId = inserted.data.id;
    changedFields.push("created");
  }

  await recordActivity(supabase, {
    activityType: "contact_imported",
    title: `${input.action === "create" ? "Imported" : "Enriched"} contact: ${input.data.fullName}`,
    summary: input.data.source
      ? `Approved contact import · ${input.data.source}`
      : "Approved contact import",
    contactId,
    companyId: company?.id ?? null,
    source: "contact_import",
    actorEmail: input.actorEmail,
    externalId: `row:${input.rowId}`,
    metadata: {
      batch_id: input.batchId,
      row_id: input.rowId,
      action: input.action,
      changed_fields: changedFields,
    },
  });

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: input.action === "create" ? "contact.imported" : "contact.enriched",
    entityType: "contact",
    entityId: contactId,
    source: "admin",
    after: { company_id: company?.id ?? null, changed_fields: changedFields },
    metadata: { import_batch_id: input.batchId, import_row_id: input.rowId },
  });
  return { contactId, companyId: company?.id ?? null, replayed: false, changedFields };
}

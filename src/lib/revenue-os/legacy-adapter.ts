import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueLinkage = {
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  stage: string | null;
  linked_by: "source" | "identity" | "email" | null;
};

type LinkableRecord = Record<string, unknown>;

type LinkOptions = {
  sourceRecordType: string;
  idField?: string;
  emailField?: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedEmail(value: unknown) {
  return text(value)?.toLowerCase() ?? null;
}

/**
 * Compatibility bridge for the specialized admin tools. Legacy source rows
 * remain intact, while every response exposes the canonical person and active
 * opportunity it resolves to. Missing Revenue OS schema degrades safely and
 * never makes a functioning source tool unavailable.
 */
export async function attachRevenueLinkage<T extends LinkableRecord>(
  supabase: SupabaseClient,
  records: T[],
  options: LinkOptions,
): Promise<{ records: Array<T & { revenue_os: RevenueLinkage }>; schemaReady: boolean }> {
  const idField = options.idField ?? "id";
  const emailField = options.emailField ?? "email";
  const sourceIds = [
    ...new Set(records.map((record) => text(record[idField])).filter(Boolean)),
  ] as string[];
  const emails = [
    ...new Set(records.map((record) => normalizedEmail(record[emailField])).filter(Boolean)),
  ] as string[];
  const emptyLink = (): RevenueLinkage => ({
    contact_id: null,
    company_id: null,
    opportunity_id: null,
    stage: null,
    linked_by: null,
  });

  if (!records.length || (!sourceIds.length && !emails.length)) {
    return {
      records: records.map((record) => ({ ...record, revenue_os: emptyLink() })),
      schemaReady: true,
    };
  }

  const [sourceContacts, emailContacts] = await Promise.all([
    sourceIds.length
      ? supabase
          .from("contacts")
          .select("id,company_id,primary_email,source_record_id")
          .eq("source_record_type", options.sourceRecordType)
          .in("source_record_id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    emails.length
      ? supabase
          .from("contacts")
          .select("id,company_id,primary_email,source_record_id")
          .in("primary_email", emails)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sourceContacts.error || emailContacts.error) {
    return {
      records: records.map((record) => ({ ...record, revenue_os: emptyLink() })),
      schemaReady: false,
    };
  }

  type ContactRow = {
    id: string;
    company_id: string | null;
    primary_email: string | null;
    source_record_id: string | null;
  };
  const contacts = [...(sourceContacts.data ?? []), ...(emailContacts.data ?? [])] as ContactRow[];
  const contactIds = [...new Set(contacts.map((contact) => contact.id))];
  const [sourceOpportunities, contactOpportunities, emailOpportunities] = await Promise.all([
    sourceIds.length
      ? supabase
          .from("opportunities")
          .select("id,contact_id,company_id,email,stage,source_record_id,created_at")
          .eq("source_record_type", options.sourceRecordType)
          .in("source_record_id", sourceIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? supabase
          .from("opportunities")
          .select("id,contact_id,company_id,email,stage,source_record_id,created_at")
          .in("contact_id", contactIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    emails.length
      ? supabase
          .from("opportunities")
          .select("id,contact_id,company_id,email,stage,source_record_id,created_at")
          .in("email", emails)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sourceOpportunities.error || contactOpportunities.error || emailOpportunities.error) {
    return {
      records: records.map((record) => ({ ...record, revenue_os: emptyLink() })),
      schemaReady: false,
    };
  }

  type OpportunityRow = {
    id: string;
    contact_id: string | null;
    company_id: string | null;
    email: string | null;
    stage: string;
    source_record_id: string | null;
    created_at: string;
  };
  const opportunities = [
    ...(sourceOpportunities.data ?? []),
    ...(contactOpportunities.data ?? []),
    ...(emailOpportunities.data ?? []),
  ] as OpportunityRow[];
  const sourceContactMap = new Map(
    contacts.filter((row) => row.source_record_id).map((row) => [row.source_record_id!, row]),
  );
  const emailContactMap = new Map(
    contacts
      .filter((row) => row.primary_email)
      .map((row) => [row.primary_email!.toLowerCase(), row]),
  );
  const sourceOpportunityMap = new Map<string, OpportunityRow>();
  const contactOpportunityMap = new Map<string, OpportunityRow>();
  const emailOpportunityMap = new Map<string, OpportunityRow>();
  for (const opportunity of opportunities) {
    if (opportunity.source_record_id && !sourceOpportunityMap.has(opportunity.source_record_id))
      sourceOpportunityMap.set(opportunity.source_record_id, opportunity);
    if (opportunity.contact_id && !contactOpportunityMap.has(opportunity.contact_id))
      contactOpportunityMap.set(opportunity.contact_id, opportunity);
    const opportunityEmail = normalizedEmail(opportunity.email);
    if (opportunityEmail && !emailOpportunityMap.has(opportunityEmail))
      emailOpportunityMap.set(opportunityEmail, opportunity);
  }

  return {
    schemaReady: true,
    records: records.map((record) => {
      const sourceId = text(record[idField]);
      const email = normalizedEmail(record[emailField]);
      const contact =
        (sourceId && sourceContactMap.get(sourceId)) ||
        (email && emailContactMap.get(email)) ||
        null;
      const sourceOpportunity = sourceId ? sourceOpportunityMap.get(sourceId) : undefined;
      const opportunity =
        sourceOpportunity ||
        (contact ? contactOpportunityMap.get(contact.id) : undefined) ||
        (email ? emailOpportunityMap.get(email) : undefined) ||
        null;
      return {
        ...record,
        revenue_os: {
          contact_id: opportunity?.contact_id ?? contact?.id ?? null,
          company_id: opportunity?.company_id ?? contact?.company_id ?? null,
          opportunity_id: opportunity?.id ?? null,
          stage: opportunity?.stage ?? null,
          linked_by: sourceOpportunity
            ? "source"
            : contact
              ? "identity"
              : opportunity
                ? "email"
                : null,
        },
      };
    }),
  };
}

/**
 * Every compatibility route, and which legacy source tables it still reads.
 * Static truth: true even before a route is ever hit, so remaining consumers
 * are known from the registry alone. Runtime counters in
 * `legacy_adapter_usage` prove which ones actually serve traffic.
 */
export const LEGACY_ADAPTER_CONSUMERS: Array<{ route: string; sourceTables: string[] }> = [
  { route: "admin-leads", sourceTables: ["solution_requests"] },
  { route: "admin-chat-leads", sourceTables: ["chat_leads"] },
  { route: "admin-clients", sourceTables: ["clients"] },
  { route: "admin-contacts", sourceTables: ["contact_submissions"] },
  { route: "admin-partners", sourceTables: ["partner_applications"] },
  { route: "admin-resources", sourceTables: ["resource_downloads"] },
  { route: "admin-subscribers", sourceTables: ["subscribers"] },
  { route: "admin-website-grades", sourceTables: ["website_grades"] },
  {
    route: "admin-inbox",
    sourceTables: [
      "solution_requests",
      "contact_submissions",
      "chat_leads",
      "partner_applications",
    ],
  },
];

export interface LegacyAdapterUsage {
  route: string;
  calls: number;
  totalRows: number;
  linkedRows: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
}

/**
 * Best-effort usage write. Telemetry must never break a read: a missing
 * table (migration not yet applied), RLS denial, or pooler failure degrades
 * to unrecorded, never to a failed response.
 */
export async function recordLegacyAdapterUse(
  supabase: SupabaseClient,
  input: { route: string; rows: number; linked: number },
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const { error: readError, data: existing } = await supabase
      .from("legacy_adapter_usage")
      .select("route,calls,total_rows,linked_rows,first_used_at")
      .eq("route", input.route)
      .maybeSingle();
    if (readError) return false;
    if (!existing) {
      const { error } = await supabase.from("legacy_adapter_usage").insert({
        route: input.route,
        calls: 1,
        total_rows: input.rows,
        linked_rows: input.linked,
        first_used_at: now,
        last_used_at: now,
        updated_at: now,
      });
      return !error;
    }
    const row = existing as Record<string, unknown>;
    const { error } = await supabase
      .from("legacy_adapter_usage")
      .update({
        calls: Number(row.calls ?? 0) + 1,
        total_rows: Number(row.total_rows ?? 0) + input.rows,
        linked_rows: Number(row.linked_rows ?? 0) + input.linked,
        last_used_at: now,
        updated_at: now,
      })
      .eq("route", input.route);
    return !error;
  } catch (error) {
    console.warn(
      "[legacy-adapter] usage write failed:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * attachRevenueLinkage plus a usage receipt. Drop-in for the ten existing
 * call sites: same return shape, same degradation, plus telemetry.
 */
export async function attachRevenueLinkageWithTelemetry<T extends LinkableRecord>(
  supabase: SupabaseClient,
  records: T[],
  options: LinkOptions,
  telemetry: { route: string },
): Promise<{ records: Array<T & { revenue_os: RevenueLinkage }>; schemaReady: boolean }> {
  const linked = await attachRevenueLinkage(supabase, records, options);
  const linkedCount = linked.records.filter((record) => record.revenue_os.contact_id).length;
  await recordLegacyAdapterUse(supabase, {
    route: telemetry.route,
    rows: records.length,
    linked: linkedCount,
  });
  return linked;
}

export interface LegacyAdapterUsageReport {
  contract: "revenue-os-legacy-adapter-usage.v1";
  telemetryReady: boolean;
  consumers: Array<LegacyAdapterUsage & { sourceTables: string[] }>;
}

/**
 * Joins the static consumer registry with runtime counters. When the usage
 * table is absent (migration not applied) every consumer still lists with
 * zero counters and telemetryReady:false rather than failing.
 */
export async function getLegacyAdapterUsage(
  supabase: SupabaseClient,
): Promise<LegacyAdapterUsageReport> {
  let rows: Array<Record<string, unknown>> = [];
  let telemetryReady = true;
  try {
    const { data, error } = await supabase
      .from("legacy_adapter_usage")
      .select("route,calls,total_rows,linked_rows,first_used_at,last_used_at")
      .order("last_used_at", { ascending: false });
    if (error) {
      telemetryReady = false;
    } else {
      rows = (data ?? []) as Array<Record<string, unknown>>;
    }
  } catch (error) {
    console.warn(
      "[legacy-adapter] usage read failed:",
      error instanceof Error ? error.message : error,
    );
    telemetryReady = false;
  }
  const byRoute = new Map(rows.map((row) => [row.route as string, row]));
  return {
    contract: "revenue-os-legacy-adapter-usage.v1",
    telemetryReady,
    consumers: LEGACY_ADAPTER_CONSUMERS.map((consumer) => {
      const row = byRoute.get(consumer.route);
      return {
        route: consumer.route,
        sourceTables: consumer.sourceTables,
        calls: Number(row?.calls ?? 0),
        totalRows: Number(row?.total_rows ?? 0),
        linkedRows: Number(row?.linked_rows ?? 0),
        firstUsedAt: (row?.first_used_at as string) ?? null,
        lastUsedAt: (row?.last_used_at as string) ?? null,
      };
    }),
  };
}

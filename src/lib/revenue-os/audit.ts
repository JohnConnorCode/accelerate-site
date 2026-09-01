import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUDIT_SOURCES = [
  "admin",
  "ai",
  "automation",
  "webhook",
  "migration",
  "public",
] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export interface AuditEvent {
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: AuditSource;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuditHistoryFilters {
  actor?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AuditHistoryEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  source: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface AuditHistoryResult {
  entries: AuditHistoryEntry[];
  filterOptions: {
    actors: string[];
    entityTypes: string[];
    actions: string[];
    sources: string[];
  };
}

const REDACTED = "[redacted]";
const SENSITIVE_KEY =
  /token|secret|password|authorization|api[_-]?key|refresh|access_token|private[_-]?key|cookie|body_text|body_html|raw_mime/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const OPTION_SCAN = 500;
const AUDIT_COLUMNS =
  "id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata,created_at";

export function redactAuditValue(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (typeof value === "string") {
    if (value.startsWith("v1.") && value.split(".").length === 4) return REDACTED;
    if (/^(sk-|re_|eyJ|ya29\.|GOCSPX-|whsec_)/.test(value)) return REDACTED;
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactAuditValue(entry, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        childKey,
        redactAuditValue(child, childKey),
      ]),
    );
  }
  return value;
}

export function proposalAuditSummary(
  proposal:
    | {
        title?: unknown;
        status?: unknown;
        client_name?: unknown;
        total_one_time?: unknown;
        total_monthly?: unknown;
        lead_id?: unknown;
        opportunity_id?: unknown;
      }
    | null
    | undefined,
) {
  if (!proposal) return null;
  return {
    title: proposal.title ?? null,
    status: proposal.status ?? null,
    client_name: proposal.client_name ?? null,
    total_one_time: proposal.total_one_time ?? null,
    total_monthly: proposal.total_monthly ?? null,
    lead_id: proposal.lead_id ?? null,
    opportunity_id: proposal.opportunity_id ?? null,
  };
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function dateBound(value: string | undefined, edge: "start" | "end") {
  if (!value) return null;
  if (!DATE_ONLY.test(value)) throw new Error("Audit date filters must be YYYY-MM-DD");
  return edge === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
}

export async function recordAudit(supabase: SupabaseClient, event: AuditEvent): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    actor_email: event.actorEmail ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    source: event.source ?? "admin",
    before_state: redactAuditValue(event.before ?? null),
    after_state: redactAuditValue(event.after ?? null),
    metadata: redactAuditValue(event.metadata ?? {}),
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Audit write failed: ${error.message}`);
}

export async function listAuditHistory(
  supabase: SupabaseClient,
  filters: AuditHistoryFilters = {},
): Promise<AuditHistoryResult> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIMIT));
  let query = supabase
    .from("audit_log")
    .select(AUDIT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.actor) query = query.eq("actor_email", filters.actor);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.source) query = query.eq("source", filters.source);
  const from = dateBound(filters.from, "start");
  const to = dateBound(filters.to, "end");
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const [{ data, error }, options] = await Promise.all([
    query,
    supabase
      .from("audit_log")
      .select("actor_email,action,entity_type,source")
      .order("created_at", { ascending: false })
      .limit(OPTION_SCAN),
  ]);
  if (error) throw new Error(`Audit read failed: ${error.message}`);
  if (options.error) throw new Error(`Audit read failed: ${options.error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const optionRows = (options.data ?? []) as Array<Record<string, unknown>>;
  return {
    entries: rows.map((row) => ({
      id: String(row.id),
      actorEmail: typeof row.actor_email === "string" ? row.actor_email : null,
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: typeof row.entity_id === "string" ? row.entity_id : null,
      source: String(row.source),
      before: row.before_state ?? null,
      after: row.after_state ?? null,
      metadata: row.metadata ?? {},
      createdAt: String(row.created_at),
    })),
    filterOptions: {
      actors: uniqueSorted(optionRows.map((row) => row.actor_email as string | null)),
      entityTypes: uniqueSorted(optionRows.map((row) => row.entity_type as string | null)),
      actions: uniqueSorted(optionRows.map((row) => row.action as string | null)),
      sources: uniqueSorted(optionRows.map((row) => row.source as string | null)),
    },
  };
}

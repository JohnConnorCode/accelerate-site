import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Atomic claim primitive for the Feature Board (feature_requests), the
// coding-agent coordination mechanism for this codebase. Mirrors
// src/lib/revenue-os/work-items.ts's claim shape but wraps
// claim_feature_request (migrations/20260903-feature-request-claims.sql)
// instead of claim_work_item: feature_requests is platform-global (no
// tenant_id column), so this RPC takes no tenant context and is callable
// directly by a service-role Node script with no HTTP/session hop — the
// deliberate choice for scripts/agent-dispatch.ts, which runs as a plain
// Node CLI process with no request context to resolve a tenant from.
// ---------------------------------------------------------------------------

export type FeatureRequestStatus = "backlog" | "planned" | "in_progress" | "blocked" | "shipped";
export type FeatureRequestPriority = "urgent" | "high" | "medium" | "low";

export interface FeatureRequestCard {
  id: string;
  seed_key: string | null;
  title: string;
  description: string | null;
  status: FeatureRequestStatus;
  priority: FeatureRequestPriority;
  labels: string[];
  sort_order: number;
  owner: string | null;
  target_date: string | null;
  acceptance_criteria: string | null;
  notes: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
  claimed_at: string | null;
}

export interface ClaimFeatureCardInput {
  seedKey?: string;
  id?: string;
  leaseOwner: string;
  leaseDurationMs?: number;
  wipLimit?: number;
}

/** Default `p_wip_limit` for `claim_feature_request`. Keep the status display
 *  in sync with this so `agent:status` reports the same gate a claim would hit. */
export const FEATURE_BOARD_WIP_LIMIT = 6;

export interface ClaimFeatureCardResult {
  id: string | null;
  claimed: boolean;
  existingStatus: string;
  recoveredStale: boolean;
}

export async function claimFeatureCard(
  supabase: SupabaseClient,
  input: ClaimFeatureCardInput,
): Promise<ClaimFeatureCardResult> {
  const { data, error } = await supabase.rpc("claim_feature_request", {
    p_seed_key: input.seedKey ?? null,
    p_id: input.id ?? null,
    p_lease_owner: input.leaseOwner,
    p_lease_duration_ms: input.leaseDurationMs ?? 1_800_000,
    p_wip_limit: input.wipLimit ?? FEATURE_BOARD_WIP_LIMIT,
  });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("claim_feature_request returned no row");
  return {
    id: row.feature_request_id,
    claimed: row.claimed,
    existingStatus: row.existing_status,
    recoveredStale: row.recovered_stale,
  };
}

export async function releaseFeatureCard(
  supabase: SupabaseClient,
  input: { id: string; leaseOwner: string; force?: boolean },
): Promise<boolean> {
  // Reset status to backlog, not just clear the lease: the WIP gate in
  // claim_feature_request treats status='in_progress' with a NULL
  // lease_expires_at as still occupying a slot (that's the correct read for
  // a legacy card claimed via the pre-RPC owner-text protocol, which has no
  // lease at all) — so a release that left status alone would strand the
  // card in_progress-with-no-owner forever, invisible to
  // listClaimableFeatureCards and permanently consuming a WIP slot.
  //
  // `force` skips the lease_owner match: this script already runs with the
  // service-role key, so anyone who can run it can already edit the row
  // directly — the ownership check exists to stop an agent from
  // accidentally releasing a card it doesn't hold, not to lock out a human
  // operator. A founder must always be able to reclaim a stalled or
  // wrongly-claimed card without waiting for the lease to expire.
  let notesUpdate: string | undefined;
  if (input.force) {
    const { data: current } = await supabase
      .from("feature_requests")
      .select("notes, lease_owner")
      .eq("id", input.id)
      .maybeSingle();
    if (current && current.lease_owner && current.lease_owner !== input.leaseOwner) {
      notesUpdate = `${current.notes ?? ""}\n\nForce-released ${new Date().toISOString()} by ${input.leaseOwner} (overrode a claim held by ${current.lease_owner}).`;
    }
  }
  let query = supabase.from("feature_requests").update({
    status: "backlog",
    owner: null,
    lease_owner: null,
    lease_expires_at: null,
    claimed_at: null,
    ...(notesUpdate ? { notes: notesUpdate } : {}),
  });
  query = input.force
    ? query.eq("id", input.id)
    : query.eq("id", input.id).eq("lease_owner", input.leaseOwner);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function renewFeatureCardLease(
  supabase: SupabaseClient,
  input: { id: string; leaseOwner: string; leaseDurationMs?: number },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("feature_requests")
    .update({
      lease_expires_at: new Date(Date.now() + (input.leaseDurationMs ?? 1_800_000)).toISOString(),
    })
    .eq("id", input.id)
    .eq("lease_owner", input.leaseOwner)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function completeFeatureCard(
  supabase: SupabaseClient,
  input: { id: string; leaseOwner: string; evidence: string; force?: boolean },
): Promise<boolean> {
  const { data: current, error: readError } = await supabase
    .from("feature_requests")
    .select("notes, lease_owner")
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) return false;
  if (!input.force && current.lease_owner !== input.leaseOwner) return false;

  const overrideNote =
    input.force && current.lease_owner && current.lease_owner !== input.leaseOwner
      ? ` (force-completed, overriding a claim held by ${current.lease_owner})`
      : "";
  const notes = `${current.notes ?? ""}\n\nCompleted ${new Date().toISOString()} by ${input.leaseOwner}${overrideNote}:\n${input.evidence}`;
  let query = supabase.from("feature_requests").update({
    status: "shipped",
    notes,
    owner: input.leaseOwner,
    lease_owner: null,
    lease_expires_at: null,
    // A card that ships clean shouldn't carry a stale-recovery grudge into
    // any future reopen (migrations/20260903d-feature-request-bounded-stale-recovery.sql).
    stale_recovery_count: 0,
  });
  query = input.force
    ? query.eq("id", input.id)
    : query.eq("id", input.id).eq("lease_owner", input.leaseOwner);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

const CARD_COLUMNS =
  "id, seed_key, title, description, status, priority, labels, sort_order, owner, target_date, acceptance_criteria, notes, lease_owner, lease_expires_at, claimed_at";

export async function getFeatureCardContext(
  supabase: SupabaseClient,
  input: { seedKey?: string; id?: string },
): Promise<FeatureRequestCard | null> {
  let query = supabase.from("feature_requests").select(CARD_COLUMNS);
  query = input.id ? query.eq("id", input.id) : query.eq("seed_key", input.seedKey ?? "");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as FeatureRequestCard | null;
}

export async function listClaimableFeatureCards(
  supabase: SupabaseClient,
  input: { limit?: number; dispatchableOnly?: boolean } = {},
): Promise<FeatureRequestCard[]> {
  let query = supabase
    .from("feature_requests")
    .select(CARD_COLUMNS)
    .in("status", ["backlog", "planned"])
    .is("archived_at", null)
    .or("lease_expires_at.is.null,lease_expires_at.lt.now()");
  // Match what claim_feature_request's auto-pick would actually choose:
  // milestone:now|next only, unless the caller explicitly wants the full
  // backlog view (dispatchableOnly: false).
  if (input.dispatchableOnly !== false) {
    query = query.or("labels.cs.{milestone:now},labels.cs.{milestone:next}");
  }
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .limit(input.limit ?? 20);
  if (error) throw new Error(error.message);
  // sort_order alone doesn't reflect priority; the authoritative pick order
  // lives in claim_feature_request's CASE expression. Re-rank here for
  // display only so `agent:status`/listing shows the same order a claim
  // would actually resolve.
  const rank: Record<FeatureRequestPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  return ((data ?? []) as FeatureRequestCard[]).sort((a, b) => rank[a.priority] - rank[b.priority]);
}

/**
 * Work currently occupying WIP slots: every `in_progress` row, including
 * leaseless pre-RPC markers (the WIP gate counts those too). Display-only so
 * `agent:status` answers the question the `wip_limit_reached` error sends
 * operators to it with.
 */
export async function listActiveFeatureCards(
  supabase: SupabaseClient,
  input: { limit?: number } = {},
): Promise<FeatureRequestCard[]> {
  const { data, error } = await supabase
    .from("feature_requests")
    .select(CARD_COLUMNS)
    .eq("status", "in_progress")
    .is("archived_at", null)
    .order("claimed_at", { ascending: false, nullsFirst: false })
    .limit(input.limit ?? 20);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeatureRequestCard[];
}

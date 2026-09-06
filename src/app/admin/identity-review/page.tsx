"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldQuestion,
  UserPlus,
  UserX,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { RevenueSetupGate } from "@/components/admin/RevenueSetupGate";
import { fetchJson } from "@/lib/admin/fetchJson";
import { useAdminQuery } from "@/lib/admin/useAdminQuery";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";
import type { IdentityReviewItem } from "@/lib/revenue-os/identity-review";

interface ReviewListResponse {
  contract: string;
  items: IdentityReviewItem[];
}

function ageLabel(createdAt: string): string {
  const ms = Date.now() - Date.parse(createdAt);
  if (Number.isNaN(ms)) return "unknown age";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under an hour old";
  if (hours < 24) return `${hours}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

export default function IdentityReviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [resolving, setResolving] = useState(false);

  const reviewQuery = useAdminQuery<ReviewListResponse>(
    ["identity-review"],
    "/api/admin/revenue-os/identity-review?limit=50",
  );
  const items = useMemo(() => reviewQuery.data?.items ?? [], [reviewQuery.data]);
  const selected = items.find((item) => item.actionId === selectedId) ?? items[0] ?? null;

  async function resolve(
    decision: "link" | "create" | "no_match" | "defer",
    extra: Record<string, unknown> = {},
  ) {
    if (!selected || resolving) return;
    if (decision === "link" && !candidateId) {
      toast.error("Choose the matching contact first.");
      return;
    }
    if (decision === "create" && !fullName.trim()) {
      toast.error("Enter the contact's full name first.");
      return;
    }
    setResolving(true);
    try {
      const candidate = selected.candidates.find((c) => c.id === candidateId);
      await fetchJson("/api/admin/revenue-os/identity-review", {
        method: "POST",
        body: JSON.stringify({
          actionId: selected.actionId,
          decision,
          contactId: decision === "link" ? candidateId : undefined,
          companyId: decision === "link" ? (candidate?.company_id ?? undefined) : undefined,
          fullName: decision === "create" ? fullName.trim() : undefined,
          ...extra,
        }),
      });
      toast.success(
        decision === "defer"
          ? "Deferred. The item stays in the queue."
          : decision === "no_match"
            ? "Recorded: no canonical match."
            : "Identity resolved and linked.",
      );
      setCandidateId(null);
      setFullName("");
      await reviewQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resolution failed.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <AdminReadBody
      loading={reviewQuery.isPending}
      hasData={Boolean(reviewQuery.data)}
      error={
        reviewQuery.isError
          ? (reviewQuery.error?.message ?? "Could not load the review queue.")
          : undefined
      }
      onRetry={() => void reviewQuery.refetch()}
      refreshing={reviewQuery.isFetching}
      loadingFallback={<LoadingSkeleton variant="detail" />}
      label="Loading identity reviews"
    >
      <PageHeader
        title="Identity Review"
        subtitle="Ambiguous and unmatched senders, waiting for a founder decision. Nothing here merges or deletes."
      />
      <RevenueSetupGate />
      {reviewQuery.isPending ? (
        <LoadingSkeleton variant="detail" />
      ) : reviewQuery.isError ? (
        <AdminSurface tone="attention" className="flex items-center gap-3">
          <X className="size-4" aria-hidden />
          <p className="text-sm">Could not load the review queue.</p>
          <button
            type="button"
            onClick={() => reviewQuery.refetch()}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            <RefreshCw className="size-4" aria-hidden /> Retry
          </button>
        </AdminSurface>
      ) : items.length === 0 ? (
        <AdminSurface className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-[var(--admin-success)]" aria-hidden />
          <div>
            <p className="font-semibold">Queue clear</p>
            <p className="text-sm text-[var(--admin-action-ink)]-muted">
              Every participant resolved to a canonical record. New ambiguities land here
              automatically.
            </p>
          </div>
        </AdminSurface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <AdminSurface padding="none" className="overflow-hidden">
            <ul className="divide-y divide-border-glass" aria-label="Unresolved identities">
              {items.map((item) => (
                <li key={item.actionId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(item.actionId);
                      setCandidateId(null);
                      setFullName("");
                    }}
                    aria-current={selected?.actionId === item.actionId}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors",
                      selected?.actionId === item.actionId && "bg-white/5",
                    )}
                  >
                    <span className="truncate text-sm font-semibold">{item.participantEmail}</span>
                    <span className="flex items-center gap-2 text-xs text-[var(--admin-action-ink)]-muted">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 font-semibold",
                          item.reason === "ambiguous"
                            ? "border-[var(--admin-warning)]/30 bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                            : "border-[var(--admin-accent)]/30 bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]",
                        )}
                      >
                        {item.reason}
                      </span>
                      <Clock className="size-3" aria-hidden />
                      {ageLabel(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </AdminSurface>

          {selected && (
            <AdminSurface className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-action-ink)]-muted">
                  {selected.source} ·{" "}
                  {selected.threadId ? `thread ${selected.threadId.slice(0, 12)}` : "no thread"}
                </p>
                <h2 className="text-lg font-bold">{selected.participantEmail}</h2>
                <p className="text-sm text-[var(--admin-action-ink)]-muted">
                  {selected.downstream.conversationSubject ?? "Conversation"} ·{" "}
                  {selected.downstream.conversationStatus ?? "open"}
                </p>
              </div>

              {selected.evidence.length > 0 && (
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--admin-action-ink)]-muted">
                    Match evidence
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {selected.evidence.map((row, index) => (
                      <li key={index} className="text-sm">
                        <span className="font-semibold">{row.strength ?? "recorded"}</span>
                        {" — "}
                        {row.observation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-action-ink)]-muted">
                  Candidate records
                </h3>
                {selected.candidates.length === 0 ? (
                  <p className="text-sm text-[var(--admin-action-ink)]-muted">
                    No candidates. Link is unavailable; create the contact or record no match.
                  </p>
                ) : (
                  <ul
                    className="flex flex-col gap-2"
                    role="radiogroup"
                    aria-label="Candidate contacts"
                  >
                    {selected.candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2",
                            candidateId === candidate.id
                              ? "border-[var(--admin-success)]/50"
                              : "border-border-glass",
                          )}
                        >
                          <input
                            type="radio"
                            name="identity-candidate"
                            checked={candidateId === candidate.id}
                            onChange={() => setCandidateId(candidate.id)}
                            className="size-4"
                          />
                          <span>
                            <span className="block text-sm font-semibold">
                              {candidate.full_name}
                            </span>
                            <span className="block text-xs text-[var(--admin-action-ink)]-muted">
                              {candidate.primary_email ?? "no email"}
                              {candidate.company_name ? ` · ${candidate.company_name}` : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-action-ink)]-muted">
                  New contact
                </h3>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name for a new contact"
                  aria-label="Full name for a new contact"
                  className="w-full rounded-xl border border-border-glass bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={resolving || !candidateId}
                  onClick={() => resolve("link")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--admin-action)] px-4 py-2 text-sm font-semibold text-[var(--admin-action-ink)] disabled:opacity-50"
                >
                  {resolving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  Link selected
                </button>
                <button
                  type="button"
                  disabled={resolving || !fullName.trim()}
                  onClick={() => resolve("create")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-glass px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <UserPlus className="size-4" aria-hidden /> Create contact
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => resolve("no_match")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-glass px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <UserX className="size-4" aria-hidden /> No match
                </button>
                <button
                  type="button"
                  disabled={resolving}
                  onClick={() => resolve("defer")}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-[var(--admin-action-ink)]-muted disabled:opacity-50"
                >
                  <ShieldQuestion className="size-4" aria-hidden /> Defer
                </button>
              </div>
            </AdminSurface>
          )}
        </div>
      )}
    </AdminReadBody>
  );
}

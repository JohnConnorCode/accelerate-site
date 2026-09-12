"use client";

import { adminPageName } from "@/lib/admin/navigation";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, ShieldQuestion, UserPlus, UserX } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { AdminReadBody } from "@/components/admin/AdminReadBody";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
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
          ? "Saved for later. This contact still needs review."
          : decision === "no_match"
            ? "Saved as no matching contact."
            : "Contact matched to this conversation.",
      );
      setCandidateId(null);
      setFullName("");
      await reviewQuery.refetch();
    } catch {
      toast.error("We couldn’t save your decision. Refresh the page and try again.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={adminPageName("identity-review")}
        subtitle="Match unfamiliar senders to the right contact so their messages appear with the right history."
      />
      <AdminReadBody
        loading={reviewQuery.isPending}
        hasData={Boolean(reviewQuery.data)}
        error={
          reviewQuery.isError
            ? "We couldn’t load contacts that need review. Try again in a moment."
            : undefined
        }
        onRetry={() => void reviewQuery.refetch()}
        refreshing={reviewQuery.isFetching}
        loadingFallback={<LoadingSkeleton variant="detail" />}
        label="Loading contacts to review"
      >
        {items.length === 0 ? (
          <AdminSurface className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-[var(--admin-success)]" aria-hidden />
            <div>
              <p className="font-semibold">No contacts need review</p>
              <p className="text-sm text-[var(--admin-muted)]">
                Senders who need a contact match will appear here.
              </p>
            </div>
          </AdminSurface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <AdminSurface padding="none" className="overflow-hidden">
              <ul className="divide-y divide-border-glass" aria-label="Contacts to review">
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
                      <span className="truncate text-sm font-semibold">
                        {item.participantEmail}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-[var(--admin-muted)]">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 font-semibold",
                            item.reason === "ambiguous"
                              ? "border-[var(--admin-warning)]/30 bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
                              : "border-[var(--admin-accent)]/30 bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]",
                          )}
                        >
                          {item.reason === "ambiguous"
                            ? "Multiple possible matches"
                            : "No matching contact"}
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
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--admin-muted)]">
                    {selected.source} conversation
                  </p>
                  <h2 className="text-lg font-bold">{selected.participantEmail}</h2>
                  <p className="text-sm text-[var(--admin-muted)]">
                    {selected.downstream.conversationSubject ?? "Conversation"} ·{" "}
                    {selected.downstream.conversationStatus ?? "open"}
                  </p>
                </div>

                {selected.evidence.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--admin-muted)]">
                      Why this might be a match
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {selected.evidence.map((row, index) => (
                        <li key={index} className="text-sm">
                          <span className="font-semibold">{row.strength ?? "recorded"}</span>
                          {": "}
                          {row.observation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-muted)]">
                    Suggested contacts
                  </h3>
                  {selected.candidates.length === 0 ? (
                    <p className="text-sm text-[var(--admin-muted)]">
                      No suggested contacts. Create a contact, or choose “No match” to finish this
                      review without linking anyone.
                    </p>
                  ) : (
                    <ul
                      className="flex flex-col gap-2"
                      role="radiogroup"
                      aria-label="Suggested contacts"
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
                              <span className="block text-xs text-[var(--admin-muted)]">
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
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--admin-muted)]">
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
                    className="admin-button admin-button--primary"
                  >
                    {resolving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden />
                    )}
                    Match selected contact
                  </button>
                  <button
                    type="button"
                    disabled={resolving || !fullName.trim()}
                    onClick={() => resolve("create")}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-glass px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <UserPlus className="size-4" aria-hidden /> Create contact
                  </button>
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => resolve("no_match")}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-glass px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <UserX className="size-4" aria-hidden /> No match
                  </button>
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => resolve("defer")}
                    className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-[var(--admin-muted)] disabled:opacity-50"
                  >
                    <ShieldQuestion className="size-4" aria-hidden /> Review later
                  </button>
                </div>
              </AdminSurface>
            )}
          </div>
        )}
      </AdminReadBody>
    </>
  );
}

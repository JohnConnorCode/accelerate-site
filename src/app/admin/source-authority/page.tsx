"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import {
  SOURCE_AUTHORITY_TIERS,
  type SourceAuthorityEntry,
  type SourceAuthorityTier,
} from "@/lib/revenue-os/source-authority-types";

const tierTone: Record<SourceAuthorityTier, string> = {
  official: "bg-black/[0.055] text-[var(--admin-success)] dark:bg-white/[0.07]",
  approved: "bg-black/[0.055] text-[var(--admin-ink)] dark:bg-white/[0.07]",
  working: "bg-black/[0.055] text-[var(--admin-warning)] dark:bg-white/[0.07]",
  low: "bg-black/[0.055] text-[var(--admin-muted)] dark:bg-white/[0.07]",
};

function isStale(entry: SourceAuthorityEntry, now = Date.now()): boolean {
  const verified = Date.parse(entry.last_verified_at);
  if (Number.isNaN(verified)) return true;
  return verified + entry.verification_lapse_days * 86_400_000 < now;
}

export default function SourceAuthorityPage() {
  const [entries, setEntries] = useState<SourceAuthorityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [systemKey, setSystemKey] = useState("canonical_crm");
  const [displayName, setDisplayName] = useState("");
  const [truthDomains, setTruthDomains] = useState("contact_identity, pipeline_stage");
  const [tier, setTier] = useState<SourceAuthorityTier>("official");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [lastVerifiedAt, setLastVerifiedAt] = useState(new Date().toISOString().slice(0, 10));
  const [lapseDays, setLapseDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/source-authority");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setToast({ message: "Failed to load source authority", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEntries();
  }, [fetchEntries]);

  const handleRegister = async () => {
    if (!displayName.trim() || !ownerEmail.trim()) {
      setToast({ message: "Name and owner are required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/source-authority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemKey,
          displayName,
          truthDomains: truthDomains
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean),
          authorityTier: tier,
          ownerEmail,
          lastVerifiedAt: new Date(lastVerifiedAt).toISOString(),
          verificationLapseDays: Number(lapseDays) || 90,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Register failed");
      setToast({ message: "Source registered", type: "success" });
      setDisplayName("");
      setShowForm(false);
      await fetchEntries();
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to register source",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Source authority" />
        <LoadingSkeleton variant="page" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Source authority"
        subtitle="Tell the model what to believe. Each connected system owns named truth domains, with a tier, an owner and a last-verified date. Unregistered sources stay at the lowest trust."
      />

      <div className="space-y-6">
        <AdminSurface padding="lg">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="admin-eyebrow">Knowledge trust</p>
                <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                  Registered sources
                </h2>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowForm((value) => !value)}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Register source
            </Button>
          </div>

          {showForm && (
            <div className="mb-5 space-y-3 rounded-xl bg-[var(--admin-surface-subtle)] p-4 shadow-[var(--admin-shadow-border)]">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  System key
                  <Input
                    value={systemKey}
                    onChange={(event) => setSystemKey(event.target.value)}
                    placeholder="canonical_crm"
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Display name
                  <Input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Canonical CRM"
                    className="mt-1"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                Truth domains
                <Input
                  value={truthDomains}
                  onChange={(event) => setTruthDomains(event.target.value)}
                  placeholder="contact_identity, pipeline_stage"
                  className="mt-1"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Authority tier
                  <select
                    value={tier}
                    onChange={(event) => setTier(event.target.value as SourceAuthorityTier)}
                    className="mt-1 block w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm"
                  >
                    {SOURCE_AUTHORITY_TIERS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Owner
                  <Input
                    type="email"
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="founder@example.com"
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Last verified
                  <Input
                    type="date"
                    value={lastVerifiedAt}
                    onChange={(event) => setLastVerifiedAt(event.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                  Verification lapse (days)
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={lapseDays}
                    onChange={(event) => setLapseDays(event.target.value)}
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleRegister} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save source"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {entries.length === 0 ? (
            <p className="admin-copy rounded-xl bg-[var(--admin-surface-subtle)] px-4 py-6 text-center text-sm">
              No sources registered. Unregistered systems stay at the lowest authority until you add
              them.
            </p>
          ) : (
            <div className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-border)]">
              {entries.map((entry) => {
                const stale = isStale(entry);
                return (
                  <div key={entry.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--admin-ink)]">
                        {entry.display_name}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tierTone[entry.authority_tier]}`}
                      >
                        {entry.authority_tier}
                      </span>
                      {stale ? (
                        <span className="rounded-full bg-black/[0.055] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-warning)] dark:bg-white/[0.07]">
                          Stale
                        </span>
                      ) : (
                        <span className="rounded-full bg-black/[0.055] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-success)] dark:bg-white/[0.07]">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="admin-copy mt-1 text-pretty text-xs">
                      {entry.system_key} · {entry.truth_domains.join(", ")} · owner{" "}
                      {entry.owner_email}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-[var(--admin-muted)]">
                      Verified {new Date(entry.last_verified_at).toLocaleDateString()} · lapse{" "}
                      {entry.verification_lapse_days} days
                      {stale ? " · past verification lapse, not served as current" : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </AdminSurface>
      </div>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
}

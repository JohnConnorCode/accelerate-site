"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
  const [tier, setTier] = useState<SourceAuthorityTier>("working");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [lastVerifiedAt, setLastVerifiedAt] = useState(new Date().toISOString().slice(0, 10));
  const [lapseDays, setLapseDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [entityTypes, setEntityTypes] = useState("");
  const [coworkerIds, setCoworkerIds] = useState("");
  const tenantId = useRef("");
  const pendingTenantId = useRef("");
  const pending = useRef<Record<string, unknown> | null>(null);
  const storageKey = () =>
    `accelerate:source-authority:${pendingTenantId.current || tenantId.current}`;
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/source-authority");
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.entries) || typeof data.tenantId !== "string")
        throw new Error("Source list unavailable");
      tenantId.current = data.tenantId;
      setEntries(data.entries);
      setLoadError(null);
      const stored = sessionStorage.getItem(`accelerate:source-authority:${data.tenantId}`);
      if (stored && !pending.current) {
        const command = JSON.parse(stored);
        pending.current = command;
        pendingTenantId.current = data.tenantId;
        setSystemKey(command.systemKey);
        setDisplayName(command.displayName);
        setTruthDomains(command.truthDomains.join(", "));
        setTier(command.authorityTier);
        setOwnerEmail(command.ownerEmail);
        setLastVerifiedAt(command.lastVerifiedAt.slice(0, 10));
        setLapseDays(String(command.verificationLapseDays));
        setEntityTypes(command.appliesTo?.entityTypes?.join(", ") ?? "");
        setCoworkerIds(command.appliesTo?.coworkerIds?.join(", ") ?? "");
        setShowForm(true);
        setUncertain(true);
      }
      return true;
    } catch {
      setLoadError("Sources could not be loaded. Retry before treating this list as current.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);
  const handleRegister = async () => {
    setSaving(true);
    try {
      if (!pending.current) {
        const split = (value: string) =>
          value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        const scope = {
          ...(entityTypes.trim() ? { entityTypes: split(entityTypes) } : {}),
          ...(coworkerIds.trim() ? { coworkerIds: split(coworkerIds) } : {}),
        };
        pendingTenantId.current = tenantId.current;
        pending.current = {
          systemKey,
          displayName,
          truthDomains: split(truthDomains),
          authorityTier: tier,
          ownerEmail,
          lastVerifiedAt: new Date(lastVerifiedAt).toISOString(),
          verificationLapseDays: Number(lapseDays),
          appliesTo: Object.keys(scope).length ? scope : null,
          expectedVersion:
            entries.find((entry) => entry.system_key === systemKey.trim().toLowerCase())?.version ??
            0,
          requestKey: crypto.randomUUID(),
        };
        sessionStorage.setItem(storageKey(), JSON.stringify(pending.current));
      }
      const res = await fetch("/api/admin/source-authority", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-source-authority-tenant-id": pendingTenantId.current,
        },
        body: JSON.stringify(pending.current),
      });
      const data = await res.json();
      if (!res.ok) {
        if (uncertain && [400, 403, 409].includes(res.status)) {
          setToast({
            message: `${data.error || "Restore access or review this request."} The earlier save remains unconfirmed; keep its request for recovery.`,
            type: "error",
          });
          return;
        }
        if ([400, 403, 409].includes(res.status)) {
          pending.current = null;
          sessionStorage.removeItem(storageKey());
          pendingTenantId.current = "";
          setUncertain(false);
          setToast({
            message: data.error || "Review the source settings and retry.",
            type: "error",
          });
          if (res.status === 409) await fetchEntries();
          return;
        }
        throw new Error("Unconfirmed response");
      }
      if (data.requestKey !== pending.current.requestKey || !data.auditId || !data.entry?.id)
        throw new Error("Missing save receipt");
      pending.current = null;
      sessionStorage.removeItem(storageKey());
      pendingTenantId.current = "";
      setUncertain(false);
      setToast({
        message: data.replayed ? "Earlier save confirmed" : "Source saved",
        type: "success",
      });
      setShowForm(false);
      await fetchEntries();
    } catch {
      setUncertain(true);
      setShowForm(true);
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
        subtitle="Give agents verified sources so your team spends less time correcting conflicting answers and outdated instructions."
      />

      <div className="space-y-6">
        {loadError && (
          <div
            role="alert"
            className="admin-copy rounded-xl p-4 shadow-[var(--admin-shadow-border)]"
          >
            <p>{loadError}</p>
            <Button variant="secondary" onClick={() => void fetchEntries()}>
              Reload sources
            </Button>
          </div>
        )}

        <AdminSurface padding="lg">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-black/[0.045] text-[var(--admin-ink)] dark:bg-white/[0.06]">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h2 className="mt-1 text-balance text-lg font-semibold tracking-[-0.02em] text-[var(--admin-ink)]">
                  Registered sources
                </h2>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={saving || uncertain || Boolean(loadError)}
              onClick={() => setShowForm((value) => !value)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Register source
            </Button>
          </div>

          {showForm && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleRegister();
              }}
              className="mb-5 space-y-3 rounded-xl bg-[var(--admin-surface-subtle)] p-4 shadow-[var(--admin-shadow-border)]"
            >
              {uncertain && (
                <p role="alert" className="admin-copy">
                  Save is unconfirmed. Keep this form and retry the same request. A retry recovers
                  the earlier receipt if the save succeeded.
                </p>
              )}
              <fieldset disabled={saving || uncertain} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    System key
                    <Input
                      required
                      maxLength={63}
                      pattern="[a-zA-Z][a-zA-Z0-9_]*"
                      value={systemKey}
                      onChange={(event) => setSystemKey(event.target.value)}
                      placeholder="canonical_crm"
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    Display name
                    <Input
                      required
                      maxLength={120}
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
                    required
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
                      required
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
                      required
                      max={new Date().toISOString().slice(0, 10)}
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
                      required
                      value={lapseDays}
                      onChange={(event) => setLapseDays(event.target.value)}
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    Entity scope (optional)
                    <Input
                      className="mt-1"
                      value={entityTypes}
                      onChange={(event) => setEntityTypes(event.target.value)}
                      placeholder="company, contact"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[var(--admin-ink)]">
                    Coworker IDs (optional)
                    <Input
                      className="mt-1"
                      value={coworkerIds}
                      onChange={(event) => setCoworkerIds(event.target.value)}
                      placeholder="reviewer"
                    />
                  </label>
                </div>
                <p className="admin-copy text-xs">
                  Separate domains and scopes with commas. Leave scopes blank to cover the
                  workspace. Restricted sources stay low when the search has no matching context.
                </p>
              </fieldset>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : uncertain ? (
                    "Retry same save"
                  ) : (
                    "Save source"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={saving || uncertain}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {entries.length === 0 && !loadError ? (
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
                    <p className="admin-copy mt-1 break-words text-pretty text-xs">
                      {entry.system_key} · {entry.truth_domains.join(", ")} · owner{" "}
                      {entry.owner_email}
                    </p>
                    {entry.applies_to && (
                      <p className="admin-copy mt-1 break-words text-xs">
                        Scope: {entry.applies_to.entityTypes?.join(", ") || "all entities"} ·{" "}
                        {entry.applies_to.coworkerIds?.join(", ") || "all coworkers"}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--admin-muted)]">
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
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

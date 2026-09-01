"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { AdminLayoutRegionDef } from "@/lib/admin/layout-scopes";

interface LayoutDoc {
  order: string[];
  hidden: string[];
}

interface AuditHistoryEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  createdAt: string;
}

interface LayoutResponse {
  doc: LayoutDoc | null;
  history: AuditHistoryEntry[];
}

export function LayoutScopeCard({
  scopeId,
  scopeLabel,
  regions,
  onToast,
}: {
  scopeId: string;
  scopeLabel: string;
  regions: AdminLayoutRegionDef[];
  onToast: (message: string, type: "success" | "error") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(false);
  const [data, setData] = useState<LayoutResponse | null>(null);

  const fetchLayout = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/revenue-os/layout?scope=${encodeURIComponent(scopeId)}`);
      if (!res.ok) throw new Error("Load failed");
      setData(await res.json());
    } catch {
      onToast(`Failed to load ${scopeLabel} layout`, "error");
    } finally {
      setLoading(false);
    }
    // onToast is stable-enough for this effect's purpose; re-running it on
    // every parent render would refetch on unrelated state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, scopeLabel]);

  useEffect(() => {
    void fetchLayout();
  }, [fetchLayout]);

  const handleRevert = async () => {
    setReverting(true);
    try {
      const res = await fetch("/api/admin/revenue-os/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: scopeId, action: "revert" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Revert failed");
      onToast(`${scopeLabel} layout reverted`, "success");
      await fetchLayout();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Revert failed", "error");
    } finally {
      setReverting(false);
    }
  };

  const labelFor = (id: string) => regions.find((region) => region.id === id)?.label ?? id;
  const doc = data?.doc ?? null;
  const lastChange = data?.history?.[0];
  const canRevert = Boolean(data?.history?.length);

  return (
    <div className="px-4 py-4">
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--admin-ink)]">{scopeLabel}</p>
          {loading ? (
            <p className="admin-copy mt-1 text-xs">Loading current layout…</p>
          ) : doc ? (
            <div className="mt-1.5 space-y-1 text-xs">
              <p className="admin-copy">
                Order: {doc.order.length ? doc.order.map(labelFor).join(" → ") : "default"}
              </p>
              {doc.hidden.length > 0 && (
                <p className="admin-copy">Hidden: {doc.hidden.map(labelFor).join(", ")}</p>
              )}
            </div>
          ) : (
            <p className="admin-copy mt-1 text-xs">
              Using the default order — no override applied.
            </p>
          )}
          {lastChange && (
            <p className="admin-copy mt-2 text-[10px] uppercase tracking-[0.06em] text-[var(--admin-muted)]">
              Last changed by {lastChange.actorEmail || "unknown"} ·{" "}
              {new Date(lastChange.createdAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRevert()}
            disabled={loading || reverting || !canRevert}
          >
            {reverting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to previous
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

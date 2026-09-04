"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { fetchJson } from "@/lib/admin/fetchJson";
import { getLayoutScope } from "@/lib/admin/layout-scopes";
import type { LayoutDoc } from "@/lib/admin/layout-overrides";
import { toast } from "@/lib/admin/useToast";
import { cn } from "@/lib/utils";

interface LayoutCustomizeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Layout scope id, e.g. "page.today". */
  scope: string;
  /** Currently stored doc; null means defaults. */
  currentDoc: LayoutDoc | null;
  onSaved: () => void;
}

interface DraftRow {
  id: string;
  label: string;
  required: boolean;
  hidden: boolean;
}

function draftFromDoc(
  regionIds: Array<{ id: string; label: string }>,
  requiredIds: string[],
  doc: LayoutDoc | null,
): DraftRow[] {
  const known = new Map(regionIds.map((region) => [region.id, region]));
  const required = new Set(requiredIds);
  const hidden = new Set(doc?.hidden ?? []);
  const ordered = (doc?.order ?? []).filter((id) => known.has(id));
  for (const region of regionIds) {
    if (!ordered.includes(region.id)) ordered.push(region.id);
  }
  return ordered.map((id) => ({
    id,
    label: known.get(id)!.label,
    required: required.has(id),
    hidden: hidden.has(id) && !required.has(id),
  }));
}

/**
 * Founder-facing editor for a layout scope: reorder regions, hide the
 * hideable ones, reset to defaults. Required regions cannot be hidden and
 * say so inline. Every control is a real button, so the whole editor works
 * keyboard-only; persistence goes through the validated save endpoint,
 * which refuses unknown ids and required hides.
 */
export function LayoutCustomizeDialog({
  open,
  onClose,
  scope,
  currentDoc,
  onSaved,
}: LayoutCustomizeDialogProps) {
  const scopeDef = getLayoutScope(scope);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !scopeDef) return;
    setDraft(draftFromDoc(scopeDef.regions, scopeDef.requiredIds, currentDoc));
  }, [open, scope, currentDoc, scopeDef]);

  const dirty = useMemo(() => {
    if (!scopeDef) return false;
    const baseline = draftFromDoc(scopeDef.regions, scopeDef.requiredIds, currentDoc);
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, scopeDef, currentDoc]);

  if (!scopeDef) return null;

  const move = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  const toggleHidden = (id: string) => {
    setDraft((current) =>
      current.map((row) => (row.id === id && !row.required ? { ...row, hidden: !row.hidden } : row)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetchJson("/api/admin/revenue-os/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          action: "save",
          doc: { order: draft.map((row) => row.id), hidden: draft.filter((row) => row.hidden).map((row) => row.id) },
        }),
      });
      toast.success("Layout saved.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the layout.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog open={open} onClose={onClose} title={`Customize ${scopeDef.label}`} maxWidth="sm">
      <div className="w-full rounded-[20px] bg-[var(--admin-surface)] p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-[var(--admin-ink)]">
          Customize {scopeDef.label}
        </h2>
        <p className="admin-copy mt-1 text-xs leading-5">
          Reorder sections and hide the ones you never use. Required sections stay put so
          nothing essential can vanish.
        </p>
        <ul className="mt-4 space-y-1.5">
          {draft.map((row, index) => (
            <li
              key={row.id}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-xl bg-black/[0.025] px-2 py-1 dark:bg-white/[0.03]",
                row.hidden && "opacity-55",
              )}
            >
              <span className="min-w-0 flex-1 truncate px-1.5 text-sm font-medium text-[var(--admin-ink)]">
                {row.label}
                {row.required && (
                  <span className="ml-2 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-muted)] dark:bg-white/[0.08]">
                    Required
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${row.label} up`}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--admin-ink)] disabled:opacity-30 dark:hover:bg-white/[0.06]"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === draft.length - 1}
                aria-label={`Move ${row.label} down`}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--admin-ink)] disabled:opacity-30 dark:hover:bg-white/[0.06]"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleHidden(row.id)}
                disabled={row.required}
                aria-pressed={row.hidden}
                aria-label={row.hidden ? `Show ${row.label}` : `Hide ${row.label}`}
                title={row.required ? "Required sections cannot be hidden" : undefined}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--admin-ink)] disabled:opacity-30 dark:hover:bg-white/[0.06]"
              >
                {row.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft(draftFromDoc(scopeDef.regions, scopeDef.requiredIds, null))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
          >
            <RotateCcw className="size-3.5" /> Reset to default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-xs font-semibold text-[var(--admin-muted)] transition-colors hover:text-[var(--admin-ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--admin-ink)] px-4 text-xs font-semibold text-[var(--admin-surface)] transition-opacity hover:opacity-85 disabled:opacity-45"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </AdminDialog>
  );
}

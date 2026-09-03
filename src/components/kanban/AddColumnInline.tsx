"use client";

import { type ReactNode, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddColumnInlineProps {
  onAdd: (label: string) => Promise<unknown>;
  /** Lets a board (e.g. Pipeline's future role/probability inputs) inject
   * extra fields into the same inline form without a bespoke component. */
  extraFields?: ReactNode;
  tileLabel?: string;
}

/**
 * Trailing "+ Add column" tile. Expands in place into a label input (plus
 * any board-specific `extraFields`) and calls the create mutation on submit.
 */
export function AddColumnInline({ onAdd, extraFields, tileLabel = "Add column" }: AddColumnInlineProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setLabel("");
  };

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAdd(trimmed);
      close();
    } catch {
      // useKanbanColumns already toasts the failure; keep the form open so
      // the label isn't lost.
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="w-[310px] shrink-0 snap-start lg:snap-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-muted)] transition-[background-color,color,border-color] duration-150 hover:border-[var(--admin-ink)]/30 hover:bg-black/[0.018] hover:text-[var(--admin-ink)] dark:hover:bg-white/[0.018]"
        >
          <Plus className="size-3.5" /> {tileLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="w-[310px] shrink-0 snap-start lg:snap-none">
      <div className="rounded-2xl bg-black/[0.018] p-3 shadow-[inset_0_0_0_1px_var(--admin-border)] dark:bg-white/[0.018]">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
              if (event.key === "Escape") close();
            }}
            placeholder="Column name"
            maxLength={60}
            disabled={saving}
            className="min-h-9 w-full min-w-0 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-2.5 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Cancel"
            disabled={saving}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
          >
            <X className="size-4" />
          </button>
        </div>
        {extraFields}
        <button
          type="button"
          disabled={!label.trim() || saving}
          onClick={() => void submit()}
          className={cn(
            "mt-2.5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--admin-ink)] text-xs font-semibold text-[var(--admin-surface)] transition-opacity duration-150 hover:opacity-85 disabled:opacity-50",
          )}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Add column
        </button>
      </div>
    </div>
  );
}

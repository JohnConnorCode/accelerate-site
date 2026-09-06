"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchJson } from "@/lib/admin/fetchJson";
import { toast } from "@/lib/admin/useToast";
import type { ModuleSettingField } from "@/lib/revenue-os/modules";

/**
 * Renders a module's declared settings and saves them through the shared
 * PATCH /api/admin/tenant/modules endpoint. This is the one place module
 * settings render: a manifest declares fields, this form draws them, so a
 * registered module gets a real settings screen without shipping React and
 * the admin design token contract holds for it automatically.
 */
export function ModuleSettingsForm({
  moduleId,
  fields,
  values,
}: {
  moduleId: string;
  fields: ModuleSettingField[];
  values: Record<string, string | number | boolean | undefined>;
}) {
  const [draft, setDraft] = useState<Record<string, string | number | boolean>>(() => {
    const initial: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      const value = values[field.key];
      if (value !== undefined) initial[field.key] = value;
      else if (field.default !== undefined) initial[field.key] = field.default;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function setField(key: string, value: string | number | boolean) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await fetchJson("/api/admin/tenant/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, settings: draft }),
      });
      toast.success("Settings saved");
      setDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--admin-border)] pt-4">
      <p className="admin-eyebrow text-[10px]">Settings</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.type === "boolean" ? "sm:col-span-2" : undefined}>
            {field.type === "boolean" ? (
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-black/[0.025] px-3 shadow-[var(--admin-shadow-border)] dark:bg-white/[0.035]">
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-[var(--admin-ink)]">
                    {field.label}
                  </span>
                  {field.description && (
                    <span className="admin-copy mt-0.5 block text-[11px]">{field.description}</span>
                  )}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(draft[field.key])}
                  aria-label={field.label}
                  onClick={() => setField(field.key, !draft[field.key])}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    draft[field.key]
                      ? "bg-[var(--admin-success)]"
                      : "bg-black/[0.15] dark:bg-white/[0.18]"
                  }`}
                >
                  <span
                    className={`inline-block size-4.5 transform rounded-full bg-white shadow transition-transform ${
                      draft[field.key] ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            ) : (
              <label className="admin-field-label">
                <span>{field.label}</span>
                {field.type === "enum" ? (
                  <select
                    value={String(draft[field.key] ?? "")}
                    onChange={(event) => setField(field.key, event.target.value)}
                    className="admin-field"
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === "number" ? "number" : field.type === "url" ? "url" : "text"
                    }
                    value={String(draft[field.key] ?? "")}
                    min={field.min}
                    max={field.max}
                    onChange={(event) =>
                      setField(
                        field.key,
                        field.type === "number" ? Number(event.target.value) : event.target.value,
                      )
                    }
                    className="admin-field"
                  />
                )}
                {field.description && (
                  <span className="admin-copy mt-1 block text-[11px] font-normal">
                    {field.description}
                  </span>
                )}
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}

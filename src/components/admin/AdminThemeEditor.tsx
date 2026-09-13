"use client";
import { useState, type CSSProperties } from "react";
import { Download, Sparkles, ArrowRight } from "lucide-react";
import { AdminSurface } from "./AdminSurface";
import { useAdminAI } from "./AdminAIProvider";
import { ADMIN_APPEARANCES } from "@/lib/admin/appearances";
import {
  compileAdminTheme,
  themeFromPreset,
  validateAdminTheme,
  type AdminThemeDefinition,
} from "@/lib/admin/theme-definition";

const control = "admin-field mt-1.5";
export function AdminThemeEditor({
  value,
  onChange,
  onApply,
  busy,
}: {
  value: AdminThemeDefinition | null;
  onChange: (theme: AdminThemeDefinition | null) => void;
  onApply: () => void;
  busy: boolean;
}) {
  const ai = useAdminAI();
  const [prompt, setPrompt] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const draft = value ?? themeFromPreset("light");
  let error = "";
  let preview: CSSProperties = {};
  try {
    const tokens = compileAdminTheme(draft);
    delete tokens["color-scheme"];
    preview = { ...tokens, colorScheme: draft.mode } as CSSProperties;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Check the theme definition.";
  }
  function edit(patch: Partial<AdminThemeDefinition>) {
    onChange({ ...draft, ...patch });
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(validateAdminTheme(draft), null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminSurface padding="lg" id="workspace-theme" className="scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Appearance</p>
          <h2 className="mt-1 text-lg font-semibold">Make this workspace yours</h2>
          <p className="admin-copy mt-1 max-w-xl text-sm">
            Start with a theme, adjust the details, or describe a design to AI. Preview it here
            before saving.
          </p>
        </div>
        <button
          type="button"
          className="admin-theme-button"
          disabled={!value || !!error || busy}
          onClick={onApply}
        >
          Save and use theme <ArrowRight className="size-4" />
        </button>
      </div>
      <div className="mt-6 admin-split admin-split--equal">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="admin-field-label">
              Start from
              <select
                className={control}
                defaultValue=""
                onChange={(event) => onChange(themeFromPreset(event.target.value))}
              >
                <option value="" disabled>
                  Choose a starting point
                </option>
                {ADMIN_APPEARANCES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field-label">
              Theme name
              <input
                className={control}
                value={draft.name}
                maxLength={60}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </label>
          </div>
          <label className="admin-field-label">
            Description
            <input
              className={control}
              value={draft.description}
              maxLength={160}
              onChange={(e) => edit({ description: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(draft.palette) as (keyof typeof draft.palette)[]).map((key) => (
              <label key={key} className="admin-field-label">
                <span>
                  {
                    {
                      canvas: "Canvas",
                      surface: "Surface",
                      ink: "Text",
                      muted: "Secondary text",
                      accent: "Accent",
                      sidebar: "Navigation",
                      sidebarInk: "Navigation text",
                    }[key]
                  }
                </span>
                <span className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--admin-surface-subtle)] px-2">
                  <input
                    aria-label={`${key} color`}
                    type="color"
                    className="size-8 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                    value={draft.palette[key]}
                    onChange={(e) => edit({ palette: { ...draft.palette, [key]: e.target.value } })}
                  />
                  <span className="font-mono text-[11px] tabular-nums">{draft.palette[key]}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="admin-field-label">
              Mode
              <select
                className={control}
                value={draft.mode}
                onChange={(e) => edit({ mode: e.target.value as AdminThemeDefinition["mode"] })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="admin-field-label">
              Typography
              <select
                className={control}
                value={draft.font}
                onChange={(e) => edit({ font: e.target.value as AdminThemeDefinition["font"] })}
              >
                <option value="sans">Modern</option>
                <option value="editorial">Editorial</option>
                <option value="mono">Technical</option>
              </select>
            </label>
            <label className="admin-field-label">
              Depth
              <select
                className={control}
                value={draft.depth}
                onChange={(e) => edit({ depth: e.target.value as AdminThemeDefinition["depth"] })}
              >
                <option value="flat">Flat</option>
                <option value="soft">Soft</option>
                <option value="elevated">Elevated</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="admin-field-label">
              Surface corners · {draft.geometry.surfaceRadius}px
              <input
                type="range"
                min={0}
                max={24}
                value={draft.geometry.surfaceRadius}
                onChange={(e) =>
                  edit({
                    geometry: {
                      surfaceRadius: Number(e.target.value),
                      controlRadius: Math.min(draft.geometry.controlRadius, Number(e.target.value)),
                    },
                  })
                }
              />
            </label>
            <label className="admin-field-label">
              Control corners · {draft.geometry.controlRadius}px
              <input
                type="range"
                min={0}
                max={Math.min(16, draft.geometry.surfaceRadius)}
                value={draft.geometry.controlRadius}
                onChange={(e) =>
                  edit({ geometry: { ...draft.geometry, controlRadius: Number(e.target.value) } })
                }
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <div className="rounded-xl bg-[var(--admin-surface-subtle)] p-4">
            <label className="admin-field-label">
              Describe your theme
              <input
                className={control}
                placeholder="Warm ivory, forest green, soft corners…"
                value={prompt}
                maxLength={1000}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="admin-theme-button mt-3"
              onClick={() =>
                ai.openWithPrompt(
                  `Create a workspace admin theme${prompt.trim() ? `: ${prompt.trim()}` : " based on the current workspace brand"}. Read the workspace brand, generate a valid adminTheme definition, preview the exact change, then propose it for my approval. Preserve other brand fields. Use at least 4.5:1 text contrast. Explain the style and ask me to approve before saving.`,
                )
              }
            >
              <Sparkles className="size-4" /> Create with AI
            </button>
            <p className="admin-copy mt-2 text-xs">
              AI prepares a theme for your approval. It will not change your workspace
              automatically.
            </p>
          </div>
          <details className="admin-disclosure">
            <summary>Import or export a theme</summary>
            <div className="space-y-3 px-4 pb-4">
              <p className="admin-copy text-xs">
                Reuse a theme from another workspace or an AI-generated definition.
              </p>
              <textarea
                aria-label="Theme definition"
                className="admin-field min-h-32 py-3 font-mono text-xs"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                maxLength={12000}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="admin-theme-button"
                  onClick={() => {
                    try {
                      onChange(validateAdminTheme(JSON.parse(importText)));
                      setImportError("");
                    } catch (e) {
                      setImportError(e instanceof Error ? e.message : "Invalid theme");
                    }
                  }}
                >
                  Preview import
                </button>
                <button
                  type="button"
                  className="admin-theme-button"
                  disabled={!!error}
                  onClick={download}
                >
                  <Download className="size-4" /> Export theme
                </button>
              </div>
              {importError && (
                <p role="alert" className="text-xs text-[var(--admin-danger)]">
                  {importError}
                </p>
              )}
            </div>
          </details>
          {value && (
            <button
              type="button"
              className="min-h-11 text-sm text-[var(--admin-muted)] underline underline-offset-4"
              onClick={() => onChange(null)}
            >
              Remove workspace theme from saved branding
            </button>
          )}
        </div>
        <div
          className="admin-theme-preview overflow-hidden rounded-2xl border border-[var(--admin-border)]"
          style={preview}
          aria-label="Theme preview"
        >
          <div
            className="flex min-h-72 bg-[var(--admin-canvas)] p-3"
            style={{ fontFamily: "var(--admin-font)" }}
          >
            <div className="flex w-20 shrink-0 flex-col gap-3 rounded-xl bg-[var(--admin-sidebar)] p-3 text-[var(--admin-nav-ink)]">
              <span className="text-xs font-semibold">Workspace</span>
              <span className="rounded-lg bg-[var(--admin-nav-active-bg)] px-2 py-2 text-[10px] text-[var(--admin-nav-active-ink)]">
                Today
              </span>
              <span className="px-2 text-[10px]">Pipeline</span>
              <span className="px-2 text-[10px]">People</span>
            </div>
            <div className="min-w-0 flex-1 p-4 text-[var(--admin-ink)]">
              <p className="text-xl font-semibold">Good morning</p>
              <p className="mt-1 text-xs text-[var(--admin-muted)]">
                Everything you need to move work forward.
              </p>
              <AdminSurface className="mt-5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--admin-muted)]">
                  Needs your attention
                </p>
                <p className="mt-2 text-sm font-semibold">Review the next proposal</p>
                <p className="mt-2 text-xs text-[var(--admin-muted)]">
                  A clear next step, ready when you are.
                </p>
                <span className="mt-4 inline-flex rounded-lg bg-[var(--admin-action)] px-3 py-2 text-xs font-medium text-[var(--admin-action-ink)]">
                  Review proposal
                </span>
              </AdminSurface>
            </div>
          </div>
          <p className="border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-xs text-[var(--admin-muted)]">
            Preview · Your current appearance stays active until you save.
          </p>
        </div>
      </div>
    </AdminSurface>
  );
}

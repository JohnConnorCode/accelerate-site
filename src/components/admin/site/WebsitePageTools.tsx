"use client";
import { WebsiteModelPicker } from "./WebsiteModelPicker";
import { DEFAULT_SITE_MODEL } from "@/lib/site-studio/models";
import { useState } from "react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import {
  createWebsitePage,
  suggestedWebsitePath,
  WEBSITE_STARTERS,
  type WebsiteStarter,
} from "@/lib/site-studio/website-authoring";
import {
  parseWebsiteDocument,
  type WebsiteDocument,
  type WebsitePage,
} from "@/lib/site-studio/website-document";
import { websiteButtonClass as button, websiteFieldClass as field } from "./WebsiteFields";
import { Plus, Copy, Sparkles, X } from "lucide-react";
export function WebsitePageTools({
  website,
  page,
  onChange,
  disabled,
}: {
  website: WebsiteDocument;
  page: WebsitePage;
  onChange: (document: WebsiteDocument, pageId?: string) => void;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [clone, setClone] = useState(false);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [starter, setStarter] = useState<WebsiteStarter>("service");
  const [error, setError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState<"edit" | "generate">("edit");
  const [model, setModel] = useState(DEFAULT_SITE_MODEL);
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<{
    page: WebsitePage;
    summary: string;
    before: string;
  } | null>(null);
  const openCreate = (copy: boolean) => {
    setClone(copy);
    setTitle(copy ? `${page.metadata.title} copy` : "");
    setPath(copy ? suggestedWebsitePath(website, `${page.metadata.title} copy`) : "");
    setError("");
    setCreating(true);
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          disabled={disabled}
          onClick={() => openCreate(false)}
        >
          <Plus size={16} className="mr-2" />
          Add page
        </button>
        <button
          type="button"
          className={button}
          disabled={disabled}
          onClick={() => openCreate(true)}
        >
          <Copy size={16} className="mr-2" />
          Clone page
        </button>
        <button
          type="button"
          className={button}
          disabled={disabled}
          onClick={() => {
            setAiOpen(true);
            setError("");
          }}
        >
          <Sparkles size={16} className="mr-2" />
          Ask AI
        </button>
      </div>
      <AdminDialog
        className="rounded-2xl bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-2xl"
        open={creating}
        onClose={() => setCreating(false)}
        title={clone ? "Clone page" : "Create a page"}
      >
        <form
          className="space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const next = createWebsitePage(website, {
                title,
                path,
                starter,
                ...(clone ? { cloneId: page.id } : {}),
              });
              onChange({ ...website, pages: [...website.pages, next] }, next.id);
              setCreating(false);
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Check the page title and address.",
              );
            }
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{clone ? "Clone page" : "Create a page"}</h2>
            <button
              type="button"
              className={button}
              aria-label="Close create page"
              onClick={() => setCreating(false)}
            >
              <X size={18} />
            </button>
          </div>
          <label className="block text-sm">
            Page title
            <input
              data-admin-autofocus="true"
              required
              maxLength={160}
              className={field}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPath(suggestedWebsitePath(website, e.target.value));
              }}
            />
          </label>
          <label className="block text-sm">
            Page address
            <input
              required
              className={field}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/your-page"
            />
          </label>
          {!clone && (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Starting point</legend>
              {WEBSITE_STARTERS.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] p-3"
                >
                  <input
                    type="radio"
                    name="starter"
                    value={item.id}
                    checked={starter === item.id}
                    onChange={() => setStarter(item.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-[var(--admin-muted)]">{item.detail}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <p className="text-sm text-[var(--admin-muted)]">
            Starts as a private draft. Edit manually or ask AI, preview, then review before
            publishing.
          </p>
          {error && (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <button type="submit" className={button} disabled={disabled}>
            Create draft page
          </button>
        </form>
      </AdminDialog>
      <AdminDialog
        className="rounded-2xl bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-2xl"
        open={aiOpen}
        onClose={() => {
          if (!busy) setAiOpen(false);
        }}
        title="Edit with AI"
        maxWidth="lg"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Edit with AI</h2>
            <button
              className={button}
              disabled={busy}
              aria-label="Close AI editor"
              onClick={() => setAiOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-[var(--admin-muted)]">
            {page.metadata.title} · {page.path}
          </p>
          <label className="block text-sm">
            What would you like to change?
            <textarea
              data-admin-autofocus="true"
              className={field}
              rows={4}
              maxLength={2000}
              value={instruction}
              onChange={(e) => {
                setInstruction(e.target.value);
                setProposal(null);
              }}
              placeholder="Make the introduction clearer and the next step more specific."
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            Scope
            <select
              className={field}
              value={mode}
              disabled={busy}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setProposal(null);
              }}
            >
              <option value="edit">Improve copy; keep layout</option>
              <option value="generate">Generate a new page layout and copy</option>
            </select>
          </label>
          <WebsiteModelPicker
            value={model}
            disabled={busy}
            onChange={(value) => {
              setModel(value);
              setProposal(null);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <button
            className={button}
            disabled={disabled || busy || instruction.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError("");
              setProposal(null);
              const before = JSON.stringify(page);
              try {
                const response = await fetch("/api/admin/site/website/suggest", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    page,
                    instruction,
                    mode,
                    model,
                    business: website.identity.name,
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error ?? "AI is unavailable.");
                parseWebsiteDocument({
                  ...website,
                  pages: website.pages.map((p) => (p.id === page.id ? result.page : p)),
                });
                setProposal({ ...result, before });
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "AI is unavailable. Your edits are preserved.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Preparing suggestion…" : "Prepare suggestion"}
          </button>
          {proposal && (
            <section
              className="space-y-3 rounded-lg bg-[var(--admin-surface-subtle)] p-4"
              aria-label="AI suggestion review"
            >
              <h3 className="font-semibold">Review suggestion</h3>
              <p className="text-sm">{proposal.summary}</p>
              <div className="max-h-64 overflow-auto">
                <WebsiteSuggestion before={page} after={proposal.page} />
              </div>
              <p className="text-xs text-[var(--admin-muted)]">
                Applying changes updates your local draft. Preview and save when ready; nothing is
                published.
              </p>
              <button
                className={button}
                disabled={disabled}
                onClick={() => {
                  if (JSON.stringify(page) !== proposal.before) {
                    setError(
                      "This page changed after the suggestion. Prepare a fresh suggestion to preserve your edits.",
                    );
                    return;
                  }
                  onChange({
                    ...website,
                    pages: website.pages.map((p) => (p.id === page.id ? proposal.page : p)),
                  });
                  setProposal(null);
                  setAiOpen(false);
                }}
              >
                Apply to draft
              </button>
            </section>
          )}
        </div>
      </AdminDialog>
    </>
  );
}
import { websiteTextFields } from "@/lib/site-studio/website-authoring";
function WebsiteSuggestion({ before, after }: { before: WebsitePage; after: WebsitePage }) {
  const old = new Map(websiteTextFields(before).map((field) => [field.key, field.value]));
  return (
    <dl className="space-y-3 text-sm">
      {websiteTextFields(after)
        .filter((field) => old.get(field.key) !== field.value)
        .map((field) => (
          <div key={field.key}>
            <dt className="mb-1 text-xs text-[var(--admin-muted)]">
              {field.key.replace(/\./g, " › ")}
            </dt>
            {old.has(field.key) && (
              <dd className="mb-1 line-through opacity-60">{old.get(field.key)}</dd>
            )}
            <dd>{field.value}</dd>
          </div>
        ))}
    </dl>
  );
}

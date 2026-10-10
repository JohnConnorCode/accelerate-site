"use client";
import { WebsiteModelPicker } from "./WebsiteModelPicker";
import { DEFAULT_SITE_MODEL, siteModel, modelPriceCeiling } from "@/lib/site-studio/models";
import { useEffect, useRef, useState } from "react";
import { WebsiteLivePreview } from "./WebsiteLivePreview";
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
  const [customPath, setCustomPath] = useState(false);
  const [starter, setStarter] = useState<WebsiteStarter>("service");
  const [error, setError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState<"edit" | "generate">("edit");
  const [model, setModel] = useState(() => siteModel(DEFAULT_SITE_MODEL));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewSuggestion, setPreviewSuggestion] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const cancelSuggestion = () => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setNotice("Suggestion canceled. Your draft is unchanged.");
  };
  const closeAi = () => {
    if (request.current) cancelSuggestion();
    setAiOpen(false);
  };
  const [proposal, setProposal] = useState<{
    page: WebsitePage;
    summary: string;
    before: string;
  } | null>(null);
  const staleProposal = !!proposal && JSON.stringify(page) !== proposal.before;
  const openCreate = (copy: boolean) => {
    setClone(copy);
    setCustomPath(false);
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
            setNotice("");
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
                if (!customPath) setPath(suggestedWebsitePath(website, e.target.value));
              }}
            />
          </label>
          <label className="block text-sm">
            Page address
            <input
              required
              className={field}
              value={path}
              onChange={(e) => {
                setCustomPath(true);
                setPath(e.target.value);
              }}
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
        onClose={closeAi}
        title="Edit with AI"
        maxWidth="xl"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Edit with AI</h2>
            <button type="button" className={button} aria-label="Close AI editor" onClick={closeAi}>
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
              if (value.id !== model.id) setProposal(null);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-[var(--admin-danger)]">
              {error}
            </p>
          )}
          <button
            type="button"
            className={button}
            disabled={disabled || busy || instruction.trim().length < 3}
            onClick={async () => {
              if (request.current) return;
              const controller = new AbortController();
              request.current = controller;
              setBusy(true);
              setError("");
              setNotice("");
              setProposal(null);
              setPreviewSuggestion(false);
              const before = JSON.stringify(page);
              try {
                const response = await fetch("/api/admin/site/website/suggest", {
                  signal: controller.signal,
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    page,
                    instruction,
                    mode,
                    model: model.id,
                    priceCeiling: modelPriceCeiling(model),
                    business: website.identity.name,
                  }),
                });
                const result = await response.json();
                if (controller.signal.aborted || request.current !== controller) return;
                if (!response.ok) throw new Error(result.error ?? "AI is unavailable.");
                parseWebsiteDocument({
                  ...website,
                  pages: website.pages.map((p) => (p.id === page.id ? result.page : p)),
                });
                setProposal({ ...result, before });
              } catch (cause) {
                if (controller.signal.aborted || request.current !== controller) return;
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "AI is unavailable. Your edits are preserved.",
                );
              } finally {
                if (request.current === controller) {
                  request.current = null;
                  setBusy(false);
                }
              }
            }}
          >
            {busy ? "Preparing suggestion…" : "Prepare suggestion"}
          </button>
          {busy && (
            <div className="space-y-2">
              <button type="button" className={button} onClick={cancelSuggestion}>
                Cancel suggestion
              </button>
              <p className="text-xs text-[var(--admin-muted)]">
                Cancel stops this request and keeps your draft. Provider charges may still apply.
              </p>
            </div>
          )}
          {notice && (
            <p role="status" className="text-sm text-[var(--admin-muted)]">
              {notice}
            </p>
          )}
          {proposal && (
            <section
              className="space-y-3 rounded-lg bg-[var(--admin-surface-subtle)] p-4"
              aria-label="AI suggestion review"
            >
              <h3 className="font-semibold">Review suggestion</h3>
              <p className="text-sm">{proposal.summary}</p>
              <div role="group" aria-label="Suggestion view" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={button}
                  aria-pressed={!previewSuggestion}
                  onClick={() => setPreviewSuggestion(false)}
                >
                  Review changes
                </button>
                <button
                  type="button"
                  className={button}
                  aria-pressed={previewSuggestion}
                  onClick={() => setPreviewSuggestion(true)}
                >
                  Preview suggestion
                </button>
              </div>
              {previewSuggestion ? (
                <WebsiteLivePreview
                  document={{
                    ...website,
                    pages: website.pages.map((p) => (p.id === page.id ? proposal.page : p)),
                  }}
                  pageId={page.id}
                />
              ) : (
                <div className="max-h-64 overflow-auto">
                  <WebsiteSuggestion before={JSON.parse(proposal.before)} after={proposal.page} />
                </div>
              )}
              {staleProposal && (
                <p role="alert" className="text-sm text-[var(--admin-danger)]">
                  This page changed after the suggestion. Prepare a fresh suggestion to preserve
                  your edits.
                </p>
              )}
              <p className="text-xs text-[var(--admin-muted)]">
                Applying changes updates your local draft. Preview and save when ready; nothing is
                published.
              </p>
              <button
                type="button"
                className={button}
                disabled={disabled || staleProposal}
                onClick={() => {
                  if (JSON.stringify(page) !== proposal.before) {
                    setProposal(null);
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
  const changes = websiteTextFields(after).filter((field) => old.get(field.key) !== field.value);
  if (!changes.length)
    return (
      <p className="text-sm text-[var(--admin-muted)]">
        The text is unchanged. Use Preview suggestion to inspect layout and appearance.
      </p>
    );
  return (
    <dl className="space-y-3 text-sm">
      {changes.map((field) => (
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

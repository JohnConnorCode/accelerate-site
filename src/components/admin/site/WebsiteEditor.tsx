"use client";

import { WebsiteCollections } from "./WebsiteCollections";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { WebsiteAssets } from "./WebsiteAssets";
import { WebsiteContentEditor } from "./WebsiteContentEditor";
import { WebsitePublishing } from "./WebsitePublishing";
import { WebsitePageTools } from "./WebsitePageTools";
import { WebsiteLivePreview } from "./WebsiteLivePreview";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { parseWebsiteDocument, type WebsiteDocument } from "@/lib/site-studio/website-document";
import { websiteReceiptSchema, type WebsiteCommand } from "@/lib/site-studio/website-commands";
import type { WebsiteState } from "@/lib/site-studio/website-store";
import {
  WebsiteFields,
  websiteButtonClass as button,
  websiteFieldClass as field,
} from "./WebsiteFields";

type Selection =
  "pages" | "identity" | "navigation" | "footer" | "theme" | "assets" | "collections";
export function WebsiteEditor() {
  const [state, setState] = useState<WebsiteState | null>(null);
  const [document, setDocumentRaw] = useState<WebsiteDocument | null>(null);
  const [past, setPast] = useState<WebsiteDocument[]>([]);
  const [future, setFuture] = useState<WebsiteDocument[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const setDocument = (next: WebsiteDocument) => {
    if (document) setPast((items) => [...items.slice(-19), document]);
    setFuture([]);
    setDocumentRaw(next);
  };
  const [saved, setSaved] = useState("");
  const [selection, setSelection] = useState<Selection>("pages");
  const [pageId, setPageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmReload, setConfirmReload] = useState(false);
  const [pending, setPending] = useState<WebsiteCommand | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const dirty = !!document && JSON.stringify(document) !== saved;
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/site/website", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Website unavailable");
      const next = parseWebsiteDocument(result.website.draft?.document ?? result.bundled);
      setState(result.website);
      setDocumentRaw(next);
      setPast([]);
      setFuture([]);
      setSaved(JSON.stringify(next));
      setPageId(next.pages[0]?.id ?? "");
      setPending(null);
      setNotice(
        result.website.draft
          ? "Saved draft loaded."
          : "Bundled website loaded. Save to create your first private revision.",
      );
      setConfirmReload(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Website unavailable");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = async (requested?: WebsiteCommand) => {
    if (!document || !state || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const validated = parseWebsiteDocument(document);
      // Network failures retain the exact request, including its key. Retrying
      // cannot duplicate a revision or silently apply a different payload.
      const command: WebsiteCommand = pending ??
        requested ?? {
          operation: "save",
          requestKey: crypto.randomUUID(),
          expectedVersion: state.version,
          document: validated,
        };
      setPending(command);
      const response = await fetch("/api/admin/site/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400 || response.status === 403 || response.status === 409)
          setPending(null);
        throw new Error(result.error ?? "Save could not be confirmed. Retry the same save.");
      }
      const receipt = websiteReceiptSchema.parse(result.receipt);
      if (receipt.requestKey !== command.requestKey || receipt.operation !== command.operation)
        throw new Error("Save receipt did not match. Retry the same save.");
      const applied = command.operation === "save" ? command.document : document;
      setState({
        version: receipt.version,
        publishedRevisionId: receipt.publishedRevisionId,
        draft: {
          id: receipt.draftRevisionId,
          createdAt: receipt.createdAt,
          checksum: "",
          document: applied,
        },
      });
      setDocumentRaw(applied);
      setSaved(JSON.stringify(applied));
      setPending(null);
      setNotice(
        command.operation === "save"
          ? `Private revision ${receipt.version} saved. The public website has not changed.`
          : command.operation === "unpublish"
            ? "Website unpublished. The saved draft is preserved."
            : `Website ${command.operation === "rollback" ? "rolled back" : "published"}. Revision ${receipt.version} confirmed.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Save could not be confirmed. Retry the same save.",
      );
    } finally {
      setBusy(false);
    }
  };
  const exportDraft = () => {
    if (!document) return;
    setToolsOpen(false);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
    );
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = "website-draft.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const locked = busy || !!pending;
  const selectedPage = document?.pages.find((page) => page.id === pageId) ?? document?.pages[0];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Website"
        subtitle="Create pages, shape them with AI or manual controls, and review before publishing."
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={button}
          disabled={busy || !!pending || !past.length}
          onClick={() => {
            if (!document) return;
            setFuture((items) => [document, ...items]);
            setDocumentRaw(past[past.length - 1]!);
            setPast((items) => items.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button
          className={button}
          disabled={busy || !!pending || !future.length}
          onClick={() => {
            if (!document) return;
            setPast((items) => [...items, document]);
            setDocumentRaw(future[0]!);
            setFuture((items) => items.slice(1));
          }}
        >
          Redo
        </button>
        <span className="hidden xl:contents">
          <button
            className={button}
            aria-expanded={previewOpen}
            onClick={() => setPreviewOpen((value) => !value)}
          >
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
        </span>
        <button
          className="admin-button admin-button--primary"
          disabled={busy || !document}
          onClick={() => void save()}
        >
          {busy ? "Working…" : pending ? `Retry same ${pending.operation}` : "Save draft"}
        </button>
        <button className={button} aria-haspopup="dialog" onClick={() => setToolsOpen(true)}>
          Website tools
        </button>
      </div>
      <AdminDialog
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        title="Website tools"
        className="rounded-2xl bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-2xl"
      >
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Website tools</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setToolsOpen(false);
                if (dirty || pending) setConfirmReload(true);
                else void load();
              }}
            >
              Reload saved draft
            </button>
            <button className={button} disabled={!document} onClick={exportDraft}>
              Export draft
            </button>
            <button
              className={button}
              disabled={locked || !document}
              onClick={() => importInput.current?.click()}
            >
              Import draft
            </button>

            {state?.draft && (
              <Link
                className={button}
                href={`/admin/site/website/preview?page=${encodeURIComponent(pageId)}`}
                aria-disabled={dirty || busy}
                onClick={(event) => {
                  setToolsOpen(false);
                  if (dirty || busy) {
                    event.preventDefault();
                    setNotice("Save your changes before opening the saved preview.");
                  }
                }}
              >
                Open saved preview
              </Link>
            )}
          </div>
          <button className={button} onClick={() => setToolsOpen(false)}>
            Back to editor
          </button>
        </div>
      </AdminDialog>
      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import website snapshot"
        onChange={async (event) => {
          setToolsOpen(false);
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (file.size > 8_000_000) throw new Error("The website file exceeds 8 MB.");
            const next = parseWebsiteDocument(JSON.parse(await file.text()));
            setDocument(next);
            setPageId(next.pages[0]?.id ?? "");
            setError("");
            setNotice(
              "Imported into local edits. Save creates a private revision; import never publishes.",
            );
          } catch {
            setError(
              "Import rejected. Use a valid website snapshot under 8 MB; your edits have been preserved.",
            );
          }
        }}
      />
      {state && document && (
        <WebsitePublishing
          state={state}
          document={document}
          disabled={dirty || busy || !!pending}
          onCommand={(command) => void save(command)}
        />
      )}
      <p role="status" aria-live="polite" className="text-sm text-[var(--admin-muted)]">
        {dirty ? "Unsaved changes. " : ""}
        {notice}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)] p-3 text-[var(--admin-danger)]"
        >
          {error}
        </p>
      )}
      {confirmReload && (
        <AdminSurface>
          <p>
            Reloading replaces your local edits with the saved draft. Export first if you want to
            keep a copy.
          </p>
          <div className="mt-3 flex gap-2">
            <button className={button} onClick={() => void load()}>
              Replace local edits
            </button>
            <button className={button} onClick={() => setConfirmReload(false)}>
              Keep editing
            </button>
          </div>
        </AdminSurface>
      )}
      {document && (
        <div className="space-y-4">
          <div className="flex gap-2 xl:hidden" aria-label="Editor view">
            <button
              className={button}
              aria-pressed={!mobilePreview}
              onClick={() => setMobilePreview(false)}
            >
              Edit content
            </button>
            <button
              className={button}
              aria-pressed={mobilePreview}
              onClick={() => {
                setMobilePreview(true);
                setPreviewOpen(true);
              }}
            >
              Preview page
            </button>
          </div>
          <label className={`${mobilePreview ? "hidden" : "block"} text-sm xl:hidden`}>
            Editing
            <select
              aria-label="Editing"
              className={field}
              value={selection}
              onChange={(event) => setSelection(event.target.value as Selection)}
            >
              {(
                [
                  "pages",
                  "identity",
                  "navigation",
                  "footer",
                  "theme",
                  "assets",
                  "collections",
                ] as Selection[]
              ).map((item) => (
                <option key={item} value={item}>
                  {item[0]?.toUpperCase()}
                  {item.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <nav
            aria-label="Website content"
            className="hidden flex-wrap content-start gap-2 xl:flex"
          >
            {(
              [
                "pages",
                "identity",
                "navigation",
                "footer",
                "theme",
                "assets",
                "collections",
              ] as Selection[]
            ).map((item) => (
              <button
                key={item}
                className={button}
                aria-pressed={selection === item}
                onClick={() => setSelection(item)}
              >
                {item[0]?.toUpperCase()}
                {item.slice(1)}
              </button>
            ))}
          </nav>
          <div
            className={
              previewOpen
                ? "grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]"
                : "max-w-3xl"
            }
          >
            <AdminSurface className={mobilePreview ? "hidden xl:block" : ""}>
              <fieldset disabled={locked} className="min-w-0 space-y-5">
                {selection === "pages" && selectedPage ? (
                  <>
                    <label className="block text-sm">
                      Page
                      <select
                        className={field}
                        value={selectedPage.id}
                        onChange={(event) => setPageId(event.target.value)}
                      >
                        {document.pages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.metadata.title} — {page.path}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      Page URL
                      <input
                        className={field}
                        value={selectedPage.path}
                        onChange={(event) =>
                          setDocument({
                            ...document,
                            pages: document.pages.map((page) =>
                              page.id === selectedPage.id
                                ? { ...page, path: event.target.value }
                                : page,
                            ),
                          })
                        }
                      />
                    </label>
                    <WebsitePageTools
                      website={document}
                      page={selectedPage}
                      disabled={locked}
                      onChange={(next, id) => {
                        setDocument(next);
                        if (id) setPageId(id);
                      }}
                    />
                    <WebsiteFields
                      label="Search and sharing"
                      value={selectedPage.metadata}
                      onChange={(metadata) =>
                        setDocument({
                          ...document,
                          pages: document.pages.map((page) =>
                            page.id === selectedPage.id
                              ? { ...page, metadata: metadata as typeof page.metadata }
                              : page,
                          ),
                        })
                      }
                    />
                    <WebsiteContentEditor
                      page={selectedPage}
                      onChange={(content) =>
                        setDocument({
                          ...document,
                          pages: document.pages.map((page) =>
                            page.id === selectedPage.id ? { ...page, content } : page,
                          ),
                        })
                      }
                    />
                  </>
                ) : (
                  selection !== "pages" &&
                  (selection === "navigation" ? (
                    <div className="space-y-5">
                      <WebsiteFields
                        label="navigation"
                        value={document.navigation}
                        onChange={(value) =>
                          setDocument({
                            ...document,
                            navigation: value as WebsiteDocument["navigation"],
                          })
                        }
                      />
                      <WebsiteFields
                        label="Header action"
                        value={document.header}
                        onChange={(value) =>
                          setDocument({ ...document, header: value as WebsiteDocument["header"] })
                        }
                      />
                      <WebsiteFields
                        label="Contact dock"
                        value={document.dock}
                        onChange={(value) =>
                          setDocument({ ...document, dock: value as WebsiteDocument["dock"] })
                        }
                      />
                    </div>
                  ) : selection === "collections" ? (
                    <WebsiteCollections
                      website={document}
                      onChange={setDocument}
                      onPreview={setPageId}
                    />
                  ) : selection === "assets" ? (
                    <WebsiteAssets website={document} pageId={pageId} onChange={setDocument} />
                  ) : (
                    <WebsiteFields
                      label={selection}
                      value={document[selection]}
                      onChange={(value) => setDocument({ ...document, [selection]: value })}
                    />
                  ))
                )}
              </fieldset>
            </AdminSurface>
            {previewOpen && (
              <div className={mobilePreview ? "min-w-0" : "hidden min-w-0 xl:block"}>
                <WebsiteLivePreview document={document} pageId={pageId} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

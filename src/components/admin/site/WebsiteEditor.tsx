"use client";

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
  const [document, setDocument] = useState<WebsiteDocument | null>(null);
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
      setDocument(next);
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

  const save = async () => {
    if (!document || !state || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const validated = parseWebsiteDocument(document);
      // Network failures retain the exact request, including its key. Retrying
      // cannot duplicate a revision or silently apply a different payload.
      const command: WebsiteCommand = pending ?? {
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
      if (
        command.operation !== "save" ||
        receipt.requestKey !== command.requestKey ||
        receipt.operation !== "save"
      )
        throw new Error("Save receipt did not match. Retry the same save.");
      const applied = command.document;
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
      setDocument(applied);
      setSaved(JSON.stringify(applied));
      setPending(null);
      setNotice(`Private revision ${receipt.version} saved. The public website has not changed.`);
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
        title="Installation website"
        subtitle="Edit and preview a private website draft. Publishing is still being built."
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className={button} disabled={busy || !document} onClick={() => void save()}>
          {busy ? "Working…" : pending ? "Retry same save" : "Save draft"}
        </button>
        <button
          className={button}
          disabled={busy}
          onClick={() => (dirty || pending ? setConfirmReload(true) : void load())}
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
        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import website snapshot"
          onChange={async (event) => {
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
        {state?.draft && (
          <Link
            className={button}
            href={`/admin/site/website/preview?page=${encodeURIComponent(pageId)}`}
            aria-disabled={dirty || busy}
            onClick={(event) => {
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
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="Website content"
            className="flex flex-wrap content-start gap-2 lg:flex-col"
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
          <AdminSurface>
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
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      const id = `page-${crypto.randomUUID().slice(0, 8)}`;
                      setDocument({
                        ...document,
                        pages: [
                          ...document.pages,
                          {
                            id,
                            path: `/${id}`,
                            metadata: { title: "New page", description: "", noIndex: false },
                            content: {
                              kind: "article",
                              body: [
                                { type: "paragraph", content: [{ text: "Write your page here." }] },
                              ],
                            },
                          },
                        ],
                      });
                      setPageId(id);
                    }}
                  >
                    Add page
                  </button>
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
                  {selectedPage.content.kind === "native" ? (
                    selectedPage.content.sections.map((section, index) => (
                      <details
                        key={section.id}
                        className="rounded-lg border border-[var(--admin-border)] p-3"
                      >
                        <summary className="min-h-11 cursor-pointer py-2 font-medium">
                          {index + 1}. {section.template.replace(/^home-/, "").replace(/-/g, " ")}
                          {section.hidden ? " (hidden)" : ""}
                        </summary>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <button
                            className={button}
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              setDocument({
                                ...document,
                                pages: document.pages.map((page) => {
                                  if (page.id !== selectedPage.id || page.content.kind !== "native")
                                    return page;
                                  const sections = [...page.content.sections];
                                  [sections[index - 1], sections[index]] = [
                                    sections[index]!,
                                    sections[index - 1]!,
                                  ];
                                  return { ...page, content: { ...page.content, sections } };
                                }),
                              })
                            }
                          >
                            Move section up
                          </button>
                          <label className="flex min-h-11 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={section.hidden}
                              onChange={(event) =>
                                setDocument({
                                  ...document,
                                  pages: document.pages.map((page) =>
                                    page.id === selectedPage.id && page.content.kind === "native"
                                      ? {
                                          ...page,
                                          content: {
                                            ...page.content,
                                            sections: page.content.sections.map((item) =>
                                              item.id === section.id
                                                ? { ...item, hidden: event.target.checked }
                                                : item,
                                            ),
                                          },
                                        }
                                      : page,
                                  ),
                                })
                              }
                            />
                            Hide section
                          </label>
                        </div>
                        <WebsiteFields
                          label="Content"
                          value={section.fields}
                          onChange={(fields) =>
                            setDocument({
                              ...document,
                              pages: document.pages.map((page) =>
                                page.id === selectedPage.id && page.content.kind === "native"
                                  ? {
                                      ...page,
                                      content: {
                                        ...page.content,
                                        sections: page.content.sections.map((old) =>
                                          old.id === section.id
                                            ? { ...old, fields: fields as Record<string, unknown> }
                                            : old,
                                        ),
                                      },
                                    }
                                  : page,
                              ),
                            })
                          }
                        />
                      </details>
                    ))
                  ) : (
                    <WebsiteFields
                      label="Page content"
                      value={selectedPage.content}
                      onChange={(content) =>
                        setDocument({
                          ...document,
                          pages: document.pages.map((page) =>
                            page.id === selectedPage.id
                              ? { ...page, content: content as typeof page.content }
                              : page,
                          ),
                        })
                      }
                    />
                  )}
                </>
              ) : (
                selection !== "pages" && (
                  <WebsiteFields
                    label={selection}
                    value={document[selection]}
                    onChange={(value) => setDocument({ ...document, [selection]: value })}
                  />
                )
              )}
            </fieldset>
          </AdminSurface>
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminSurface } from "./AdminSurface";
import { Button } from "@/components/ui/Button";
interface DocumentRow {
  id: string;
  title: string;
  status: "pending" | "indexed" | "failed" | "archived";
  extraction_error: string | null;
}
export function KnowledgeSources() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/knowledge/documents");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDocuments(data.documents);
      setError(null);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sources could not be loaded");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const mutate = async (id: string, operation: "retry" | "archive") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/knowledge/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, operation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(
        operation === "archive"
          ? "Source archived. It will no longer appear in new searches."
          : "Indexing queued. Refresh after the next work-engine run.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Source change failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminSurface padding="lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-balance text-lg font-semibold">Business references</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--admin-muted)]">
            Add policies, service descriptions or client reference material. Documents provide cited
            evidence; reusable instructions belong in the Learning Inbox.
          </p>
        </div>
        <Button variant="ghost" onClick={load} disabled={busy}>
          Refresh sources
        </Button>
      </div>
      <form
        className="mt-5 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const body = new FormData(form);
          setBusy(true);
          setError(null);
          setNotice(null);
          try {
            const response = await fetch("/api/admin/knowledge/documents", {
              method: "POST",
              body,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            form.reset();
            setNotice(
              data.alreadyIndexed
                ? "This document is already searchable."
                : "Document saved privately. Indexing is queued; refresh after the next work-engine run.",
            );
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm font-medium" htmlFor="knowledge-file">
          Reference document
        </label>
        <input
          id="knowledge-file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,.md"
          required
          disabled={busy}
          className="block max-w-full text-sm"
          aria-describedby="knowledge-file-help"
        />
        <p id="knowledge-file-help" className="text-sm text-[var(--admin-muted)]">
          PDF, DOCX, text or Markdown, up to 4 MB. PDFs support up to 100 pages. Scanned PDFs need
          OCR first.
        </p>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="visibility" value="workspace" required disabled={busy} />
          Make this reference available to this workspace’s members and agents.
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add reference"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
      {loaded && !documents.length && (
        <p className="mt-5 text-sm text-[var(--admin-muted)]">
          No uploaded references yet. Connected Drive documents are searched from your selected
          folders.
        </p>
      )}
      {!!documents.length && (
        <ul className="mt-5 divide-y divide-[var(--admin-border)]">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium">{document.title}</p>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {document.status === "indexed"
                    ? "Searchable"
                    : document.status === "pending"
                      ? "Waiting for indexing"
                      : document.status === "failed"
                        ? "Indexing needs attention"
                        : "Archived"}
                </p>
                {document.extraction_error && document.status === "failed" && (
                  <p className="mt-1 text-sm">{document.extraction_error}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {["pending", "failed"].includes(document.status) && (
                  <Button disabled={busy} onClick={() => mutate(document.id, "retry")}>
                    Retry indexing
                  </Button>
                )}
                {document.status !== "archived" && (
                  <Button
                    disabled={busy}
                    variant="ghost"
                    onClick={() => mutate(document.id, "archive")}
                  >
                    Archive
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminSurface>
  );
}

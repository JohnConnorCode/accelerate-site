"use client";
import { use, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { SitePageRenderer } from "@/lib/site-studio/renderer";
import {
  collectAssetIds,
  isSiteDocument,
  siteDraftSchema,
  type SiteDraft,
} from "@/lib/site-studio/document";
import { resolveSiteAsset } from "@/lib/site-studio/assets";

const WIDTHS = [
  { label: "Desktop", px: "100%" },
  { label: "Tablet", px: "768px" },
  { label: "Mobile", px: "390px" },
] as const;

export default function AdminSiteDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pathname = usePathname();
  return <SiteDraftEditor key={`${pathname}:${id}`} id={id} />;
}

function SiteDraftEditor({ id }: { id: string }) {
  const router = useAdminNavigation();
  const [draft, setDraft] = useState<SiteDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]!);
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(true);
  const writing = useRef(false);
  const busy = loading || renaming || discarding;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setNotice("");
    setConfirmingDiscard(false);
    void fetch(`/api/admin/site/drafts/${id}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 404) {
          setDraft(null);
          setMissing(true);
          return;
        }
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (!res.ok) throw new Error("Draft unavailable");
        const next = siteDraftSchema.parse(data.draft);
        if (next.id !== id || !/^[a-f0-9]{64}$/.test(next.checksum))
          throw new Error("Draft identity mismatch");
        setDraft(next);
        setMissing(false);
        setNeedsRefresh(false);
        setRenameError(null);
        setDiscardError(null);
        setTitleInput((current) => (current?.trim() === next.title ? null : current));
        if (refresh > 0) setNotice("Latest draft loaded. Review before saving or discarding.");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNeedsRefresh(true);
          setLoadError("Could not load the private draft. Retry to check the latest copy.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, refresh]);

  const reload = () => {
    if (writing.current) return;
    setRefresh((value) => value + 1);
  };

  const discard = async () => {
    if (!draft || busy || needsRefresh || writing.current) return;
    if (!confirmingDiscard) {
      setConfirmingDiscard(true);
      setDiscardError(null);
      return;
    }
    writing.current = true;
    setDiscarding(true);
    setNotice("");
    try {
      const res = await fetch(`/api/admin/site/drafts/${id}`, {
        method: "DELETE",
        headers: { "If-Match": draft.checksum },
      });
      const data = await res.json();
      if (!active.current) return;
      if (!res.ok || data.discarded?.id !== draft.id) {
        setDiscardError(
          "Could not confirm discard. Load the latest draft and review it before retrying.",
        );
        setNeedsRefresh(true);
        setConfirmingDiscard(false);
        return;
      }
      router.push("/admin/site");
    } catch {
      if (active.current) {
        setDiscardError(
          "Could not confirm discard. Load the latest draft and review it before retrying.",
        );
        setNeedsRefresh(true);
        setConfirmingDiscard(false);
      }
    } finally {
      writing.current = false;
      if (active.current) setDiscarding(false);
    }
  };

  const rename = async () => {
    const title = (titleInput ?? draft?.title ?? "").trim();
    if (!draft || !title || title === draft.title || busy || needsRefresh || writing.current)
      return;
    writing.current = true;
    setRenaming(true);
    setRenameError(null);
    setConfirmingDiscard(false);
    setNotice("");
    try {
      const res = await fetch(`/api/admin/site/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patches: [{ op: "updateMetadata", title }],
          expectedChecksum: draft.checksum,
        }),
      });
      const data = await res.json();
      if (!active.current) return;
      if (res.status === 409) {
        setNeedsRefresh(true);
        setRenameError(
          "This draft changed elsewhere. Load the latest draft, review it, then save your title again.",
        );
        return;
      }
      if (!res.ok) throw new Error("Title save unavailable");
      const saved = siteDraftSchema.parse(data.draft);
      if (saved.id !== id || saved.title !== title || !/^[a-f0-9]{64}$/.test(saved.checksum))
        throw new Error("Title receipt mismatch");
      setDraft(saved);
      setTitleInput(null);
      setNotice("Title saved.");
    } catch {
      if (active.current) {
        setNeedsRefresh(true);
        setRenameError(
          "Could not confirm the title save. Your text is retained. Load the latest draft before retrying.",
        );
      }
    } finally {
      writing.current = false;
      if (active.current) setRenaming(false);
    }
  };

  if (missing) {
    return (
      <div className="space-y-7 pb-10">
        <PageHeader
          title="Draft not found"
          subtitle="This private draft was removed or is unavailable in this workspace."
        />
        {titleInput && (
          <label className="block text-sm">
            Unsaved title
            <textarea className="admin-field mt-1" readOnly value={titleInput} />
          </label>
        )}
        <Link
          href="/admin/site"
          className="text-sm font-semibold text-[var(--admin-ink)] hover:underline"
        >
          Back to Site Studio
        </Link>
      </div>
    );
  }
  if (!draft && loadError)
    return (
      <AdminSurface>
        <p role="alert">{loadError}</p>
        <button
          type="button"
          className="admin-button admin-button--secondary mt-3"
          onClick={reload}
          disabled={loading}
        >
          Retry
        </button>
      </AdminSurface>
    );
  if (!draft) return <LoadingSkeleton />;
  const raw = draft.document;
  const document = isSiteDocument(raw) ? raw : null;
  const attached = document ? collectAssetIds(document) : [];

  return (
    <div className="space-y-7 pb-10">
      <PageHeader
        title={draft.title}
        subtitle={`/${draft.slug} · Private ${draft.source === "ai" ? "AI-assisted" : "template"} draft · Updated ${draft.updatedAt.slice(0, 10)}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="admin-button admin-button--secondary"
          disabled={busy}
          onClick={reload}
        >
          {loading ? "Checking latest draft…" : "Load latest draft"}
        </button>
        {notice && (
          <p role="status" className="text-sm text-[var(--admin-muted)]">
            {notice}
          </p>
        )}
      </div>
      {loadError && (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {loadError} Your title text is retained.
        </p>
      )}
      <div className="flex items-center gap-2" role="group" aria-label="Preview width">
        {WIDTHS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWidth(option)}
            aria-pressed={width.label === option.label}
            className="admin-button admin-button--secondary"
          >
            {option.label}
          </button>
        ))}
        <Link
          href="/admin/site"
          className="ml-auto text-sm font-semibold text-[var(--admin-ink)] hover:underline"
        >
          All drafts
        </Link>
      </div>
      {!document ? (
        <p role="alert" className="admin-copy text-sm text-[var(--admin-danger)]">
          This draft failed validation and cannot render.
        </p>
      ) : (
        <AdminSurface
          padding="none"
          className="overflow-hidden"
          style={{
            maxWidth: width.px,
            margin: width.px === "100%" ? "0" : "0 auto",
          }}
        >
          <SitePageRenderer document={document} />
        </AdminSurface>
      )}
      <section aria-label="Rename draft">
        <h2 className="admin-section-title">Rename draft</h2>
        <AdminSurface padding="sm">
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <input
              value={titleInput ?? draft.title}
              onChange={(event) => setTitleInput(event.target.value)}
              aria-label="Draft title"
              maxLength={120}
              disabled={busy}
              className="admin-field admin-field--inline min-w-0 flex-1 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
            />
            <button
              type="button"
              onClick={() => void rename()}
              disabled={
                busy ||
                needsRefresh ||
                !(titleInput ?? draft.title).trim() ||
                (titleInput ?? draft.title).trim() === draft.title
              }
              className="admin-button admin-button--primary shrink-0"
            >
              {renaming ? "Saving" : "Save title"}
            </button>
          </div>
          {renameError ? (
            <p role="alert" className="admin-copy mt-2 text-sm text-[var(--admin-danger)]">
              {renameError}
            </p>
          ) : null}
        </AdminSurface>
      </section>
      <section aria-label="Attached images">
        <h2 className="admin-section-title">Attached images</h2>
        {attached.length === 0 ? (
          <p className="admin-copy text-sm">No catalog images attached.</p>
        ) : (
          <AdminSurface padding="sm">
            <ul className="admin-copy grid gap-1.5 text-sm">
              {attached.map((assetId) => {
                const asset = resolveSiteAsset(assetId);
                return (
                  <li key={assetId}>
                    {assetId} - {asset ? asset.alt : "unresolved reference"}
                  </li>
                );
              })}
            </ul>
          </AdminSurface>
        )}
      </section>
      <section aria-label="Discard draft">
        <h2 className="admin-section-title">Discard draft</h2>
        <AdminSurface padding="sm">
          <p className="admin-copy max-w-2xl text-sm">
            Discard removes this private working copy. Published pages stay available.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void discard()}
              disabled={busy || needsRefresh}
              className="admin-button admin-button--danger"
            >
              {discarding
                ? "Discarding"
                : confirmingDiscard
                  ? `Click again to discard ${draft.title}`
                  : "Discard draft"}
            </button>
            {confirmingDiscard && (
              <button
                type="button"
                className="admin-button admin-button--secondary"
                disabled={busy}
                onClick={() => setConfirmingDiscard(false)}
              >
                Keep draft
              </button>
            )}
          </div>
          {discardError ? (
            <p role="alert" className="admin-copy mt-2 text-sm text-[var(--admin-danger)]">
              {discardError}
            </p>
          ) : null}
        </AdminSurface>
      </section>
    </div>
  );
}

"use client";
import { Button } from "@/components/ui/Button";

import { use, useEffect, useState } from "react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { SitePageRenderer } from "@/lib/site-studio/renderer";
import { collectAssetIds, isSiteDocument } from "@/lib/site-studio/document";
import { resolveSiteAsset } from "@/lib/site-studio/assets";

interface DraftDetail {
  id: string;
  slug: string;
  title: string;
  source: "template" | "ai";
  brief?: string;
  updatedAt: string;
  checksum: string;
  document: unknown;
}

const WIDTHS = [
  { label: "Desktop", px: "100%" },
  { label: "Tablet", px: "768px" },
  { label: "Mobile", px: "390px" },
] as const;

export default function AdminSiteDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useAdminNavigation();
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]!);
  const [titleInput, setTitleInput] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/site/drafts/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        const data = await res.json();
        if (!res.ok || !data.draft) throw new Error(data.error ?? "Draft unavailable");
        setDraft(data.draft);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Draft unavailable"));
  }, [id]);

  const reload = async () => {
    const res = await fetch(`/api/admin/site/drafts/${id}`);
    if (res.status === 404) {
      setMissing(true);
      return;
    }
    const data = await res.json();
    setDraft(data.draft ?? null);
  };

  const discard = async () => {
    if (!draft || discarding) return;
    if (!confirmingDiscard) {
      setConfirmingDiscard(true);
      setDiscardError(null);
      return;
    }
    setDiscarding(true);
    try {
      const res = await fetch(`/api/admin/site/drafts/${id}`, {
        method: "DELETE",
        headers: { "If-Match": draft.checksum },
      });
      const data = await res.json();
      if (!res.ok) {
        setDiscardError(data.error ?? "Discard failed");
        setConfirmingDiscard(false);
        return;
      }
      router.push("/admin/site");
    } catch {
      setDiscardError("Discard failed");
      setConfirmingDiscard(false);
    } finally {
      setDiscarding(false);
    }
  };

  const rename = async () => {
    if (!draft || !titleInput?.trim() || renaming) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/admin/site/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patches: [{ op: "updateMetadata", title: titleInput.trim() }],
          expectedChecksum: draft.checksum,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        await reload();
        setRenameError(`${data.error ?? "Draft changed elsewhere."} Reloaded the latest copy.`);
        return;
      }
      if (!res.ok) {
        setRenameError(data.error ?? "Rename failed");
        return;
      }
      setDraft(data.draft);
    } catch {
      setRenameError("Rename failed");
    } finally {
      setRenaming(false);
    }
  };

  if (missing) {
    return (
      <div className="space-y-7 pb-10">
        <PageHeader title="Draft not found" subtitle="This draft id does not exist." />
        <Link
          href="/admin/site"
          className="text-sm font-semibold text-[var(--admin-ink)] hover:underline"
        >
          Back to Site Studio
        </Link>
      </div>
    );
  }
  if (loadError)
    return (
      <AdminSurface>
        <p role="alert">{loadError}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
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
        subtitle={`/${draft.slug} - ${draft.source} draft - checksum ${draft.checksum.slice(0, 12)} - updated ${draft.updatedAt.slice(0, 10)}`}
      />
      <div className="flex items-center gap-2" role="group" aria-label="Preview width">
        {WIDTHS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWidth(option)}
            aria-pressed={width.label === option.label}
            className="min-h-11 rounded-[var(--admin-control-radius)] px-3 text-sm font-medium text-[var(--admin-muted)] aria-pressed:bg-[var(--admin-ink)] aria-pressed:text-[var(--admin-surface)] hover:bg-[var(--admin-surface-subtle)]"
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
              className="admin-field admin-field--inline min-w-0 flex-1 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]"
            />
            <button
              type="button"
              onClick={() => void rename()}
              disabled={renaming || !(titleInput ?? draft.title).trim()}
              className="min-h-11 shrink-0 rounded-[var(--admin-control-radius)] bg-[var(--admin-ink)] px-4 text-sm font-semibold text-[var(--admin-surface)] disabled:opacity-50"
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
            Discard removes this private working copy. Published output is untouched because drafts
            never publish in this release.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void discard()}
              disabled={discarding}
              className="min-h-11 rounded-[var(--admin-control-radius)] px-4 text-sm font-semibold text-[var(--admin-danger)] hover:bg-[var(--admin-danger-soft)] disabled:opacity-50"
            >
              {discarding
                ? "Discarding"
                : confirmingDiscard
                  ? `Click again to discard ${draft.title}`
                  : "Discard draft"}
            </button>
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

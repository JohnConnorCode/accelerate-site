"use client";

import { WebsiteModelPicker } from "@/components/admin/site/WebsiteModelPicker";
import { DEFAULT_SITE_MODEL, siteModel, modelPriceCeiling } from "@/lib/site-studio/models";
import { useCallback, useEffect, useState } from "react";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { Button } from "@/components/ui/Button";
import { SITE_ASSET_CATALOG } from "@/lib/site-studio/assets";

interface DraftSummary {
  id: string;
  slug: string;
  title: string;
  source: "template" | "ai";
  updatedAt: string;
  checksum: string;
}

const fieldClass =
  "mt-1 block w-full rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] px-3.5 py-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[var(--admin-ink)]";

export default function AdminSiteStudioPage() {
  const router = useAdminNavigation();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceName, setServiceName] = useState("");
  const [audience, setAudience] = useState("");
  const [outcome, setOutcome] = useState("");
  const [extra, setExtra] = useState("");
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<"template" | "ai">("template");
  const [model, setModel] = useState(() => siteModel(DEFAULT_SITE_MODEL));
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/site/drafts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drafts unavailable");
      setDrafts(data.drafts ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Drafts unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const toggleAsset = (id: string) => {
    setAssetIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 8),
    );
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: {
            serviceName,
            audience,
            outcome,
            ...(extra.trim() ? { extra: extra.trim() } : {}),
          },
          mode,
          model: model.id,
          priceCeiling: modelPriceCeiling(model),
          assetIds,
          ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Draft creation failed");
        return;
      }
      router.push(`/admin/site/${data.draft.id}`);
    } catch {
      setError("Draft creation failed");
    } finally {
      setCreating(false);
    }
  };

  const valid = serviceName.trim() && audience.trim() && outcome.trim();

  return (
    <div className="space-y-7 pb-10">
      <PageHeader
        title="Site Studio"
        subtitle="Create AI-assisted page drafts from approved components and photography. Drafts are private and are not published from this workspace."
      />
      <AdminSurface>
        <h2 className="admin-section-title">Installation website</h2>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          The installation owner can create pages, edit with AI, preview every screen size, and
          publish a saved website revision.
        </p>
        <Link
          href="/admin/site/website"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--admin-ink)] underline underline-offset-4"
        >
          Edit installation website
        </Link>
      </AdminSurface>
      <section aria-label="Create a page draft">
        <h2 className="admin-section-title">New page draft</h2>
        <AdminSurface>
          <div className="grid max-w-2xl gap-4">
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Service name
              <input
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                placeholder="Bookkeeping automation"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Audience
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Home service owners"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Outcome
              <input
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                placeholder="The office runs while the crew builds"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Page address (optional)
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="bookkeeping-automation"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Additional direction (optional)
              <input
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder="Emphasize evening admin relief; keep three sections"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm font-medium text-[var(--admin-ink)]">
              Creation mode
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as "template" | "ai")}
                className={fieldClass}
              >
                <option value="template">Built-in service template</option>
                <option value="ai">AI generated (needs OpenRouter)</option>
              </select>
            </label>
            {mode === "ai" && (
              <WebsiteModelPicker value={model} onChange={setModel} disabled={creating} />
            )}
            <fieldset>
              <legend className="text-sm font-medium text-[var(--admin-ink)]">
                Choose photography (optional)
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SITE_ASSET_CATALOG.map((asset) => (
                  <label
                    key={asset.id}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] px-2.5 py-1.5 text-xs text-[var(--admin-muted)] has-checked:border-[var(--admin-ink)] has-checked:text-[var(--admin-ink)]"
                  >
                    <input
                      type="checkbox"
                      checked={assetIds.includes(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                    />
                    {asset.alt}
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? (
              <p role="alert" className="admin-copy text-sm text-[var(--admin-danger)]">
                {error}
              </p>
            ) : null}
            <div>
              <Button onClick={create} disabled={!valid || creating}>
                {creating ? "Creating draft" : "Create draft"}
              </Button>
            </div>
          </div>
        </AdminSurface>
      </section>
      <section aria-label="Page drafts">
        <h2 className="admin-section-title">Drafts</h2>
        {loading ? (
          <LoadingSkeleton />
        ) : listError ? (
          <AdminSurface>
            <p role="alert">{listError}</p>
            <Button onClick={fetchDrafts}>Retry</Button>
          </AdminSurface>
        ) : drafts.length === 0 ? (
          <p className="admin-copy text-sm">No drafts yet. Create the first one above.</p>
        ) : (
          <ul className="grid list-none gap-3 p-0">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <AdminSurface padding="sm">
                  <Link
                    href={`/admin/site/${draft.id}`}
                    className="text-sm font-semibold text-[var(--admin-ink)] hover:underline"
                  >
                    {draft.title}
                  </Link>
                  <p className="admin-copy mt-0.5 text-xs">
                    /{draft.slug} - {draft.source} - updated {draft.updatedAt.slice(0, 10)}
                  </p>
                </AdminSurface>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

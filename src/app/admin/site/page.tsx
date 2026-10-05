"use client";

import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { WebsiteModelPicker } from "@/components/admin/site/WebsiteModelPicker";
import { DEFAULT_SITE_MODEL, siteModel, modelPriceCeiling } from "@/lib/site-studio/models";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link, { useAdminNavigation } from "@/components/admin/AdminLink";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { AdminSurface } from "@/components/admin/AdminSurface";
import { siteDraftSchema } from "@/lib/site-studio/document";
import { SITE_ASSET_CATALOG } from "@/lib/site-studio/assets";

interface DraftSummary {
  id: string;
  slug: string;
  title: string;
  source: "template" | "ai";
  updatedAt: string;
  checksum: string;
}

const fieldClass = "admin-field mt-1 block w-full";
const summarySchema = siteDraftSchema.pick({
  id: true,
  slug: true,
  title: true,
  source: true,
  updatedAt: true,
  checksum: true,
});

export default function AdminSiteStudioPage() {
  const pathname = usePathname();
  return <SiteStudioEditor key={pathname} />;
}

function SiteStudioEditor() {
  const router = useAdminNavigation();
  const demo = useAdminDemo();
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
  const [creationNeedsRefresh, setCreationNeedsRefresh] = useState(false);
  const active = useRef(true);
  const creatingRequest = useRef(false);
  const listRequest = useRef<AbortController | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (creatingRequest.current) return;
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/site/drafts", {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json();
      if (controller.signal.aborted || !active.current) return;
      if (!res.ok) throw new Error("Drafts unavailable");
      setDrafts(summarySchema.array().max(200).parse(data.drafts));
      setCreationNeedsRefresh(false);
      setError((current) =>
        current?.startsWith("Could not confirm draft creation.") ? null : current,
      );
    } catch {
      if (!controller.signal.aborted && active.current)
        setListError("Could not load private drafts. Refresh drafts to try again.");
    } finally {
      if (!controller.signal.aborted && active.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    void fetchDrafts();
    return () => {
      active.current = false;
      listRequest.current?.abort();
    };
  }, [fetchDrafts]);

  const toggleAsset = (id: string) => {
    setAssetIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 8),
    );
  };

  const create = async () => {
    if (creatingRequest.current || creationNeedsRefresh || loading) return;
    creatingRequest.current = true;
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
      if (!active.current) return;
      if (!res.ok) {
        if (res.status >= 500) setCreationNeedsRefresh(true);
        setError(
          res.status >= 500
            ? "Could not confirm draft creation. Refresh drafts to check for a saved copy before retrying."
            : typeof data.error === "string"
              ? data.error
              : "Draft creation is unavailable. Review your fields before retrying.",
        );
        return;
      }
      const saved = siteDraftSchema.parse(data.draft);
      if (!/^[a-f0-9]{64}$/.test(saved.checksum)) throw new Error("Draft receipt mismatch");
      router.push(`/admin/site/${saved.id}`);
    } catch {
      if (active.current) {
        setCreationNeedsRefresh(true);
        setError(
          "Could not confirm draft creation. Refresh drafts to check for a saved copy before retrying.",
        );
      }
    } finally {
      creatingRequest.current = false;
      if (active.current) setCreating(false);
    }
  };

  const valid = serviceName.trim() && audience.trim() && outcome.trim();

  return (
    <div className="space-y-7 pb-10">
      <PageHeader
        title="Site Studio"
        subtitle="Create private service-page drafts using a template or AI. Publish installation pages in the website editor."
      />
      {demo !== null && (
        <p className="text-sm text-[var(--admin-muted)]">
          Draft changes are simulated and stay in this business’s browser session. AI example mode
          uses the service template without calling a model. Resetting this demo clears its drafts.
        </p>
      )}
      <AdminSurface>
        <h2 className="admin-section-title">Installation website</h2>
        <Link href="/admin/site/connect" className="admin-button admin-button--secondary mt-3">
          Connect ChatGPT
        </Link>
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
          <form
            aria-busy={creating}
            onSubmit={(event) => {
              event.preventDefault();
              if (valid && !loading) void create();
            }}
          >
            <fieldset className="grid max-w-2xl gap-4" disabled={creating}>
              <label className="block text-sm font-medium text-[var(--admin-ink)]">
                Service name
                <input
                  maxLength={120}
                  required
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                  placeholder="Bookkeeping automation"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--admin-ink)]">
                Audience
                <input
                  maxLength={160}
                  required
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="Home service owners"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--admin-ink)]">
                Outcome
                <input
                  maxLength={500}
                  required
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  placeholder="The office runs while the crew builds"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--admin-ink)]">
                Page address (optional)
                <input
                  maxLength={120}
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="bookkeeping-automation"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm font-medium text-[var(--admin-ink)]">
                Additional direction (optional)
                <input
                  maxLength={1000}
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
                  <option value="ai">
                    {demo !== null ? "AI example (simulated)" : "AI generated (needs OpenRouter)"}
                  </option>
                </select>
              </label>
              {mode === "ai" && demo === null && (
                <WebsiteModelPicker value={model} onChange={setModel} disabled={creating} />
              )}
              {SITE_ASSET_CATALOG.length > 0 && (
                <fieldset>
                  <legend className="text-sm font-medium text-[var(--admin-ink)]">
                    Choose photography (optional)
                  </legend>
                  <details className="mt-2 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] p-3">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--admin-ink)]">
                      Browse image catalogue
                    </summary>
                    <p
                      role="status"
                      className="mt-2 text-xs tabular-nums text-[var(--admin-muted)]"
                    >
                      {assetIds.length} of 8 images selected
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SITE_ASSET_CATALOG.map((asset) => (
                        <label
                          key={asset.id}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--admin-control-radius)] border border-[var(--admin-border)] px-2.5 py-1.5 text-xs text-[var(--admin-muted)] has-checked:border-[var(--admin-ink)] has-checked:text-[var(--admin-ink)]"
                        >
                          <input
                            type="checkbox"
                            disabled={!assetIds.includes(asset.id) && assetIds.length >= 8}
                            checked={assetIds.includes(asset.id)}
                            onChange={() => toggleAsset(asset.id)}
                          />
                          {asset.alt}
                        </label>
                      ))}
                    </div>
                  </details>
                </fieldset>
              )}
              {error ? (
                <p role="alert" className="admin-copy text-sm text-[var(--admin-danger)]">
                  {error}
                </p>
              ) : null}
              <div>
                <button
                  type="submit"
                  className="admin-button admin-button--primary"
                  disabled={!valid || creating || creationNeedsRefresh || loading}
                >
                  {creating ? "Creating draft…" : "Create draft"}
                </button>
              </div>
            </fieldset>
          </form>
        </AdminSurface>
      </section>
      <section aria-label="Page drafts">
        <div className="flex items-center justify-between gap-3">
          <h2 className="admin-section-title">Drafts</h2>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            disabled={loading || creating}
            onClick={() => void fetchDrafts()}
          >
            {loading ? "Refreshing drafts…" : "Refresh drafts"}
          </button>
        </div>
        {loading ? (
          <LoadingSkeleton />
        ) : listError ? (
          <AdminSurface>
            <p role="alert">{listError}</p>
            <button
              type="button"
              className="admin-button admin-button--secondary mt-3"
              disabled={creating}
              onClick={() => void fetchDrafts()}
            >
              Retry
            </button>
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

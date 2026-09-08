"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
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

export default function AdminSiteStudioPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceName, setServiceName] = useState("");
  const [audience, setAudience] = useState("");
  const [outcome, setOutcome] = useState("");
  const [mode, setMode] = useState<"template" | "ai">("template");
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site/drafts");
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch {
      setDrafts([]);
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
          brief: { serviceName, audience, outcome },
          mode,
          assetIds,
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
    <div>
      <PageHeader
        title="Site Studio"
        subtitle="Create AI-assisted page drafts from approved components and photography. Drafts stay private until a future publish step."
      />
      <section aria-label="Create a page draft" style={{ marginBottom: "2rem" }}>
        <h2 className="admin-section-title">New page draft</h2>
        <div style={{ display: "grid", gap: "0.75rem", maxWidth: "44rem" }}>
          <label>
            Service name
            <input
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              placeholder="Bookkeeping automation"
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            />
          </label>
          <label>
            Audience
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="Home service owners"
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            />
          </label>
          <label>
            Outcome
            <input
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              placeholder="The office runs while the crew builds"
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            />
          </label>
          <label>
            Creation mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "template" | "ai")}
              style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
            >
              <option value="template">Built-in service template</option>
              <option value="ai">AI generated (needs OpenRouter)</option>
            </select>
          </label>
          <fieldset>
            <legend>Attach photography (optional, approved catalog only)</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {SITE_ASSET_CATALOG.map((asset) => (
                <label key={asset.id} style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={assetIds.includes(asset.id)}
                    onChange={() => toggleAsset(asset.id)}
                  />
                  {asset.id}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? (
            <p role="alert" style={{ color: "var(--site-muted, #6b6259)" }}>
              {error}
            </p>
          ) : null}
          <div>
            <Button onClick={create} disabled={!valid || creating}>
              {creating ? "Creating draft" : "Create draft"}
            </Button>
          </div>
        </div>
      </section>
      <section aria-label="Page drafts">
        <h2 className="admin-section-title">Drafts</h2>
        {loading ? (
          <LoadingSkeleton />
        ) : drafts.length === 0 ? (
          <p>No drafts yet. Create the first one above.</p>
        ) : (
          <ul style={{ display: "grid", gap: "0.75rem", listStyle: "none", padding: 0 }}>
            {drafts.map((draft) => (
              <li key={draft.id} style={{ border: "1px solid currentColor", borderRadius: "0.5rem", padding: "1rem" }}>
                <Link href={`/admin/site/${draft.id}`}>{draft.title}</Link>
                <p style={{ margin: "0.25rem 0 0" }}>
                  /{draft.slug} - {draft.source} - updated {draft.updatedAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

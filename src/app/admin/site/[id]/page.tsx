"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { SitePageRenderer } from "@/lib/site-studio/renderer";
import {
  collectAssetIds,
  isSiteDocument,
} from "@/lib/site-studio/document";
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
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]!);

  useEffect(() => {
    fetch(`/api/admin/site/drafts/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        const data = await res.json();
        setDraft(data.draft ?? null);
      })
      .catch(() => setDraft(null));
  }, [id]);

  if (missing) {
    return (
      <div>
        <PageHeader title="Draft not found" subtitle="This draft id does not exist." />
        <Link href="/admin/site">Back to Site Studio</Link>
      </div>
    );
  }
  if (!draft) return <LoadingSkeleton />;
  const raw = draft.document;
  const document = isSiteDocument(raw) ? raw : null;
  const attached = document ? collectAssetIds(document) : [];

  return (
    <div>
      <PageHeader
        title={draft.title}
        subtitle={`/${draft.slug} - ${draft.source} draft - checksum ${draft.checksum.slice(0, 12)} - updated ${draft.updatedAt.slice(0, 10)}`}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }} role="group" aria-label="Preview width">
        {WIDTHS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setWidth(option)}
            aria-pressed={width.label === option.label}
            style={{ fontWeight: width.label === option.label ? 700 : 400 }}
          >
            {option.label}
          </button>
        ))}
        <Link href="/admin/site" style={{ marginLeft: "auto" }}>
          All drafts
        </Link>
      </div>
      {!document ? (
        <p role="alert">This draft failed validation and cannot render.</p>
      ) : (
        <div style={{ maxWidth: width.px, margin: width.px === "100%" ? "0" : "0 auto", border: "1px solid currentColor" }}>
          <SitePageRenderer document={document} />
        </div>
      )}
      <section aria-label="Attached images" style={{ marginTop: "2rem" }}>
        <h2 className="admin-section-title">Attached images</h2>
        {attached.length === 0 ? (
          <p>No catalog images attached.</p>
        ) : (
          <ul>
            {attached.map((assetId) => {
              const asset = resolveSiteAsset(assetId);
              return (
                <li key={assetId}>
                  {assetId} - {asset ? asset.alt : "unresolved reference"}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

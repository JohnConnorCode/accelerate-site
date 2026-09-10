"use client";
import { useState } from "react";
import type { WebsiteDocument } from "@/lib/site-studio/website-document";
import { parseWebsiteDocument } from "@/lib/site-studio/website-document";
import { websiteButtonClass as button, websiteFieldClass as field } from "./WebsiteFields";
export function WebsiteAssets({
  website,
  pageId,
  onChange,
}: {
  website: WebsiteDocument;
  pageId: string;
  onChange: (website: WebsiteDocument) => void;
}) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const page = website.pages.find((page) => page.id === pageId);
  const entry = website.collections
    .flatMap((collection) => collection.entries)
    .find((entry) => entry.id === pageId);
  const apply = (next: WebsiteDocument) => {
    try {
      parseWebsiteDocument(next);
      onChange(next);
      setError("");
    } catch {
      setError(
        "This image is still referenced, or its address is invalid. Update its uses before removing it.",
      );
    }
  };
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Images</h2>
      <p className="text-sm text-[var(--admin-muted)]">
        Add an image from your installation or an HTTPS address. Describe it for readers using
        assistive technology.
      </p>
      <label className="block text-sm">
        Image address
        <input
          className={field}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          placeholder="/images/photo.jpg"
        />
      </label>
      <label className="block text-sm">
        Image description
        <input
          className={field}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          maxLength={300}
        />
      </label>
      <button
        type="button"
        className={button}
        disabled={!src.trim() || !alt.trim()}
        onClick={() => {
          try {
            const next = parseWebsiteDocument({
              ...website,
              assets: [
                ...website.assets,
                {
                  id: `image-${crypto.randomUUID().slice(0, 8)}`,
                  src: src.trim(),
                  alt: alt.trim(),
                },
              ],
            });
            onChange(next);
            setSrc("");
            setAlt("");
            setError("");
          } catch {
            setError("Use a site image path or HTTPS image address and a short description.");
          }
        }}
      >
        Add image
      </button>
      {error && (
        <p role="alert" className="text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {website.assets.map((asset) => (
          <article
            key={asset.id}
            className="min-w-0 space-y-3 rounded-lg border border-[var(--admin-border)] p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.src}
              alt={asset.alt}
              loading="lazy"
              className="aspect-video w-full rounded object-cover"
            />
            <p className="text-sm">{asset.alt}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                onClick={() =>
                  apply({ ...website, identity: { ...website.identity, logoAssetId: asset.id } })
                }
              >
                Use as logo
              </button>
              {page && (
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    apply({
                      ...website,
                      pages: website.pages.map((p) =>
                        p.id === page.id
                          ? { ...p, metadata: { ...p.metadata, imageAssetId: asset.id } }
                          : p,
                      ),
                    })
                  }
                >
                  Page sharing image
                </button>
              )}
              {entry && (
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    apply({
                      ...website,
                      collections: website.collections.map((collection) => ({
                        ...collection,
                        entries: collection.entries.map((item) =>
                          item.id === entry.id
                            ? {
                                ...item,
                                body: [
                                  ...item.body,
                                  { type: "image" as const, assetId: asset.id, alt: asset.alt },
                                ],
                              }
                            : item,
                        ),
                      })),
                    })
                  }
                >
                  Insert in article
                </button>
              )}
              {page?.content.kind === "article" && (
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    apply({
                      ...website,
                      pages: website.pages.map((p) =>
                        p.id === page.id && p.content.kind === "article"
                          ? {
                              ...p,
                              content: {
                                ...p.content,
                                body: [
                                  ...p.content.body,
                                  { type: "image", assetId: asset.id, alt: asset.alt },
                                ],
                              },
                            }
                          : p,
                      ),
                    })
                  }
                >
                  Insert in article
                </button>
              )}
              <button
                type="button"
                className={button}
                onClick={() =>
                  apply({
                    ...website,
                    assets: website.assets.filter((item) => item.id !== asset.id),
                  })
                }
              >
                Remove image
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

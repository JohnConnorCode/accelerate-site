import { siteUrl } from "@/config/tenant";
import type { Metadata } from "next";

const SITE_URL = siteUrl();

function ogImageUrl(title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  return `${SITE_URL}/api/og?${params.toString()}`;
}

/**
 * Build a complete Metadata object with OG image, Twitter card, and canonical URL.
 *
 * - `title` uses the layout template (`%s | <brand name>`) automatically.
 * - `description` is inherited into og:description and twitter:description by Next.js.
 * - `twitter.card` is inherited from layout (`summary_large_image`).
 * - Pass `openGraph` extras for article-specific fields (type, publishedTime, etc).
 * - Pass `path` to auto-generate a canonical URL (e.g. "/services").
 */
export function seoMetadata({
  title,
  description,
  ogTitle,
  ogSubtitle,
  openGraph,
  alternates,
  path,
  absoluteTitle,
}: {
  title: string;
  description: string;
  /** Skip the "%s | <brand name>" layout template — for content pages (articles)
      whose title is self-contained and would otherwise truncate in search. */
  absoluteTitle?: boolean;
  /** Title rendered on the OG image card (defaults to `title`) */
  ogTitle?: string;
  /** Subtitle rendered below the title on the OG image card */
  ogSubtitle?: string;
  /** Extra openGraph fields merged in (e.g. type, publishedTime, authors) */
  openGraph?: Record<string, unknown>;
  /** Canonical / alternate links */
  alternates?: Metadata["alternates"];
  /** Page path for auto-canonical (e.g. "/services", "/about") */
  path?: string;
}): Metadata {
  const imageTitle = ogTitle || title;
  const imageUrl = ogImageUrl(imageTitle, ogSubtitle);

  // Build alternates with canonical
  const resolvedAlternates = alternates || (path ? { canonical: `${SITE_URL}${path}` } : undefined);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    openGraph: {
      // og:type is required by the Open Graph spec; default to "website" so
      // core pages emit it. Article pages override via the openGraph prop.
      type: "website",
      ...(path && { url: `${SITE_URL}${path}` }),
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageTitle }],
      ...(openGraph as Metadata["openGraph"]),
    },
    twitter: {
      images: [{ url: imageUrl, alt: imageTitle }],
    },
    ...(resolvedAlternates && { alternates: resolvedAlternates }),
  };
}

import type { Metadata } from "next";

const SITE_URL = "https://acceleratewith.us";

function ogImageUrl(title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  return `${SITE_URL}/api/og?${params.toString()}`;
}

/**
 * Build a complete Metadata object with OG image and Twitter card.
 *
 * - `title` uses the layout template (`%s | Accelerate`) automatically.
 * - `description` is inherited into og:description and twitter:description by Next.js.
 * - `twitter.card` is inherited from layout (`summary_large_image`).
 * - Pass `openGraph` extras for article-specific fields (type, publishedTime, etc).
 */
export function seoMetadata({
  title,
  description,
  ogTitle,
  ogSubtitle,
  openGraph,
  alternates,
}: {
  title: string;
  description: string;
  /** Title rendered on the OG image card (defaults to `title`) */
  ogTitle?: string;
  /** Subtitle rendered below the title on the OG image card */
  ogSubtitle?: string;
  /** Extra openGraph fields merged in (e.g. type, publishedTime, authors) */
  openGraph?: Record<string, unknown>;
  /** Canonical / alternate links */
  alternates?: Metadata["alternates"];
}): Metadata {
  const imageTitle = ogTitle || title;
  const imageUrl = ogImageUrl(imageTitle, ogSubtitle);

  return {
    title,
    description,
    openGraph: {
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageTitle }],
      ...(openGraph as Metadata["openGraph"]),
    },
    twitter: {
      images: [imageUrl],
    },
    ...(alternates && { alternates }),
  };
}

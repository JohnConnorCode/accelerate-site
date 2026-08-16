export const revalidate = 3600;

import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { getArticlesByTag, getAllTags } from "@/lib/mdx";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { LearningArchive } from "@/components/sections/LearningArchive";

export function generateStaticParams() {
  return getAllTags({ includeScheduled: true }).map(({ tag }) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const articles = getArticlesByTag(decoded);
  const isThin = articles.length < 2;
  return {
    ...seoMetadata({
      title: `Articles tagged "${decoded}" | Learning Hub`,
      description: `Browse articles about ${decoded} with practical strategies for small businesses.`,
      ogTitle: `${decoded} Articles`,
      ogSubtitle: "Practical strategies for small businesses",
      alternates: {
        canonical: `https://www.acceleratewith.us/learn/tag/${encodeURIComponent(tag)}`,
      },
    }),
    ...(isThin && {
      robots: { index: false, follow: true },
    }),
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const articles = getArticlesByTag(decoded);

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Learning Hub", url: "/learn" },
    { name: `Tag: ${decoded}`, url: `/learn/tag/${encodeURIComponent(tag)}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LearningArchive
        eyebrow="learning hub / topic"
        title={decoded}
        description={`Every published guide we have on ${decoded}, gathered in one place.`}
        articles={articles}
      />
    </>
  );
}

export const revalidate = 3600;

import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { notFound } from "next/navigation";
import { getArticlesByCategory, getAllCategories, CATEGORY_LABELS } from "@/lib/mdx";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import type { ArticleCategory } from "@/lib/types";
import { LearningArchive } from "@/components/sections/LearningArchive";

export function generateStaticParams() {
  return getAllCategories({ includeScheduled: true }).map(({ category }) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORY_LABELS[category as ArticleCategory];
  if (!label) return { title: "Category Not Found" };
  return seoMetadata({
    title: `${label} Articles | Learning Hub`,
    description: `Browse our ${label.toLowerCase()} articles with practical strategies for small businesses.`,
    ogTitle: `${label} Articles`,
    ogSubtitle: `Practical ${label.toLowerCase()} strategies for small businesses`,
    alternates: {
      canonical: `https://www.acceleratewith.us/learn/category/${category}`,
    },
  });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const label = CATEGORY_LABELS[category as ArticleCategory];
  if (!label) notFound();

  const articles = getArticlesByCategory(category as ArticleCategory);

  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Learning Hub", url: "/learn" },
    { name: label, url: `/learn/category/${category}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <LearningArchive
        eyebrow="learning hub / category"
        title={label}
        description={`Practical ${label.toLowerCase()} guidance for teams that need useful systems, not another pile of theory.`}
        articles={articles}
        showCategory={false}
      />
    </>
  );
}

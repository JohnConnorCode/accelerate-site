export const revalidate = 3600;

import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { getArticlesByTag, getAllTags, CATEGORY_LABELS } from "@/lib/mdx";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import Link from "next/link";
import { Clock, ArrowRight, ChevronRight } from "lucide-react";

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
        canonical: `https://acceleratewith.us/learn/tag/${encodeURIComponent(tag)}`,
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
      <div className="pt-28 pb-20">
      <div className="mx-auto max-w-6xl px-6">
        <nav className="mb-8 flex items-center gap-1.5 text-sm text-white-muted">
          <Link
            href="/learn"
            className="hover:text-white-secondary transition-colors"
          >
            Learn
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white-secondary">Tag: {decoded}</span>
        </nav>

        <h1 className="font-display text-3xl font-bold md:text-4xl">
          <span className="text-white-primary">Tagged: </span>
          <span className="text-gold-gradient">{decoded}</span>
        </h1>
        <p className="mt-3 text-white-secondary">
          {articles.length} article{articles.length !== 1 ? "s" : ""} with this
          tag
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="group glass rounded-lg p-6 transition-all hover:border-border-gold"
            >
              <span className="text-xs font-medium text-gold-light">
                {CATEGORY_LABELS[article.frontmatter.category]}
              </span>
              <h3 className="mt-2 font-display text-lg font-semibold text-white-primary group-hover:text-gold-gradient transition-colors line-clamp-2">
                {article.frontmatter.title}
              </h3>
              <p className="mt-2 text-sm text-white-secondary line-clamp-2">
                {article.frontmatter.excerpt}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-white-muted">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {article.readingTime}
                </span>
                <span className="inline-flex items-center gap-1 group-hover:text-gold-light transition-colors">
                  Read <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {articles.length === 0 && (
          <p className="mt-12 text-center text-white-muted">
            No articles with this tag yet.
          </p>
        )}
      </div>
    </div>
    </>
  );
}

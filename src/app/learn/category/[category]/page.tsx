import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowRight, ChevronRight } from "lucide-react";
import {
  getArticlesByCategory,
  getAllCategories,
  CATEGORY_LABELS,
} from "@/lib/mdx";
import type { ArticleCategory } from "@/lib/types";

export function generateStaticParams() {
  return getAllCategories().map(({ category }) => ({ category }));
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
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const label = CATEGORY_LABELS[category as ArticleCategory];
  if (!label) notFound();

  const articles = getArticlesByCategory(category as ArticleCategory);

  return (
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
          <span className="text-white-secondary">{label}</span>
        </nav>

        <h1 className="font-display text-3xl font-bold md:text-4xl">
          <span className="text-white-primary">{label} </span>
          <span className="text-gold-gradient">Articles</span>
        </h1>
        <p className="mt-3 text-white-secondary">
          {articles.length} article{articles.length !== 1 ? "s" : ""} in this
          category
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="group glass rounded-lg p-6 transition-all hover:border-border-gold"
            >
              <h3 className="font-display text-lg font-semibold text-white-primary group-hover:text-gold-gradient transition-colors line-clamp-2">
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
            No articles in this category yet. Check back soon!
          </p>
        )}
      </div>
    </div>
  );
}

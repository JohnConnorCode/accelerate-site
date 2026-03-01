"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article, ArticleCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/constants";

const ARTICLES_PER_PAGE = 8;

const ALL_CATEGORIES: ArticleCategory[] = [
  "lead-generation",
  "automation",
  "ai-tools",
  "industry",
  "foundational",
  "local-seo",
];

interface LearnHubProps {
  articles: Article[];
  featuredArticle: Article | null;
}

export function LearnHub({ articles, featuredArticle }: LearnHubProps) {
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | "all">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = articles.filter((article) => {
    const matchesCategory =
      activeCategory === "all" ||
      article.frontmatter.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      article.frontmatter.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      article.frontmatter.excerpt
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * ARTICLES_PER_PAGE,
    page * ARTICLES_PER_PAGE
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-16">
        <div className="orb-gold -top-40 -right-40 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-6">
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            <span className="text-white-primary">Learning </span>
            <span className="text-gold-gradient">Hub</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white-secondary">
            Practical guides on AI, automation, and lead generation for small
            businesses. No fluff, just actionable strategies you can implement
            today.
          </p>
        </div>
      </section>

      {/* Featured Article */}
      {featuredArticle && (
        <section className="mx-auto max-w-6xl px-6 mb-12">
          <Link
            href={`/learn/${featuredArticle.slug}`}
            className="group block glass-gold rounded-xl p-8 transition-all hover:border-border-gold-hover"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-gold-light">
              Featured
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold text-white-primary group-hover:text-gold-gradient transition-colors md:text-3xl">
              {featuredArticle.frontmatter.title}
            </h2>
            <p className="mt-3 max-w-3xl text-white-secondary line-clamp-2">
              {featuredArticle.frontmatter.excerpt}
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-white-muted">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {featuredArticle.readingTime}
              </span>
              <span>
                {CATEGORY_LABELS[featuredArticle.frontmatter.category]}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-gold-light group-hover:text-gold-champagne transition-colors">
                Read article <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* Filters */}
      <section className="mx-auto max-w-6xl px-6 mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setActiveCategory("all");
                setPage(1);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-all",
                activeCategory === "all"
                  ? "bg-gold-gradient text-black font-semibold"
                  : "glass text-white-secondary hover:text-white-primary"
              )}
            >
              All
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-all",
                  activeCategory === cat
                    ? "bg-gold-gradient text-black font-semibold"
                    : "glass text-white-secondary hover:text-white-primary"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg glass py-2 pl-10 pr-4 text-sm text-white-primary placeholder:text-white-muted focus:outline-none focus:border-border-gold sm:w-64"
            />
          </div>
        </div>
      </section>

      {/* Article Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        {paginated.length === 0 ? (
          <p className="text-center text-white-muted py-12">
            No articles found matching your criteria.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {paginated.map((article) => (
              <Link
                key={article.slug}
                href={`/learn/${article.slug}`}
                className="group glass rounded-lg p-6 transition-all hover:border-border-gold"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-gold-light">
                    {CATEGORY_LABELS[article.frontmatter.category]}
                  </span>
                  <span className="text-xs text-white-muted">
                    {new Date(article.frontmatter.date).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </span>
                </div>
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
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={cn(
                  "h-9 w-9 rounded-lg text-sm transition-all",
                  page === i + 1
                    ? "bg-gold-gradient text-black font-semibold"
                    : "glass text-white-secondary hover:text-white-primary"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, ArrowRight, Search, Mail, BookOpen, FileText, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/animations";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { PageHero } from "@/components/ui/PageHero";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
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
  const [activeCategory, setActiveCategory] = useState<
    ArticleCategory | "all"
  >("all");
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
      <PageHero
        label="Learning Hub"
        title={
          <>
            Practical Guides for{" "}
            <span className="text-gold-gradient">Smarter Growth</span>
          </>
        }
        description="No fluff, no filler. AI, automation, and growth strategies you can implement today — written by people who actually run small businesses."
      >
        <div className="flex items-center justify-center gap-6 flex-wrap mt-8 text-sm text-[var(--white-muted)]">
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--gold-base)]" />
            15+ In-Depth Guides
          </span>
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--gold-base)]" />
            Actionable Strategies
          </span>
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[var(--gold-base)]" />
            Updated Weekly
          </span>
        </div>
      </PageHero>

      <div className="section-divider" />

      {/* Featured Article */}
      {featuredArticle && (
        <section className="py-16 bg-[var(--bg-section-warm)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-base)]">
                Featured
              </p>
            </AnimateOnScroll>

            <ScrollReveal animation="clip-reveal">
              <Link
                href={`/learn/${featuredArticle.slug}`}
                className="group block"
              >
                <GlassCard variant="gold" hover="lift" padding="none">
                  <div className="p-8 sm:p-10">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)] mb-4">
                      {CATEGORY_LABELS[featuredArticle.frontmatter.category]}
                    </p>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--heading-color)] group-hover:text-gold-gradient transition-colors leading-tight">
                      {featuredArticle.frontmatter.title}
                    </h2>
                    <p className="mt-4 max-w-3xl text-[var(--white-secondary)] leading-relaxed line-clamp-2">
                      {featuredArticle.frontmatter.excerpt}
                    </p>
                    <div className="mt-6 flex items-center gap-5 text-sm text-[var(--white-muted)]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {featuredArticle.readingTime}
                      </span>
                      <span>
                        {new Date(
                          featuredArticle.frontmatter.date
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1.5 text-[var(--gold-light)] group-hover:text-[var(--gold-champagne)] transition-colors font-medium">
                        Read article <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            </ScrollReveal>
          </div>
        </section>
      )}

      <div className="section-divider" />

      {/* Filters + Article Grid */}
      <section className="py-16 bg-[var(--bg-base)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Section heading */}
          <AnimateOnScroll className="text-center mb-12">
            <h2 className="section-heading mb-3">
              Browse All{" "}
              <span className="text-gold-gradient">Guides</span>
            </h2>
            <p className="text-[var(--white-muted)] max-w-lg mx-auto">
              Filter by topic or search for exactly what you need.
            </p>
          </AnimateOnScroll>

          {/* Filters */}
          <AnimateOnScroll className="mb-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setActiveCategory("all");
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-all cursor-pointer",
                    activeCategory === "all"
                      ? "bg-gold-gradient text-black font-semibold"
                      : "glass text-[var(--white-secondary)] hover:text-[var(--white-primary)]"
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
                      "rounded-full px-4 py-1.5 text-sm transition-all cursor-pointer",
                      activeCategory === cat
                        ? "bg-gold-gradient text-black font-semibold"
                        : "glass text-[var(--white-secondary)] hover:text-[var(--white-primary)]"
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--white-muted)]" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg glass py-2 pl-10 pr-4 text-sm text-[var(--white-primary)] placeholder:text-[var(--white-muted)] focus:outline-none focus:border-[var(--border-gold)] sm:w-64"
                />
              </div>
            </div>
          </AnimateOnScroll>

          {/* Article Grid */}
          <AnimatePresence mode="wait">
            {paginated.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16"
              >
                <BookOpen className="w-12 h-12 text-[var(--white-muted)] mx-auto mb-4 opacity-30" />
                <p className="text-[var(--white-muted)]">
                  No articles found matching your criteria.
                </p>
              </motion.div>
            ) : (
              <StaggerContainer
                key={`${activeCategory}-${page}`}
                className="grid gap-6 md:grid-cols-2"
              >
                {paginated.map((article) => (
                  <AnimateOnScroll key={article.slug} variants={fadeUp}>
                    <Link
                      href={`/learn/${article.slug}`}
                      className="group block h-full"
                    >
                      <GlassCard hover="lift" padding="none" className="h-full flex flex-col">
                        <div className="p-6 flex flex-col flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)]">
                              {CATEGORY_LABELS[article.frontmatter.category]}
                            </span>
                            <span className="text-xs text-[var(--white-muted)]">
                              {new Date(
                                article.frontmatter.date
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <h3 className="font-display text-lg font-semibold text-[var(--white-primary)] group-hover:text-gold-gradient transition-colors line-clamp-2 mb-2">
                            {article.frontmatter.title}
                          </h3>
                          <p className="text-sm text-[var(--white-secondary)] line-clamp-2 flex-1 mb-4">
                            {article.frontmatter.excerpt}
                          </p>
                          <div className="flex items-center justify-between text-xs text-[var(--white-muted)] pt-4 border-t border-[var(--border-subtle)]">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {article.readingTime}
                            </span>
                            <span className="inline-flex items-center gap-1 group-hover:text-[var(--gold-light)] transition-colors font-medium">
                              Read <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </GlassCard>
                    </Link>
                  </AnimateOnScroll>
                ))}
              </StaggerContainer>
            )}
          </AnimatePresence>

          {/* Pagination */}
          {totalPages > 1 && (
            <AnimateOnScroll className="mt-12 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    "h-9 w-9 rounded-lg text-sm transition-all cursor-pointer",
                    page === i + 1
                      ? "bg-gold-gradient text-black font-semibold"
                      : "glass text-[var(--white-secondary)] hover:text-[var(--white-primary)]"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </AnimateOnScroll>
          )}
        </div>
      </section>

      <div className="section-divider" />

      {/* Newsletter CTA */}
      <section className="py-24 bg-[var(--bg-section-warm)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(700px,90vw)] h-[350px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.05)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-8 sm:p-12">
                <div className="w-12 h-12 rounded-full bg-[rgba(var(--accent-rgb),0.15)] border border-[rgba(var(--accent-rgb),0.3)] flex items-center justify-center mx-auto mb-5">
                  <Mail className="w-6 h-6 text-[var(--gold-light)]" />
                </div>
                <h2 className="font-display text-2xl font-bold text-[var(--heading-color)] mb-2">
                  Get New Guides in Your Inbox
                </h2>
                <p className="text-sm text-[var(--white-muted)] max-w-md mx-auto mb-8">
                  One email per week. Actionable AI and automation insights. No
                  spam, unsubscribe anytime.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="flex-1 rounded-lg glass py-3 px-4 text-sm text-[var(--white-primary)] placeholder:text-[var(--white-muted)] focus:outline-none focus:border-[var(--border-gold)]"
                    readOnly
                  />
                  <Button variant="primary" size="md">
                    Subscribe
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="section-divider" />

      {/* Resources Cross-Promo */}
      <section className="py-24 bg-[var(--bg-base)]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <GlassCard variant="prominent" padding="lg" className="text-center">
              <h2 className="font-display text-xl font-bold text-[var(--heading-color)] mb-3">
                Want something you can use right now?
              </h2>
              <p className="text-sm text-[var(--white-muted)] max-w-md mx-auto mb-6">
                Download free checklists, templates, and calculators built for
                small businesses.
              </p>
              <Link href="/resources">
                <Button variant="secondary" size="lg">
                  Browse Free Resources
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </GlassCard>
          </AnimateOnScroll>
        </div>
      </section>
    </>
  );
}

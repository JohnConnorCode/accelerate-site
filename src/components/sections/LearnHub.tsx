"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, ArrowUpRight, Search, Mail, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import { Section, Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
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

const fmtDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function LearnHub({ articles, featuredArticle }: LearnHubProps) {
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = articles.filter((article) => {
    const matchesCategory =
      activeCategory === "all" || article.frontmatter.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      article.frontmatter.title.toLowerCase().includes(q) ||
      article.frontmatter.excerpt.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);

  return (
    <>
      {/* hero — statement left, the featured guide (lead with your best) right */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <Container width="wide">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="min-w-0">
            <AnimateOnScroll><Eyebrow className="mb-7">the learning hub</Eyebrow></AnimateOnScroll>
            <RevealHeading
              as="h1"
              className={HERO_HEADING}
              lead="Practical AI for operators."
              delay={0.1}
            />
            <AnimateOnScroll delay={0.3}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-white-secondary">
                No filler. Real ways to put AI to work across your whole business,
                from winning customers to automating the busywork to seeing what
                actually drives revenue. Written by people who run small businesses.
              </p>
            </AnimateOnScroll>
          </div>

          {featuredArticle && (
            <AnimateOnScroll as="div" delay={0.2}>
            <Link
              href={`/learn/${featuredArticle.slug}`}
              data-cursor="link"
              className="group relative block overflow-hidden rounded-3xl border border-border-gold/50 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-7 backdrop-blur-md transition-colors hover:border-border-gold sm:p-8"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
              <p className="mb-4 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                Featured · {CATEGORY_LABELS[featuredArticle.frontmatter.category]}
              </p>
              <h2 className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-heading sm:text-3xl">
                {featuredArticle.frontmatter.title}
              </h2>
              <p className="mt-4 leading-relaxed text-white-secondary line-clamp-3">
                {featuredArticle.frontmatter.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-border-glass pt-5 text-sm text-white-muted">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {featuredArticle.readingTime}
                </span>
                <span>{fmtDate(featuredArticle.frontmatter.date)}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-heading">
                  <span className="ink-sweep">Read article</span>
                  <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </Link>
            </AnimateOnScroll>
          )}
        </div>
        </Container>
      </section>

      {/* browse all */}
      <Section width="wide" divide>
        <Eyebrow className="mb-6">browse all guides</Eyebrow>
        <Heading size={2} as="h2" className="mb-3 max-w-3xl">
          Filter by topic. Search by need.
        </Heading>
        <p className="mb-10 max-w-xl text-base leading-relaxed text-white-muted">
          Pick a category, search, or just scroll. Every guide is written to
          help you ship something useful this week.
        </p>

        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-cursor="link"
              onClick={() => { setActiveCategory("all"); setPage(1); }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                activeCategory === "all"
                  ? "border border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_14%,transparent)] text-gold"
                  : "border border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-heading"
              )}
            >
              All
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                data-cursor="link"
                onClick={() => { setActiveCategory(cat); setPage(1); }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  activeCategory === cat
                    ? "border border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_14%,transparent)] text-gold"
                    : "border border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-heading"
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
              placeholder="Search articles…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] py-2 pl-10 pr-4 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none sm:w-64"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {paginated.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 text-center"
            >
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-white-muted opacity-30" />
              <p className="text-white-muted">No articles found matching your criteria.</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeCategory}-${page}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-5 md:grid-cols-2"
            >
              {paginated.map((article, i) => (
                <AnimateOnScroll key={article.slug} as="div" delay={(i % 4) * 0.05}>
                  <Link
                    href={`/learn/${article.slug}`}
                    data-cursor="link"
                    className="group flex h-full flex-col rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)] p-6 backdrop-blur-md transition-colors hover:border-border-gold"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3 font-mono text-[0.6rem] uppercase tracking-[0.18em]">
                      <span className="text-gold">{CATEGORY_LABELS[article.frontmatter.category]}</span>
                      <span className="text-white-muted">{fmtDate(article.frontmatter.date)}</span>
                    </div>
                    <h3 className="mb-2 line-clamp-2 font-display text-lg font-semibold tracking-[-0.01em] text-heading">
                      {article.frontmatter.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 flex-1 text-sm leading-relaxed text-white-secondary">
                      {article.frontmatter.excerpt}
                    </p>
                    <div className="flex items-center justify-between border-t border-border-glass pt-4 text-xs text-white-muted">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {article.readingTime}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-heading">
                        <span className="ink-sweep">Read</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                </AnimateOnScroll>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                type="button"
                data-cursor="link"
                onClick={() => setPage(i + 1)}
                className={cn(
                  "h-9 w-9 rounded-lg text-sm transition-colors",
                  page === i + 1
                    ? "border border-border-gold bg-[color-mix(in_srgb,var(--gold-base)_14%,transparent)] text-gold"
                    : "border border-border-glass text-white-secondary hover:border-[var(--border-glass-hover)] hover:text-heading"
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* done-for-you band — route from learning into the money pages */}
      <Section width="wide" divide>
        <AnimateOnScroll>
          <div className="overflow-hidden rounded-3xl border border-border-gold/50 bg-[color-mix(in_srgb,var(--gold-base)_5%,var(--bg-elevated))] p-8 backdrop-blur-md sm:p-12">
            <span aria-hidden className="block h-px w-full bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
            <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.22em] text-gold">
                  Looking for done-for-you?
                </p>
                <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-heading sm:text-3xl">
                  Skip the learning curve. We build it and run it.
                </h2>
                <p className="mt-4 leading-relaxed text-white-secondary">
                  Reading is the fast lane to understanding. Booking more jobs is the
                  destination. We build custom systems powered by AI and run them
                  alongside you, working from day one, so nothing slips through.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/services"
                  data-cursor="link"
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-btn-text transition-opacity hover:opacity-90"
                >
                  See what we build
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link
                  href="/industries"
                  data-cursor="link"
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-border-glass px-6 py-3 text-sm font-semibold text-heading transition-colors hover:border-border-gold hover:text-gold"
                >
                  Browse by industry
                  <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </Section>

      {/* newsletter */}
      <Section width="text" divide className="bg-[var(--bg-section-warm)]">
        <div className="rounded-2xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_4%,var(--bg-elevated))] p-8 text-center backdrop-blur-md sm:p-12">
          <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-border-gold/40 bg-[color-mix(in_srgb,var(--gold-base)_8%,transparent)] text-gold">
            <Mail className="h-6 w-6" />
          </span>
          <h2 className="mb-2 font-display text-2xl font-bold tracking-[-0.02em] text-heading">
            Get new guides in your inbox
          </h2>
          <p className="mx-auto mb-7 max-w-md text-sm text-white-muted">
            One email per week. Actionable AI and automation insights. No spam,
            unsubscribe anytime.
          </p>
          <form className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex-1 rounded-full border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_60%,transparent)] px-4 py-3 text-sm text-heading placeholder:text-white-muted focus:border-border-gold focus:outline-none"
            />
            <button
              type="submit"
              data-cursor="link"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-btn-text transition-opacity hover:opacity-90"
            >
              Subscribe
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </form>
        </div>
      </Section>

      {/* cross-promo */}
      <Section width="text" divide>
        <div className="rounded-2xl border border-border-glass bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-8 text-center backdrop-blur-md sm:p-10">
          <h2 className="mb-3 font-display text-xl font-bold tracking-[-0.01em] text-heading">
            Want something you can use right now?
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-white-muted">
            Download free checklists, templates, and calculators built for small businesses.
          </p>
          <Link
            href="/resources"
            data-cursor="link"
            className="group inline-flex items-center gap-2 rounded-full border border-border-glass px-6 py-3 text-sm font-semibold text-heading transition-colors hover:border-border-gold hover:text-gold"
          >
            Browse free resources
            <ArrowUpRight className="h-4 w-4 text-gold transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </Section>
    </>
  );
}

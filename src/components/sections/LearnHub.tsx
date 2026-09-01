"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidEmail } from "@/lib/validation";
import { getUTMParams, clearUTMParams } from "@/lib/utm";
import { trackConversion } from "@/lib/analytics";
import { EASE } from "@/lib/animations";
import { AnimateOnScroll, EntranceGroup, EntranceItem } from "@/components/ui/AnimateOnScroll";
import { ArticleCard } from "@/components/mdx/ArticleCard";
import { Section, Container, Eyebrow, Heading } from "@/components/v2/studio/primitives";
import { RevealHeading } from "@/components/v2/studio/RevealHeading";
import { HERO_HEADING } from "@/lib/type-recipes";
import type { ArticleCategory, ArticleSummary } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { formatDateOnly } from "@/lib/date-format";

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
  articles: ArticleSummary[];
  featuredArticle: ArticleSummary | null;
}

const formatDate = (date: string) =>
  formatDateOnly(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
  exit: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(3px)",
    transition: { duration: 0.14, ease: "easeIn" as const },
  },
};

export function LearnHub({ articles, featuredArticle }: LearnHubProps) {
  const [activeCategory, setActiveCategory] = useState<ArticleCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [email, setEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [subscribeError, setSubscribeError] = useState("");

  const filtered = articles.filter((article) => {
    const matchesCategory =
      activeCategory === "all" || article.frontmatter.category === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      article.frontmatter.title.toLowerCase().includes(query) ||
      article.frontmatter.excerpt.toLowerCase().includes(query) ||
      article.frontmatter.tags.some((tag) => tag.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ARTICLES_PER_PAGE, page * ARTICLES_PER_PAGE);

  async function handleSubscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setSubscribeStatus("error");
      setSubscribeError("Enter a valid email address.");
      return;
    }

    setSubscribeStatus("loading");
    setSubscribeError("");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, utm: getUTMParams() }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not subscribe.");
      }
      trackConversion("Newsletter Subscribed", { location: "learning_hub" });
      clearUTMParams();
      setSubscribeStatus("success");
      setEmail("");
    } catch (error) {
      setSubscribeStatus("error");
      setSubscribeError(error instanceof Error ? error.message : "Could not subscribe. Try again.");
    }
  }

  return (
    <>
      <section className="page-offset-roomy relative overflow-hidden pb-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-[8%] top-28 h-px w-24 bg-[var(--rule)]" />
          <div className="absolute right-[8%] top-28 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white-muted">
            Field notes / 2026
          </div>
        </div>

        <Container width="wide">
          <div className="grid items-end gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
            <div className="min-w-0">
              <EntranceGroup>
                <EntranceItem>
                  <Eyebrow className="mb-7">the learning hub</Eyebrow>
                </EntranceItem>
              </EntranceGroup>
              <RevealHeading
                as="h1"
                className={`${HERO_HEADING} text-balance`}
                lead="Practical AI for operators."
              />
              <EntranceGroup delay={0.18}>
                <EntranceItem>
                  <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-white-secondary">
                    Clear field notes for putting AI into a business that already has customers,
                    deadlines, and a reputation to protect.
                  </p>
                </EntranceItem>
                <EntranceItem>
                  <div className="mt-8 flex items-center gap-4 font-mono text-[0.66rem] uppercase tracking-[0.15em] text-white-muted">
                    <span>{articles.length + (featuredArticle ? 1 : 0)} guides</span>
                    <span className="h-px w-8 bg-[var(--rule)]" />
                    <span>Built to use this week</span>
                  </div>
                </EntranceItem>
              </EntranceGroup>
            </div>

            {featuredArticle && (
              <AnimateOnScroll as="article" delay={0.14}>
                <Link
                  href={`/learn/${featuredArticle.slug}`}
                  data-cursor="link"
                  className="learning-feature group relative block p-7 sm:p-9"
                >
                  <div className="mb-12 flex items-start justify-between gap-5">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-heading">
                      Featured guide
                    </p>
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white-muted">
                      {CATEGORY_LABELS[featuredArticle.frontmatter.category]}
                    </span>
                  </div>
                  <h2 className="max-w-[22ch] text-balance font-display text-2xl font-medium leading-[1.15] tracking-[-0.025em] text-heading sm:text-3xl">
                    {featuredArticle.frontmatter.title}
                  </h2>
                  <p className="mt-5 line-clamp-3 text-pretty leading-relaxed text-white-secondary">
                    {featuredArticle.frontmatter.excerpt}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[var(--rule)] pt-5 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-white-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {featuredArticle.readingTime}
                    </span>
                    <span>{formatDate(featuredArticle.frontmatter.date)}</span>
                    <span className="ml-auto inline-flex items-center gap-2 text-heading">
                      Read guide
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </AnimateOnScroll>
            )}
          </div>
        </Container>
      </section>

      <Section width="wide" divide>
        <Eyebrow className="mb-6">browse the library</Eyebrow>
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Heading size={2} as="h2" className="max-w-3xl text-balance">
              Find the next useful move.
            </Heading>
            <p className="mt-4 max-w-xl text-pretty leading-relaxed text-white-secondary">
              Search a problem or narrow the library by topic. Every guide favors practical
              decisions over trend watching.
            </p>
          </div>
          <p
            className="font-mono text-xs tabular-nums uppercase tracking-[0.14em] text-white-muted"
            aria-live="polite"
          >
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
        </div>

        <div className="mt-10 border-y border-[var(--rule)] py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filter articles by category"
            >
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setPage(1);
                }}
                aria-pressed={activeCategory === "all"}
                className={cn("topic-filter", activeCategory === "all" && "is-active")}
              >
                All topics
              </button>
              {ALL_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setActiveCategory(category);
                    setPage(1);
                  }}
                  aria-pressed={activeCategory === category}
                  className={cn("topic-filter", activeCategory === category && "is-active")}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>

            <label className="relative block w-full lg:w-72">
              <span className="sr-only">Search the learning library</span>
              <Search
                className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white-muted"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search the library"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                className="h-11 w-full border-b border-[var(--rule)] bg-transparent pl-7 pr-2 text-sm text-heading outline-none transition-[border-color] duration-200 placeholder:text-white-muted focus:border-[var(--fg)]"
              />
            </label>
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {paginated.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.14 } }}
              className="py-24 text-center"
            >
              <BookOpen className="mx-auto mb-5 h-10 w-10 text-white-muted" aria-hidden="true" />
              <p className="text-heading">Nothing matches that search yet.</p>
              <button
                type="button"
                className="mt-3 min-h-10 text-sm text-white-secondary underline underline-offset-4 transition-colors hover:text-heading"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  setPage(1);
                }}
              >
                Clear the filters
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeCategory}-${searchQuery}-${page}`}
              variants={gridVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-10 grid gap-5 md:grid-cols-2"
            >
              {paginated.map((article, index) => (
                <motion.article key={article.slug} variants={cardVariants}>
                  <ArticleCard article={article} index={(page - 1) * ARTICLES_PER_PAGE + index} />
                </motion.article>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {totalPages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Article pages">
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={page === pageNumber ? "page" : undefined}
                  className={cn("page-number", page === pageNumber && "is-active")}
                >
                  {pageNumber}
                </button>
              );
            })}
          </nav>
        )}
      </Section>

      <Section width="wide" divide>
        <div className="grid gap-10 bg-[var(--fg)] p-8 text-[var(--bg)] sm:p-12 lg:grid-cols-[1.2fr_auto] lg:items-end lg:p-14">
          <div className="max-w-2xl">
            <p className="mb-5 font-mono text-[0.66rem] uppercase tracking-[0.2em] opacity-60">
              From insight to operating system
            </p>
            <h2 className="text-balance font-display text-3xl font-medium leading-tight tracking-[-0.025em] sm:text-4xl">
              Skip the learning curve. We can build it with you.
            </h2>
            <p className="mt-5 max-w-xl text-pretty leading-relaxed opacity-70">
              Use the guides to sharpen your thinking, then bring us the messy operational part. We
              design, ship, and run the system.
            </p>
          </div>
          <Link href="/services" className="btn btn-inv shrink-0">
            See what we build <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section width="text" divide>
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <span
            className="grid h-12 w-12 place-items-center bg-[var(--fg)] text-[var(--bg)]"
            aria-hidden="true"
          >
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-balance font-display text-2xl font-medium tracking-[-0.02em] text-heading sm:text-3xl">
              One useful guide, once a week.
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-white-secondary">
              A practical idea you can test in an hour. No daily noise, no recycled AI headlines.
            </p>

            {subscribeStatus === "success" ? (
              <div
                className="mt-7 flex min-h-12 items-center gap-2 text-sm text-[var(--success)]"
                role="status"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                You&rsquo;re on the list.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="mt-7 max-w-xl">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex-1">
                    <span className="sr-only">Email address</span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (subscribeStatus === "error") setSubscribeStatus("idle");
                      }}
                      placeholder="you@company.com"
                      disabled={subscribeStatus === "loading"}
                      className="h-12 w-full border border-[var(--rule)] bg-transparent px-4 text-sm text-heading outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-white-muted focus:border-[var(--fg)] focus:shadow-[0_0_0_1px_var(--fg)] disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={subscribeStatus === "loading"}
                    className="btn min-h-12 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {subscribeStatus === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-label="Subscribing" />
                    ) : (
                      <>
                        Subscribe <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
                {subscribeStatus === "error" && subscribeError && (
                  <p className="mt-2 text-sm text-[var(--error)]" role="alert">
                    {subscribeError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}

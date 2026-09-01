export const revalidate = 3600;

import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import Link from "next/link";
import { ChevronRight, Clock, Calendar, User } from "lucide-react";
import { getAllArticles, getArticleBySlug, getRelatedArticles, CATEGORY_LABELS } from "@/lib/mdx";
import { generateArticleJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";
import { formatDateOnly } from "@/lib/date-format";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { AnimateOnScroll, EntranceGroup, EntranceItem } from "@/components/ui/AnimateOnScroll";
import {
  Section,
  Eyebrow,
  Heading,
  BookCallButton,
  CallTerms,
} from "@/components/v2/studio/primitives";
import { TableOfContents } from "@/components/mdx/TableOfContents";
import { RelatedArticles } from "@/components/mdx/RelatedArticles";
import { ArticleTracker } from "@/components/ArticleTracker";
import { ArticleCTA } from "@/components/ArticleCTA";
import { CTACard } from "@/components/mdx/CTACard";
import {
  Callout,
  ToolRecommendation,
  StepByStep,
  Step,
  ComparisonTable,
  QuoteBlock,
  CodeBlock,
  VideoEmbed,
  StatHighlight,
} from "@/components/mdx";

const mdxComponents = {
  Callout,
  ToolRecommendation,
  StepByStep,
  Step,
  ComparisonTable,
  QuoteBlock,
  CTACard,
  CodeBlock,
  VideoEmbed,
  StatHighlight,
};

// Derive a contextual money-page link for the sidebar CTA based on the
// article's category (and, for industry pieces, its slug/tags).
function getContextualLink(frontmatter: {
  category: string;
  slug: string;
  tags: string[];
}): { href: string; label: string } | null {
  const { category } = frontmatter;

  if (category === "industry") {
    const haystack = [frontmatter.slug, ...frontmatter.tags].join(" ").toLowerCase();
    if (/\blaw\b|legal|attorney|injury/.test(haystack)) {
      return { href: "/industries/law-firms", label: "See AI for law firms" };
    }
    if (/real[\s-]?estate|realtor|listing/.test(haystack)) {
      return {
        href: "/industries/real-estate",
        label: "See AI for real estate",
      };
    }
    if (/accountant|bookkeep|cpa|accounting/.test(haystack)) {
      return {
        href: "/industries/professional-services",
        label: "See AI for professional services",
      };
    }
    if (/contractor|home[\s-]?service|roofing|hvac|plumb/.test(haystack)) {
      return {
        href: "/industries/home-services",
        label: "See AI for home services",
      };
    }
    return { href: "/industries", label: "See what we build by industry" };
  }

  if (category === "automation") {
    return { href: "/services#automation", label: "See our automation systems" };
  }

  return { href: "/services", label: "See what we build" };
}

export function generateStaticParams() {
  // Include scheduled articles so pages are pre-built at deploy time.
  // They return notFound() until their date arrives, then ISR revalidates to live content.
  return getAllArticles({ includeScheduled: true }).map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: "Article Not Found" };

  const { frontmatter } = article;
  return seoMetadata({
    title: frontmatter.seoTitle || frontmatter.title,
    // article seoTitles are self-contained (and many carry their own "| …"
    // suffix) — skip the site template so they don't truncate in search
    absoluteTitle: true,
    description: frontmatter.seoDescription || frontmatter.excerpt,
    ogTitle: frontmatter.title,
    ogSubtitle: frontmatter.excerpt?.slice(0, 80),
    openGraph: {
      type: "article",
      publishedTime: frontmatter.date,
      modifiedTime: frontmatter.updatedDate || frontmatter.date,
      authors: [frontmatter.author],
      tags: frontmatter.tags,
    },
    alternates: {
      canonical: `https://www.acceleratewith.us/learn/${slug}`,
    },
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const relatedArticles = getRelatedArticles(slug, 3);
  const { frontmatter, content, readingTime, wordCount } = article;

  const contextualLink = getContextualLink({
    category: frontmatter.category,
    slug,
    tags: frontmatter.tags,
  });

  const { content: mdxContent } = await compileMDX({
    source: content,
    components: mdxComponents,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
      },
    },
  });

  const articleJsonLd = generateArticleJsonLd(frontmatter, readingTime, wordCount);
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Learning Hub", url: "/learn" },
    {
      name: CATEGORY_LABELS[frontmatter.category],
      url: `/learn/category/${frontmatter.category}`,
    },
    { name: frontmatter.title, url: `/learn/${slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <ArticleTracker
        slug={slug}
        category={frontmatter.category}
        funnelStage={frontmatter.funnelStage}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Article Hero Header                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="page-offset-roomy relative overflow-hidden pb-16 sm:pb-20">
        <div
          className="pointer-events-none absolute inset-x-0 top-28 h-px bg-[var(--rule)]"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-[80rem] px-6 lg:px-10">
          <EntranceGroup className="max-w-4xl" delay={0.04}>
            <EntranceItem>
              <nav className="mb-10 flex min-h-10 items-center gap-1.5 overflow-hidden font-mono text-[0.64rem] uppercase tracking-[0.12em] text-white-muted">
                <Link href="/learn" className="hover:text-white-secondary transition-colors">
                  Learn
                </Link>
                <ChevronRight className="h-3 w-3" />
                <Link
                  href={`/learn/category/${frontmatter.category}`}
                  className="hover:text-white-secondary transition-colors"
                >
                  {CATEGORY_LABELS[frontmatter.category]}
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="max-w-[180px] truncate text-white-secondary sm:max-w-[320px]">
                  {frontmatter.title}
                </span>
              </nav>
            </EntranceItem>

            <EntranceItem>
              <p className="mb-6 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
                {CATEGORY_LABELS[frontmatter.category]}
              </p>
            </EntranceItem>

            <EntranceItem>
              <h1 className="max-w-[19ch] text-balance font-display text-[clamp(2.65rem,6vw,5.75rem)] font-medium leading-[0.98] tracking-[-0.045em] text-heading">
                {frontmatter.title}
              </h1>
            </EntranceItem>

            <EntranceItem>
              <p className="mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-white-secondary sm:text-xl">
                {frontmatter.excerpt}
              </p>
            </EntranceItem>

            <EntranceItem>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-[var(--rule)] pt-6 text-sm text-white-muted">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center bg-[var(--fg)] text-[var(--bg)]">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight text-white-primary">
                      {frontmatter.author}
                    </p>
                    {frontmatter.authorRole && (
                      <p className="text-xs text-white-muted leading-tight">
                        {frontmatter.authorRole}
                      </p>
                    )}
                  </div>
                </div>
                <span className="hidden h-5 w-px bg-[var(--rule)] sm:block" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {formatDateOnly(frontmatter.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {readingTime}
                </span>
              </div>
            </EntranceItem>

            <EntranceItem>
              <div className="mt-5 flex flex-wrap gap-2">
                {frontmatter.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/learn/tag/${encodeURIComponent(tag)}`}
                    className="inline-flex min-h-10 items-center border border-[var(--rule)] px-3 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-white-muted transition-[color,border-color,transform] duration-200 hover:border-[var(--fg)] hover:text-heading active:scale-[0.96]"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </EntranceItem>
          </EntranceGroup>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Article Content + Sidebar                                           */}
      {/* ------------------------------------------------------------------ */}
      <article className="section-divide relative bg-bg-base pb-12 pt-12 sm:pt-16">
        <div className="mx-auto max-w-[80rem] px-6 lg:px-10">
          <div className="flex gap-16 xl:gap-24">
            {/* Main Content */}
            <div className="min-w-0 max-w-[46rem] flex-1">
              <AnimateOnScroll>
                <div data-article-content className="prose-dark">
                  {mdxContent}
                </div>
              </AnimateOnScroll>
            </div>

            {/* Sidebar */}
            <aside className="hidden w-72 shrink-0 lg:block">
              <AnimateOnScroll delay={0.12}>
                <div className="sticky top-28 space-y-6">
                  <TableOfContents />

                  {/* Sidebar CTA */}
                  <div className="glass-gold rounded-xl p-5 text-center">
                    <p className="text-sm font-medium text-white-primary mb-2">
                      Need help implementing this?
                    </p>
                    <p className="text-xs text-white-muted mb-4">
                      We build these systems for small businesses every day.
                    </p>
                    <ArticleCTA
                      slug={slug}
                      href="/contact"
                      variant="primary"
                      size="sm"
                      className="w-full"
                    >
                      Talk to Us
                    </ArticleCTA>
                    {contextualLink && (
                      <Link
                        href={contextualLink.href}
                        className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-medium text-gold-light hover:text-gold transition-colors"
                      >
                        {contextualLink.label}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </AnimateOnScroll>
            </aside>
          </div>
        </div>
      </article>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA — master style                                            */}
      {/* ------------------------------------------------------------------ */}
      <Section width="wide" divide>
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <Eyebrow className="mb-7">start</Eyebrow>
            <Heading size={1} as="h2">
              Ready to <span className="display-italic">accelerate?</span>
            </Heading>
          </div>
          <div className="flex flex-col gap-7">
            <p className="text-lg leading-relaxed text-white-secondary">
              Book a free 30-minute strategy call. We&apos;ll learn your business and tell you
              exactly where AI can drive growth. No pitch, no obligation.
            </p>
            <BookCallButton location="article" />
            <CallTerms />
          </div>
        </div>
      </Section>

      <SectionDivider variant="glow" />

      {/* ------------------------------------------------------------------ */}
      {/* Related Articles                                                    */}
      {/* ------------------------------------------------------------------ */}
      {relatedArticles.length > 0 && (
        <section className="py-20 bg-bg-base">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll>
              <RelatedArticles articles={relatedArticles} />
            </AnimateOnScroll>
          </div>
        </section>
      )}
    </>
  );
}

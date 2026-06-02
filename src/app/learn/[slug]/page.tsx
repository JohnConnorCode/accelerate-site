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
import {
  getAllArticles,
  getArticleBySlug,
  getRelatedArticles,
  CATEGORY_LABELS,
} from "@/lib/mdx";
import {
  generateArticleJsonLd,
  generateBreadcrumbJsonLd,
} from "@/lib/seo";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { Section, Eyebrow, Heading, BookCallButton } from "@/components/v2/studio/primitives";
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
    const haystack = [frontmatter.slug, ...frontmatter.tags]
      .join(" ")
      .toLowerCase();
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
      canonical: `https://acceleratewith.us/learn/${slug}`,
    },
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ],
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
      <section className="relative pt-24 pb-12 bg-[var(--bg-section-warm)] overflow-hidden">
        {/* Atmospheric glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.05)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <AnimateOnScroll>
            <nav className="mb-8 flex items-center gap-1.5 text-sm text-white-muted">
              <Link
                href="/learn"
                className="hover:text-white-secondary transition-colors"
              >
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
              <span className="text-white-secondary truncate max-w-[200px]">
                {frontmatter.title}
              </span>
            </nav>
          </AnimateOnScroll>

          {/* Article Header — staggered entrance */}
          <StaggerContainer className="max-w-3xl">
            <AnimateOnScroll>
              <p className="text-xs font-semibold uppercase tracking-wide text-gold mb-5">
                {CATEGORY_LABELS[frontmatter.category]}
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-heading leading-[1.1] tracking-[-0.02em]">
                {frontmatter.title}
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <p className="mt-5 text-lg sm:text-xl text-white-secondary leading-relaxed max-w-2xl">
                {frontmatter.excerpt}
              </p>
            </AnimateOnScroll>

            {/* Author & Meta */}
            <AnimateOnScroll>
              <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-white-muted">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[rgba(var(--accent-rgb),0.15)] border border-[rgba(var(--accent-rgb),0.3)] flex items-center justify-center">
                    <User className="w-4 h-4 text-gold-light" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white-primary leading-tight">
                      {frontmatter.author}
                    </p>
                    {frontmatter.authorRole && (
                      <p className="text-xs text-white-muted leading-tight">
                        {frontmatter.authorRole}
                      </p>
                    )}
                  </div>
                </div>
                <span className="hidden sm:block w-px h-4 bg-[var(--border-glass)]" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(frontmatter.date).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime}
                </span>
              </div>
            </AnimateOnScroll>

            {/* Tags */}
            <AnimateOnScroll>
              <div className="mt-5 flex flex-wrap gap-2">
                {frontmatter.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/learn/tag/${encodeURIComponent(tag)}`}
                    className="rounded-full glass px-3 py-1 text-xs text-white-muted hover:text-white-secondary hover:border-border-gold transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </AnimateOnScroll>
          </StaggerContainer>
        </div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, transparent, var(--bg-base))",
          }}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Article Content + Sidebar                                           */}
      {/* ------------------------------------------------------------------ */}
      <article className="relative pb-8 bg-bg-base">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-12">
            {/* Main Content */}
            <div className="flex-1 min-w-0 max-w-[720px]">
              {/* Gold accent line */}
              <AnimateOnScroll>
                <div className="h-px w-16 bg-gold mb-10" />
              </AnimateOnScroll>

              <AnimateOnScroll>
                <div
                  data-article-content
                  className="prose-dark"
                >
                  {mdxContent}
                </div>
              </AnimateOnScroll>
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
              <AnimateOnScroll delay={0.2}>
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
                    <ArticleCTA slug={slug} href="/contact" variant="primary" size="sm" className="w-full">
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
              Book a free 30-minute strategy call. We&apos;ll learn your
              business and tell you exactly where AI can drive growth. No
              pitch, no obligation.
            </p>
            <BookCallButton />
            <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-glass pt-6 font-mono text-xs uppercase tracking-[0.15em] text-white-muted">
              <span>Free</span><span>·</span>
              <span>30 minutes</span><span>·</span>
              <span>No obligation</span><span>·</span>
              <span>Direct to the founder</span>
            </div>
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

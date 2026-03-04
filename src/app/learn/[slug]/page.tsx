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
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionDivider } from "@/components/ui/SectionDivider";
import {
  AnimateOnScroll,
  StaggerContainer,
} from "@/components/ui/AnimateOnScroll";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
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

export function generateStaticParams() {
  return getAllArticles().map((article) => ({
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
      <section className="relative pt-28 pb-16 bg-[var(--bg-section-warm)] overflow-hidden">
        {/* Atmospheric glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.05)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <AnimateOnScroll>
            <nav className="mb-8 flex items-center gap-1.5 text-sm text-[var(--white-muted)]">
              <Link
                href="/learn"
                className="hover:text-[var(--white-secondary)] transition-colors"
              >
                Learn
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link
                href={`/learn/category/${frontmatter.category}`}
                className="hover:text-[var(--white-secondary)] transition-colors"
              >
                {CATEGORY_LABELS[frontmatter.category]}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[var(--white-secondary)] truncate max-w-[200px]">
                {frontmatter.title}
              </span>
            </nav>
          </AnimateOnScroll>

          {/* Article Header — staggered entrance */}
          <StaggerContainer className="max-w-3xl">
            <AnimateOnScroll>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold-base)] mb-5">
                {CATEGORY_LABELS[frontmatter.category]}
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--heading-color)] leading-[1.1] tracking-[-0.02em]">
                {frontmatter.title}
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll>
              <p className="mt-5 text-lg sm:text-xl text-[var(--white-secondary)] leading-relaxed max-w-2xl">
                {frontmatter.excerpt}
              </p>
            </AnimateOnScroll>

            {/* Author & Meta */}
            <AnimateOnScroll>
              <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-[var(--white-muted)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[rgba(var(--accent-rgb),0.15)] border border-[rgba(var(--accent-rgb),0.3)] flex items-center justify-center">
                    <User className="w-4 h-4 text-[var(--gold-light)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--white-primary)] leading-tight">
                      {frontmatter.author}
                    </p>
                    {frontmatter.authorRole && (
                      <p className="text-xs text-[var(--white-muted)] leading-tight">
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
                    className="rounded-full glass px-3 py-1 text-xs text-[var(--white-muted)] hover:text-[var(--white-secondary)] hover:border-[var(--border-gold)] transition-colors"
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
      <article className="relative pb-8 bg-[var(--bg-base)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex gap-12">
            {/* Main Content */}
            <div className="flex-1 min-w-0 max-w-[720px]">
              {/* Gold accent line */}
              <AnimateOnScroll>
                <div className="h-px w-16 bg-[var(--gold-base)] mb-10" />
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
                    <p className="text-sm font-medium text-[var(--white-primary)] mb-2">
                      Need help implementing this?
                    </p>
                    <p className="text-xs text-[var(--white-muted)] mb-4">
                      We build these systems for small businesses every day.
                    </p>
                    <ArticleCTA slug={slug} href="/contact" variant="primary" size="sm" className="w-full">
                      Talk to Us
                    </ArticleCTA>
                  </div>
                </div>
              </AnimateOnScroll>
            </aside>
          </div>
        </div>
      </article>

      <SectionDivider variant="fade" />

      {/* ------------------------------------------------------------------ */}
      {/* Bottom CTA                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 bg-[var(--bg-section-warm)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full bg-radial from-[rgba(var(--accent-rgb),0.06)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="clip-reveal">
            <GlassCard variant="gold" padding="none" className="text-center">
              <div className="p-8 sm:p-12">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">
                  Ready to Accelerate{" "}
                  <span className="text-gold-gradient">Your Growth?</span>
                </h2>
                <p className="text-[var(--white-secondary)] max-w-md mx-auto mb-8">
                  Get a personalized AI growth plan based on your specific
                  industry and goals. Takes under 5 minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <ArticleCTA slug={slug} href="/plan-builder" variant="primary" size="lg" className="w-full sm:w-auto">
                    Get Your Free Growth Plan
                  </ArticleCTA>
                  <ArticleCTA slug={slug} href="/contact" variant="secondary" size="lg" className="w-full sm:w-auto">
                    Book a Strategy Call
                  </ArticleCTA>
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      <SectionDivider variant="glow" />

      {/* ------------------------------------------------------------------ */}
      {/* Related Articles                                                    */}
      {/* ------------------------------------------------------------------ */}
      {relatedArticles.length > 0 && (
        <section className="py-20 bg-[var(--bg-base)]">
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

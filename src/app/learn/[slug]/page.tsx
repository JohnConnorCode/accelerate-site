import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import Link from "next/link";
import { ChevronRight, Clock, Calendar } from "lucide-react";
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
import { TableOfContents } from "@/components/mdx/TableOfContents";
import { RelatedArticles } from "@/components/mdx/RelatedArticles";
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

      <article className="relative pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-6">
          {/* Breadcrumbs */}
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

          <div className="flex gap-10">
            {/* Main Content */}
            <div className="flex-1 min-w-0 max-w-[720px]">
              {/* Header */}
              <header className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <Link
                    href={`/learn/category/${frontmatter.category}`}
                    className="text-xs font-semibold uppercase tracking-wider text-gold-light hover:text-gold-champagne transition-colors"
                  >
                    {CATEGORY_LABELS[frontmatter.category]}
                  </Link>
                </div>
                <h1 className="font-display text-3xl font-bold text-white-primary md:text-4xl leading-tight">
                  {frontmatter.title}
                </h1>
                <p className="mt-4 text-lg text-white-secondary">
                  {frontmatter.excerpt}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white-muted">
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
                  <span>By {frontmatter.author}</span>
                </div>
                {/* Tags */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {frontmatter.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/learn/tag/${encodeURIComponent(tag)}`}
                      className="rounded-full glass px-3 py-1 text-xs text-white-muted hover:text-white-secondary transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </header>

              {/* Article Content */}
              <div
                data-article-content
                className="prose-dark"
              >
                {mdxContent}
              </div>

              {/* Bottom CTA */}
              <CTACard
                title="Ready to accelerate your business?"
                description="Get a personalized AI growth plan based on your specific industry and goals."
              />

              {/* Related Articles */}
              <RelatedArticles articles={relatedArticles} />
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-28">
                <TableOfContents />
              </div>
            </aside>
          </div>
        </div>
      </article>
    </>
  );
}

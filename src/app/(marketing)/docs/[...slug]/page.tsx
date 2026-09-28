import { RecipeIngredients, RecipeIndex } from "@/components/command-center/WorkflowRecipes";
import { DocsFigure } from "@/components/docs/DocsFigure";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { Calendar, ChevronLeft } from "lucide-react";
import { getAllDocsParams, getDocsPage } from "@/lib/docs";
import { seoMetadata } from "@/lib/og";
import { formatDateOnly } from "@/lib/date-format";
import { TableOfContents } from "@/components/mdx/TableOfContents";
import { DocsPager } from "@/components/docs/DocsNav";
import { Callout, CodeBlock, ComparisonTable, QuoteBlock } from "@/components/mdx";
import { DocsCapabilityCatalog } from "@/components/docs/DocsCapabilityCatalog";
import { DocsApprovalLoop } from "@/components/docs/DocsApprovalLoop";
import { DocsAiToolCatalog } from "@/components/docs/DocsAiToolCatalog";
import { DocsSteps, DocsStep } from "@/components/docs/DocsSteps";
import styles from "@/components/docs/docs.module.css";

// Docs prose stays reference-dense: explanatory components only. Conversion
// components (CTACard, ToolRecommendation, booking CTAs) are deliberately
// absent. A docs page ending in a booking call reads as marketing.
const docsComponents = {
  RecipeIngredients,
  RecipeIndex,
  DocsFigure,
  Callout,
  CodeBlock,
  ComparisonTable,
  QuoteBlock,
  StepByStep: DocsSteps,
  Step: DocsStep,
  DocsCapabilityCatalog,
  DocsApprovalLoop,
  DocsAiToolCatalog,
};

export function generateStaticParams() {
  return getAllDocsParams().filter((params) => params.slug && params.slug.length > 0);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page) return { title: "Docs page not found" };
  return seoMetadata({
    title: page.frontmatter.title,
    description: page.frontmatter.description,
    path: `/docs/${page.entry.slug.join("/")}`,
  });
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page) notFound();
  const isSectionOverview = page.entry === page.section.pages[0];

  const { content: mdxContent } = await compileMDX({
    source: page.content,
    components: docsComponents,
    options: {
      parseFrontmatter: false,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
      },
    },
  });

  return (
    <article className={styles.guide}>
      <Link
        href={isSectionOverview ? "/docs" : `/docs/${page.section.id}`}
        className={`${styles.backLink} mb-5 inline-flex min-h-10 items-center gap-1.5 text-sm text-white-muted`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {isSectionOverview ? "All docs" : page.section.title}
      </Link>
      <h1
        className={`${styles.guideTitle} max-w-[22ch] text-balance font-display font-medium text-heading`}
      >
        {page.frontmatter.title}
      </h1>
      <p
        className={`${styles.guideLede} mt-4 max-w-2xl text-pretty leading-relaxed text-white-secondary`}
      >
        {page.frontmatter.description}
      </p>
      <p
        className={`${styles.guideMeta} mt-5 flex flex-wrap items-center gap-1.5 text-sm text-white-muted`}
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
        Updated{" "}
        {formatDateOnly(page.frontmatter.updated, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        <span aria-hidden="true">·</span> {page.readingTime}
      </p>

      <div data-docs-body className="mt-10 flex gap-10 xl:gap-12">
        <div className="min-w-0 flex-1">
          <div data-docs-content className="prose-docs">
            {mdxContent}
          </div>
          <DocsPager slug={page.entry.slug} />
        </div>
        <aside className="hidden w-60 shrink-0 xl:block">
          <div className="sticky top-28">
            <TableOfContents selector="[data-docs-content]" />
          </div>
        </aside>
      </div>
    </article>
  );
}

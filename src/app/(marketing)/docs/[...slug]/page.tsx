import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { Calendar } from "lucide-react";
import { getAllDocsParams, getDocsPage } from "@/lib/docs";
import { seoMetadata } from "@/lib/og";
import { formatDateOnly } from "@/lib/date-format";
import { TableOfContents } from "@/components/mdx/TableOfContents";
import { DocsBreadcrumbs, DocsPager } from "@/components/docs/DocsNav";
import {
  Callout,
  CodeBlock,
  ComparisonTable,
  QuoteBlock,
  StepByStep,
  Step,
} from "@/components/mdx";

// Docs prose stays reference-dense: explanatory components only. Conversion
// components (CTACard, ToolRecommendation, booking CTAs) are deliberately
// absent — a docs page ending in a booking call reads as marketing.
const docsComponents = {
  Callout,
  CodeBlock,
  ComparisonTable,
  QuoteBlock,
  StepByStep,
  Step,
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
    alternates: { canonical: `https://www.acceleratewith.us/docs/${page.entry.slug.join("/")}` },
  });
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = getDocsPage(slug);
  if (!page) notFound();

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
    <>
      <DocsBreadcrumbs items={page.breadcrumbs} />
      <p className="mb-4 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-white-muted">
        {page.section.title}
      </p>
      <h1 className="max-w-[22ch] text-balance font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.04] tracking-[-0.04em] text-heading">
        {page.frontmatter.title}
      </h1>
      <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-white-secondary">
        {page.frontmatter.description}
      </p>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-white-muted">
        <Calendar className="h-4 w-4" aria-hidden="true" />
        Updated {formatDateOnly(page.frontmatter.updated, { month: "long", day: "numeric", year: "numeric" })}
        <span aria-hidden="true">·</span> {page.readingTime}
      </p>

      <div className="mt-10 flex gap-12">
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
    </>
  );
}

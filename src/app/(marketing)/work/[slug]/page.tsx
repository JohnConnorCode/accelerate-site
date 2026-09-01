import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/work/CaseStudy";
import { getWorkBySlug, workProjects } from "@/content/work";
import { generateBreadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return workProjects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = getWorkBySlug((await params).slug);
  if (!project) return {};
  const path = `/work/${project.slug}`;
  return {
    title: project.seoTitle,
    description: project.seoDescription,
    alternates: { canonical: path },
    robots:
      project.visibility === "archived"
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: {
      title: `${project.seoTitle} | Accelerate`,
      description: project.seoDescription,
      url: path,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: project.seoTitle,
      description: project.seoDescription,
    },
  };
}

export default async function WorkCasePage({ params }: Props) {
  const project = getWorkBySlug((await params).slug);
  if (!project) notFound();
  const breadcrumb = generateBreadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Work", url: "/work" },
    { name: project.name, url: `/work/${project.slug}` },
  ]);
  const creativeWork = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.name,
    description: project.cardDescription,
    url: `https://www.acceleratewith.us/work/${project.slug}`,
    publisher: { "@id": "https://www.acceleratewith.us/#organization" },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWork) }}
      />
      <CaseStudy project={project} />
    </>
  );
}

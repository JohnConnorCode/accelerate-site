import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import {
  docsManifest,
  flattenDocsPages,
  type DocsPageEntry,
  type DocsSection,
} from "@/content/docs/manifest";

const DOCS_DIR = path.join(process.cwd(), "src/content/docs");

export interface DocsFrontmatter {
  title: string;
  description: string;
  updated: string;
}

export interface DocsPage {
  entry: DocsPageEntry;
  section: DocsSection;
  frontmatter: DocsFrontmatter;
  content: string;
  readingTime: string;
  breadcrumbs: Array<{ title: string; href: string }>;
  prev: DocsPageEntry | null;
  next: DocsPageEntry | null;
}

function pageFile(slug: string[]): string {
  return path.join(DOCS_DIR, ...slug) + ".mdx";
}

/**
 * Resolve URL slug parts to a manifest page. Exact matches win; a bare
 * section slug (or any leading prefix of a page slug) collapses to that
 * section's overview, which is always its first page by manifest convention.
 */
export function resolveDocsEntry(parts: string[]): DocsPageEntry | null {
  const pages = flattenDocsPages();
  const exact = pages.find(
    (page) => page.slug.length === parts.length && page.slug.every((part, i) => part === parts[i]),
  );
  if (exact) return exact;
  for (const section of docsManifest) {
    if (section.pages.some((page) => parts.every((part, i) => page.slug[i] === part))) {
      return section.pages[0] ?? null;
    }
  }
  const bySection = docsManifest.find((section) => section.id === parts.join("/"));
  return bySection?.pages[0] ?? null;
}

export function getDocsPage(parts: string[]): DocsPage | null {
  const entry = resolveDocsEntry(parts);
  if (!entry) return null;
  const file = pageFile(entry.slug);
  if (!fs.existsSync(file)) return null;
  const { data, content } = matter(fs.readFileSync(file, "utf-8"));
  const section = docsManifest.find((s) => s.pages.includes(entry))!;
  const pages = flattenDocsPages();
  const index = pages.indexOf(entry);
  const sectionHref = `/docs/${section.id}`;
  return {
    entry,
    section,
    frontmatter: {
      title: String(data.title ?? entry.title),
      description: String(data.description ?? entry.description),
      updated: String(data.updated ?? ""),
    },
    content,
    readingTime: readingTime(content).text,
    breadcrumbs: [
      { title: "Docs", href: "/docs" },
      { title: section.title, href: sectionHref },
      ...(entry.slug.length > 1 || entry.title !== section.title
        ? [{ title: entry.title, href: `/docs/${entry.slug.join("/")}` }]
        : []),
    ],
    prev: index > 0 ? (pages[index - 1] ?? null) : null,
    next: index < pages.length - 1 ? (pages[index + 1] ?? null) : null,
  };
}

/** Every URL the docs serve: the landing (handled by page.tsx), each section
 *  root (collapsed to its overview), and each page. */
export function getAllDocsParams(): Array<{ slug?: string[] }> {
  const params: Array<{ slug?: string[] }> = [];
  for (const section of docsManifest) {
    params.push({ slug: [section.id] });
    for (const page of section.pages) {
      if (page.slug.join("/") !== section.id) params.push({ slug: page.slug });
    }
  }
  return params;
}

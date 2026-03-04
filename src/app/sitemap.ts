export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { caseStudies } from "@/content/case-studies";
import { getAllArticles, getAllCategories, getAllTags } from "@/lib/mdx";

const BASE_URL = "https://acceleratewith.us";

// Last significant content/design update date for static pages
const LAST_CONTENT_UPDATE = "2026-04-02";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: { path: string; priority: number; freq: "weekly" | "monthly"; lastMod?: string }[] = [
    { path: "", priority: 1, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/services", priority: 0.9, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/packages", priority: 0.9, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/results", priority: 0.8, freq: "weekly", lastMod: "2026-02-01" },
    { path: "/tools/website-grader", priority: 0.8, freq: "monthly", lastMod: "2026-01-15" },
    { path: "/tools/roi-calculator", priority: 0.8, freq: "monthly", lastMod: "2026-01-15" },
    { path: "/tools", priority: 0.7, freq: "monthly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/plan-builder", priority: 0.8, freq: "monthly", lastMod: "2026-01-15" },
    { path: "/resources", priority: 0.7, freq: "monthly", lastMod: "2026-02-01" },
    { path: "/industries", priority: 0.7, freq: "monthly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/industries/home-services", priority: 0.8, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/industries/law-firms", priority: 0.8, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/industries/professional-services", priority: 0.8, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/industries/real-estate", priority: 0.8, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/about", priority: 0.7, freq: "monthly", lastMod: "2026-02-01" },
    { path: "/contact", priority: 0.7, freq: "monthly", lastMod: "2026-01-15" },
    { path: "/learn", priority: 0.8, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/partners", priority: 0.5, freq: "monthly", lastMod: "2026-01-10" },
    { path: "/changelog", priority: 0.4, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/privacy", priority: 0.3, freq: "monthly", lastMod: "2025-12-01" },
    { path: "/terms", priority: 0.3, freq: "monthly", lastMod: "2025-12-01" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, freq, lastMod }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(lastMod || LAST_CONTENT_UPDATE),
    changeFrequency: freq,
    priority,
  }));

  // Dynamic case study pages
  const caseStudyEntries: MetadataRoute.Sitemap = caseStudies.map((cs) => ({
    url: `${BASE_URL}/results/${cs.slug}`,
    lastModified: new Date(cs.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Learning Hub articles
  const articleEntries: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${BASE_URL}/learn/${article.slug}`,
    lastModified: new Date(article.frontmatter.updatedDate || article.frontmatter.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Learning Hub categories
  const categoryEntries: MetadataRoute.Sitemap = getAllCategories().map(({ category }) => ({
    url: `${BASE_URL}/learn/category/${category}`,
    lastModified: new Date(LAST_CONTENT_UPDATE),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Learning Hub tags
  const tagEntries: MetadataRoute.Sitemap = getAllTags().map(({ tag }) => ({
    url: `${BASE_URL}/learn/tag/${encodeURIComponent(tag)}`,
    lastModified: new Date(LAST_CONTENT_UPDATE),
    changeFrequency: "weekly" as const,
    priority: 0.4,
  }));

  return [...staticEntries, ...caseStudyEntries, ...articleEntries, ...categoryEntries, ...tagEntries];
}

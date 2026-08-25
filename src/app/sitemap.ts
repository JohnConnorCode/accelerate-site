export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { getAllArticles, getAllCategories, getAllTags } from "@/lib/mdx";
import { verticals } from "@/content/verticals";
import { publicWorkProjects } from "@/content/work";

const BASE_URL = "https://www.acceleratewith.us";

// Last significant content/design update date for static pages
// Must not be a future date — Google penalizes sitemaps with future lastModified
const LAST_CONTENT_UPDATE = "2026-03-06";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: { path: string; priority: number; freq: "weekly" | "monthly"; lastMod?: string }[] = [
    { path: "", priority: 1, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/services", priority: 0.9, freq: "monthly", lastMod: "2026-02-15" },
    { path: "/command-center", priority: 0.9, freq: "monthly", lastMod: "2026-08-15" },
    { path: "/roofing", priority: 0.9, freq: "monthly", lastMod: "2026-08-16" },
    { path: "/resources", priority: 0.7, freq: "monthly", lastMod: "2026-02-01" },
    { path: "/industries", priority: 0.7, freq: "monthly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/work", priority: 0.85, freq: "monthly", lastMod: LAST_CONTENT_UPDATE },
    ...publicWorkProjects.map((project) => ({ path: `/work/${project.slug}`, priority: 0.75, freq: "monthly" as const, lastMod: LAST_CONTENT_UPDATE })),
    // Derived from the vertical manifest rather than listed by hand. The
    // hardcoded version silently omitted a live landing page, so a new
    // industry could ship and never be discoverable.
    ...verticals.map((vertical) => ({
      path: `/industries/${vertical.slug}`,
      priority: 0.8,
      freq: "monthly" as const,
      lastMod: LAST_CONTENT_UPDATE,
    })),
    { path: "/about", priority: 0.7, freq: "monthly", lastMod: "2026-02-01" },
    { path: "/contact", priority: 0.7, freq: "monthly", lastMod: "2026-01-15" },
    { path: "/learn", priority: 0.8, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/partners", priority: 0.5, freq: "monthly", lastMod: "2026-01-10" },
    { path: "/changelog", priority: 0.4, freq: "weekly", lastMod: LAST_CONTENT_UPDATE },
    { path: "/privacy", priority: 0.3, freq: "monthly", lastMod: "2025-12-01" },
    { path: "/terms", priority: 0.3, freq: "monthly", lastMod: "2025-12-01" },
  ];

  // Fetch all published articles once
  const articles = getAllArticles();
  const latestArticleDate = articles[0]
    ? (articles[0].frontmatter.updatedDate || articles[0].frontmatter.date)
    : LAST_CONTENT_UPDATE;

  const staticEntries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, freq, lastMod }) => ({
    url: `${BASE_URL}${path}`,
    // /learn page lastMod tracks the most recent published article
    lastModified: new Date(path === "/learn" ? latestArticleDate : (lastMod || LAST_CONTENT_UPDATE)),
    changeFrequency: freq,
    priority,
  }));

  // Learning Hub articles
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/learn/${article.slug}`,
    lastModified: new Date(article.frontmatter.updatedDate || article.frontmatter.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  const categoryEntries: MetadataRoute.Sitemap = getAllCategories().map(({ category }) => {
    const latest = articles.find((a) => a.frontmatter.category === category);
    return {
      url: `${BASE_URL}/learn/category/${category}`,
      lastModified: latest
        ? new Date(latest.frontmatter.updatedDate || latest.frontmatter.date)
        : new Date(LAST_CONTENT_UPDATE),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    };
  });

  // Learning Hub tags — only include tags with >= 2 articles. Thin tags
  // (< 2) are noindex on the page itself (see learn/tag/[tag]/page.tsx), so
  // listing them here would submit noindex URLs to Google — contradictory
  // signals that waste crawl budget and trigger Search Console warnings.
  const tagEntries: MetadataRoute.Sitemap = getAllTags()
    .map(({ tag }) => ({
      tag,
      matched: articles.filter((a) => a.frontmatter.tags.includes(tag)),
    }))
    .filter(({ matched }) => matched.length >= 2)
    .map(({ tag, matched }) => ({
      url: `${BASE_URL}/learn/tag/${encodeURIComponent(tag)}`,
      lastModified: new Date(
        matched[0]!.frontmatter.updatedDate || matched[0]!.frontmatter.date
      ),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    }));

  return [...staticEntries, ...articleEntries, ...categoryEntries, ...tagEntries];
}

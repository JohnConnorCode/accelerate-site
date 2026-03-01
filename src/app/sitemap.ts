import type { MetadataRoute } from "next";
import { caseStudies } from "@/content/case-studies";
import { getAllArticles, getAllCategories } from "@/lib/mdx";

const BASE_URL = "https://acceleratewith.us";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: { path: string; priority: number; freq: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, freq: "weekly" },
    { path: "/services", priority: 0.9, freq: "monthly" },
    { path: "/packages", priority: 0.9, freq: "monthly" },
    { path: "/results", priority: 0.8, freq: "weekly" },
    { path: "/tools/website-grader", priority: 0.8, freq: "monthly" },
    { path: "/tools/roi-calculator", priority: 0.8, freq: "monthly" },
    { path: "/resources", priority: 0.7, freq: "monthly" },
    { path: "/industries/home-services", priority: 0.8, freq: "monthly" },
    { path: "/industries/law-firms", priority: 0.8, freq: "monthly" },
    { path: "/industries/professional-services", priority: 0.8, freq: "monthly" },
    { path: "/industries/real-estate", priority: 0.8, freq: "monthly" },
    { path: "/about", priority: 0.6, freq: "monthly" },
    { path: "/contact", priority: 0.7, freq: "monthly" },
    { path: "/learn", priority: 0.7, freq: "weekly" },
    { path: "/partners", priority: 0.5, freq: "monthly" },
    { path: "/changelog", priority: 0.4, freq: "weekly" },
    { path: "/privacy", priority: 0.3, freq: "monthly" },
    { path: "/terms", priority: 0.3, freq: "monthly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, freq }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
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
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...caseStudyEntries, ...articleEntries, ...categoryEntries];
}

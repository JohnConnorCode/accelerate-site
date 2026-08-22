import "server-only";
import { getAllArticles } from "@/lib/mdx";
import { CATEGORY_LABELS } from "@/lib/constants";
import { verticals } from "@/content/verticals";
import { services } from "@/content/services";
import { packages } from "@/content/packages";
import { changelogEntries } from "@/content/changelog";

/**
 * One index for site search.
 *
 * Built from the same content the pages render, so a page cannot be searchable
 * and stale, or shipped and unfindable. The nonprofits page existed and was live
 * for a day while being reachable from nowhere, because three separate hand
 * written lists all had to be remembered. Nothing here is hand written.
 */
export type SearchGroup = "Articles" | "Industries" | "Services" | "Packages" | "Pages" | "Changelog";

export interface SearchEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  group: SearchGroup;
  /** Extra text matched against but not displayed: tags, keywords, synonyms. */
  keywords: string[];
  /** ISO date where the content has one, for recency tie-breaking. */
  date?: string;
}

/** Pages with no content collection behind them. */
const STATIC_PAGES: Array<Omit<SearchEntry, "group">> = [
  { id: "page-home", title: "Home", description: "The embedded AI operations team that books more work and keeps every customer followed up.", href: "/", keywords: ["home", "start", "accelerate"] },
  { id: "page-services", title: "Services", description: "What we build and run for you across the full revenue lifecycle.", href: "/services", keywords: ["what you do", "offering", "capabilities"] },
  { id: "page-command-center", title: "Command Center", description: "The operating surface we build and run alongside your team.", href: "/command-center", keywords: ["dashboard", "admin", "operations", "software"] },
  { id: "page-packages", title: "Packages", description: "How engagements are scoped and what each level includes.", href: "/packages", keywords: ["pricing", "cost", "how much", "plans", "tiers"] },
  { id: "page-results", title: "Results", description: "Work we have done and what it changed.", href: "/results", keywords: ["case studies", "clients", "proof", "portfolio"] },
  { id: "page-learn", title: "Learn", description: "Guides on AI operations, automation, and revenue systems.", href: "/learn", keywords: ["blog", "articles", "guides", "library", "resources"] },
  { id: "page-about", title: "About", description: "Who we are and how we work.", href: "/about", keywords: ["team", "founder", "story", "who"] },
  { id: "page-contact", title: "Contact", description: "Book a free strategy session or send us a note.", href: "/contact", keywords: ["book", "call", "demo", "talk", "get in touch", "schedule", "meeting"] },
  { id: "page-plan-builder", title: "Plan Builder", description: "Answer a few questions and get a recommended plan.", href: "/plan-builder", keywords: ["quote", "recommendation", "build a plan", "tool"] },
  { id: "page-resources", title: "Resources", description: "Downloadable guides and templates.", href: "/resources", keywords: ["downloads", "templates", "guides", "free"] },
  { id: "page-partners", title: "Partners", description: "Partner with us.", href: "/partners", keywords: ["referral", "agency", "affiliate"] },
  { id: "page-industries", title: "Industries", description: "How this works in your specific line of business.", href: "/industries", keywords: ["verticals", "sectors", "who you work with"] },
  { id: "page-changelog", title: "Changelog", description: "What we have shipped recently.", href: "/changelog", keywords: ["updates", "releases", "news", "what is new"] },
];

let cached: SearchEntry[] | null = null;

export function buildSearchIndex(): SearchEntry[] {
  if (cached) return cached;

  const entries: SearchEntry[] = [];

  for (const article of getAllArticles()) {
    entries.push({
      id: `article-${article.slug}`,
      title: article.frontmatter.title,
      description: article.frontmatter.excerpt,
      href: `/learn/${article.slug}`,
      group: "Articles",
      keywords: [
        ...article.frontmatter.tags,
        ...article.frontmatter.targetKeywords,
        CATEGORY_LABELS[article.frontmatter.category] ?? article.frontmatter.category,
      ],
      date: article.frontmatter.date,
    });
  }

  for (const vertical of verticals) {
    entries.push({
      id: `industry-${vertical.slug}`,
      title: vertical.name,
      description: vertical.shortDescription,
      href: `/industries/${vertical.slug}`,
      group: "Industries",
      keywords: ["industry", "vertical", vertical.name, ...vertical.painPoints.slice(0, 3).map((point) => point.title)],
    });
  }

  for (const service of services) {
    entries.push({
      id: `service-${service.id}`,
      title: service.name,
      description: service.shortDescription,
      href: service.href || "/services",
      group: "Services",
      keywords: ["service", service.name, ...service.deliverables.slice(0, 4)],
    });
  }

  for (const pkg of packages) {
    entries.push({
      id: `package-${pkg.id}`,
      title: pkg.name,
      description: pkg.description,
      href: `/packages#${pkg.slug}`,
      group: "Packages",
      keywords: ["package", "pricing", "plan", pkg.tagline, pkg.name],
    });
  }

  for (const page of STATIC_PAGES) {
    entries.push({ ...page, group: "Pages" });
  }

  // Only the most recent changelog entries; the whole history would drown
  // everything else in a query like "campaign".
  for (const entry of changelogEntries.slice(0, 12)) {
    entries.push({
      id: `changelog-${entry.id}`,
      title: entry.title,
      description: entry.description,
      href: "/changelog",
      group: "Changelog",
      keywords: ["changelog", "update", "release", entry.category],
      date: entry.publishedAt,
    });
  }

  cached = entries;
  return entries;
}

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { Article, ArticleFrontmatter, ArticleCategory, ArticleSummary } from "./types";

const ARTICLES_DIR = path.join(process.cwd(), "src/content/articles");

function getArticleFiles(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith(".mdx"));
}

function parseArticle(filename: string): Article {
  const filePath = path.join(ARTICLES_DIR, filename);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const stats = readingTime(content);
  const slug = filename.replace(/\.mdx$/, "");

  return {
    frontmatter: {
      ...data,
      slug,
    } as ArticleFrontmatter,
    slug,
    content,
    readingTime: stats.text,
    wordCount: stats.words,
  };
}

/** Today's date as YYYY-MM-DD, timezone-independent. */
function todayDateStr(): string {
  const now = new Date();
  // Use UTC to match how JS parses date-only strings ("2026-03-07" → UTC midnight)
  return now.toISOString().slice(0, 10);
}

export function getAllArticles(options?: { includeScheduled?: boolean }): Article[] {
  const files = getArticleFiles();
  const today = todayDateStr();

  return files
    .map(parseArticle)
    .filter((article) => {
      if (options?.includeScheduled) return true;
      return article.frontmatter.date <= today;
    })
    .sort(
      (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime(),
    );
}

export function toArticleSummary(article: Article): ArticleSummary {
  return {
    frontmatter: article.frontmatter,
    slug: article.slug,
    readingTime: article.readingTime,
    wordCount: article.wordCount,
  };
}

export function getArticleSummaries(options?: { includeScheduled?: boolean }): ArticleSummary[] {
  return getAllArticles(options).map(toArticleSummary);
}

export function getArticleBySlug(slug: string): Article | null {
  const filename = `${slug}.mdx`;
  const filePath = path.join(ARTICLES_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const article = parseArticle(filename);

  // Don't return articles scheduled for future dates
  if (article.frontmatter.date > todayDateStr()) return null;

  return article;
}

export function getArticlesByCategory(category: ArticleCategory): ArticleSummary[] {
  return getAllArticles()
    .filter((article) => article.frontmatter.category === category)
    .map(toArticleSummary);
}

export function getArticlesByTag(tag: string): ArticleSummary[] {
  return getAllArticles()
    .filter((article) => article.frontmatter.tags.includes(tag))
    .map(toArticleSummary);
}

export function getAllCategories(options?: {
  includeScheduled?: boolean;
}): { category: ArticleCategory; count: number }[] {
  const articles = getAllArticles(options);
  const categoryCounts = new Map<ArticleCategory, number>();
  for (const article of articles) {
    const cat = article.frontmatter.category;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  return Array.from(categoryCounts.entries()).map(([category, count]) => ({
    category,
    count,
  }));
}

export function getAllTags(options?: {
  includeScheduled?: boolean;
}): { tag: string; count: number }[] {
  const articles = getAllArticles(options);
  const tagCounts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.frontmatter.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function getRelatedArticles(slug: string, limit = 3): ArticleSummary[] {
  const article = getArticleBySlug(slug);
  if (!article) return [];

  const allArticles = getAllArticles().filter((a) => a.slug !== slug);

  const scored = allArticles.map((a) => {
    let score = 0;
    if (a.frontmatter.category === article.frontmatter.category) score += 3;
    if (a.frontmatter.pillar === article.frontmatter.pillar) score += 2;
    const sharedTags = a.frontmatter.tags.filter((t) => article.frontmatter.tags.includes(t));
    score += sharedTags.length;
    return { article: a, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => toArticleSummary(s.article));
}

// Re-export from shared constants to avoid circular imports
export { CATEGORY_LABELS } from "./constants";

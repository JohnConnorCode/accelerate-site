import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { Article, ArticleFrontmatter, ArticleCategory } from "./types";

const ARTICLES_DIR = path.join(process.cwd(), "src/content/articles");

function getArticleFiles(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith(".mdx"));
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

export function getAllArticles(): Article[] {
  const files = getArticleFiles();
  return files
    .map(parseArticle)
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date).getTime() -
        new Date(a.frontmatter.date).getTime()
    );
}

export function getArticleBySlug(slug: string): Article | null {
  const filename = `${slug}.mdx`;
  const filePath = path.join(ARTICLES_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  return parseArticle(filename);
}

export function getArticlesByCategory(category: ArticleCategory): Article[] {
  return getAllArticles().filter(
    (article) => article.frontmatter.category === category
  );
}

export function getArticlesByTag(tag: string): Article[] {
  return getAllArticles().filter((article) =>
    article.frontmatter.tags.includes(tag)
  );
}

export function getAllCategories(): { category: ArticleCategory; count: number }[] {
  const articles = getAllArticles();
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

export function getAllTags(): { tag: string; count: number }[] {
  const articles = getAllArticles();
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

export function getRelatedArticles(slug: string, limit = 3): Article[] {
  const article = getArticleBySlug(slug);
  if (!article) return [];

  const allArticles = getAllArticles().filter((a) => a.slug !== slug);

  const scored = allArticles.map((a) => {
    let score = 0;
    if (a.frontmatter.category === article.frontmatter.category) score += 3;
    if (a.frontmatter.pillar === article.frontmatter.pillar) score += 2;
    const sharedTags = a.frontmatter.tags.filter((t) =>
      article.frontmatter.tags.includes(t)
    );
    score += sharedTags.length;
    return { article: a, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article);
}

// Re-export from shared constants to avoid circular imports
export { CATEGORY_LABELS } from "./constants";

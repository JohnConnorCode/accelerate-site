import { seoMetadata } from "@/lib/og";
import { getAllArticles } from "@/lib/mdx";
import { LearnHub } from "@/components/sections/LearnHub";

export const metadata = seoMetadata({
  title: "Learning Hub | AI & Automation Guides for Small Business",
  description:
    "Practical guides on AI, automation, client acquisition, and local SEO for small businesses. Actionable strategies you can implement today.",
  ogTitle: "Learning Hub",
  ogSubtitle: "AI & automation guides for small businesses",
});

export default function LearnPage() {
  const articles = getAllArticles();
  const featuredArticle =
    articles.find((a) => a.frontmatter.featured) || articles[0] || null;
  const nonFeatured = featuredArticle
    ? articles.filter((a) => a.slug !== featuredArticle.slug)
    : articles;

  return <LearnHub articles={nonFeatured} featuredArticle={featuredArticle} />;
}

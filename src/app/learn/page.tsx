export const revalidate = 3600;

import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { getAllArticles } from "@/lib/mdx";
import { LearnHub } from "@/components/sections/LearnHub";

export const metadata = seoMetadata({
  title: "AI & Automation Guides for Small Business",
  description:
    "Practical guides on AI, automation, client acquisition, and local SEO for small businesses. Actionable strategies you can implement today.",
  ogTitle: "Learning Hub",
  ogSubtitle: "AI & automation guides for small businesses",
  alternates: {
    canonical: "https://www.acceleratewith.us/learn",
    types: {
      "application/rss+xml": "https://www.acceleratewith.us/learn/feed.xml",
    },
  },
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Learning Hub", url: "/learn" },
]);

export default function LearnPage() {
  const articles = getAllArticles();
  const featuredArticle =
    articles.find((a) => a.frontmatter.featured) || articles[0] || null;
  const nonFeatured = featuredArticle
    ? articles.filter((a) => a.slug !== featuredArticle.slug)
    : articles;

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Learning Hub | AI & Automation Guides for Small Business",
    description:
      "Practical guides on AI, automation, client acquisition, and local SEO for small businesses.",
    url: "https://www.acceleratewith.us/learn",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.frontmatter.title,
        url: `https://www.acceleratewith.us/learn/${article.slug}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <LearnHub articles={nonFeatured} featuredArticle={featuredArticle} />
    </>
  );
}

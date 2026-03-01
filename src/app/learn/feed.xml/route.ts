import { getAllArticles, CATEGORY_LABELS } from "@/lib/mdx";

const BASE_URL = "https://acceleratewith.us";

export async function GET() {
  const articles = getAllArticles();

  const items = articles
    .map(
      (article) => `
    <item>
      <title><![CDATA[${article.frontmatter.title}]]></title>
      <link>${BASE_URL}/learn/${article.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/learn/${article.slug}</guid>
      <description><![CDATA[${article.frontmatter.excerpt}]]></description>
      <pubDate>${new Date(article.frontmatter.date).toUTCString()}</pubDate>
      <category>${CATEGORY_LABELS[article.frontmatter.category]}</category>
      <author>hello@acceleratewith.us (${article.frontmatter.author})</author>
    </item>`
    )
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Accelerate Learning Hub</title>
    <link>${BASE_URL}/learn</link>
    <description>Practical guides on AI, automation, and lead generation for small businesses.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/learn/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}

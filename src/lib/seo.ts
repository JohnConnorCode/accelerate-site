import { siteUrl } from "@/config/tenant";
import type { ArticleFrontmatter } from "./types";

const BASE_URL = siteUrl();
const ORG_ID = `${BASE_URL}/#organization`;

export function generateArticleJsonLd(
  frontmatter: ArticleFrontmatter,
  readingTime: string,
  wordCount: number,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontmatter.seoTitle || frontmatter.title,
    description: frontmatter.seoDescription || frontmatter.excerpt,
    author: {
      "@type": "Person",
      name: frontmatter.author,
      url: `${BASE_URL}/about`,
    },
    publisher: {
      "@id": ORG_ID,
    },
    datePublished: frontmatter.date,
    dateModified: frontmatter.updatedDate || frontmatter.date,
    url: `${BASE_URL}/learn/${frontmatter.slug}`,
    mainEntityOfPage: `${BASE_URL}/learn/${frontmatter.slug}`,
    wordCount,
    timeRequired: `PT${parseInt(readingTime)}M`,
    articleSection: frontmatter.category,
    keywords: frontmatter.targetKeywords.join(", "),
    image: `${BASE_URL}/api/og?title=${encodeURIComponent(frontmatter.seoTitle || frontmatter.title)}`,
  };
}

export function generateBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}

export function generateFaqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateServiceListJsonLd(
  services: { name: string; shortDescription: string; href: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.name,
        description: service.shortDescription,
        provider: {
          "@id": ORG_ID,
        },
        url: `${BASE_URL}${service.href}`,
      },
    })),
  };
}

export function generateVerticalJsonLd(vertical: {
  name: string;
  shortDescription: string;
  slug: string;
}) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${vertical.name} AI Systems`,
    description: vertical.shortDescription,
    provider: {
      "@id": ORG_ID,
    },
    url: `${BASE_URL}/industries/${vertical.slug}`,
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  };

  return jsonLd;
}

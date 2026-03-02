import type { ArticleFrontmatter } from "./types";

const BASE_URL = "https://acceleratewith.us";

export function generateArticleJsonLd(
  frontmatter: ArticleFrontmatter,
  readingTime: string,
  wordCount: number
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontmatter.seoTitle || frontmatter.title,
    description: frontmatter.seoDescription || frontmatter.excerpt,
    author: {
      "@type": "Person",
      name: frontmatter.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Accelerate",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.png`,
      },
    },
    datePublished: frontmatter.date,
    dateModified: frontmatter.updatedDate || frontmatter.date,
    url: `${BASE_URL}/learn/${frontmatter.slug}`,
    mainEntityOfPage: `${BASE_URL}/learn/${frontmatter.slug}`,
    wordCount,
    timeRequired: `PT${parseInt(readingTime)}M`,
    keywords: frontmatter.targetKeywords.join(", "),
  };
}

export function generateBreadcrumbJsonLd(
  items: { name: string; url: string }[]
) {
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

export function generateFaqJsonLd(
  faqs: { question: string; answer: string }[]
) {
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

export function generateLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Accelerate",
    description:
      "AI strategy and systems for small businesses. We figure out where AI fits, then build and manage the systems that make it happen.",
    url: BASE_URL,
    email: "john@acceleratewith.us",
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    priceRange: "$$",
    serviceType: [
      "AI Strategy & Roadmap",
      "Workflow Automation",
      "Sales & Marketing Automation",
    ],
    sameAs: [],
  };
}

export function generateServiceListJsonLd(
  services: { name: string; shortDescription: string; href: string }[]
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
          "@type": "Organization",
          name: "Accelerate",
          url: BASE_URL,
        },
        url: `${BASE_URL}${service.href}`,
      },
    })),
  };
}

export function generateVerticalJsonLd(
  vertical: { name: string; shortDescription: string; slug: string },
  caseStudySlug?: string
) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${vertical.name} AI Systems`,
    description: vertical.shortDescription,
    provider: {
      "@type": "Organization",
      name: "Accelerate",
      url: BASE_URL,
    },
    url: `${BASE_URL}/industries/${vertical.slug}`,
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  };

  if (caseStudySlug) {
    jsonLd.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `${vertical.name} Case Studies`,
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: `${vertical.name} AI Systems`,
            url: `${BASE_URL}/results/${caseStudySlug}`,
          },
        },
      ],
    };
  }

  return jsonLd;
}

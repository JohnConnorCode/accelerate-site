import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { notFound } from "next/navigation";
import { caseStudies } from "@/content/case-studies";
import { CaseStudyDetail } from "@/components/sections/CaseStudyDetail";

const industryLabels: Record<string, string> = {
  home_services: "Home Services",
  law_firm: "Law Firms",
  professional_services: "Professional Services",
  real_estate: "Real Estate",
  other: "Other",
};

interface CaseStudyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return caseStudies.map((study) => ({
    slug: study.slug,
  }));
}

export async function generateMetadata({
  params,
}: CaseStudyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = caseStudies.find((s) => s.slug === slug);

  if (!study) {
    return {
      title: "Case Study Not Found",
    };
  }

  const topMetric = study.metrics[0];
  const description = topMetric
    ? `See how ${study.businessName} achieved ${topMetric.improvement} ${topMetric.label.toLowerCase()} with Accelerate. ${study.results.slice(0, 120)}...`
    : `See how ${study.businessName} grew with Accelerate. ${study.results.slice(0, 150)}...`;

  return seoMetadata({
    title: `${study.businessName} Case Study`,
    description,
    ogTitle: `${study.businessName} Case Study`,
    ogSubtitle: description.slice(0, 80),
    openGraph: {
      type: "article",
      publishedTime: study.publishedAt,
    },
  });
}

function buildJsonLd(study: (typeof caseStudies)[number]) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${study.businessName} Case Study`,
    description: study.results,
    author: {
      "@type": "Organization",
      name: "Accelerate",
      url: "https://acceleratewith.us",
    },
    publisher: {
      "@type": "Organization",
      name: "Accelerate",
      url: "https://acceleratewith.us",
    },
    datePublished: study.publishedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://acceleratewith.us/results/${study.slug}`,
    },
    about: {
      "@type": "Organization",
      name: study.businessName,
      address: {
        "@type": "PostalAddress",
        addressLocality: study.location,
      },
      industry: industryLabels[study.industry] || study.industry,
    },
    ...(study.testimonialQuote && {
      review: {
        "@type": "Review",
        reviewBody: study.testimonialQuote,
        author: {
          "@type": "Person",
          name: study.testimonialAuthor,
          jobTitle: study.testimonialTitle,
        },
      },
    }),
  };
}

export default async function CaseStudyPage({ params }: CaseStudyPageProps) {
  const { slug } = await params;
  const study = caseStudies.find((s) => s.slug === slug);

  if (!study) {
    notFound();
  }

  const jsonLd = buildJsonLd(study);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CaseStudyDetail study={study} />
    </>
  );
}

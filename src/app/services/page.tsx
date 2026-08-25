import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { ServicesPageContent } from "@/components/sections/ServicesPage";
import { services } from "@/content/services";
import { faqs } from "@/content/faqs";
import { generateServiceListJsonLd, generateFaqJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "AI Strategy, Custom Solutions & Execution",
  description:
    "AI consulting, custom systems, integrations, managed execution, training, and ongoing optimization built around your business.",
  ogTitle: "AI Services Built Around Your Business",
  ogSubtitle: "Strategy, custom builds, execution, training, and improvement",
  path: "/services",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Services", url: "/services" },
]);

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateServiceListJsonLd(services)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateFaqJsonLd(faqs)),
        }}
      />
      <ServicesPageContent />
      <PageEngagementTracker />
    </>
  );
}

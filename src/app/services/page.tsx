import { seoMetadata } from "@/lib/og";
import { ServicesPageContent } from "@/components/sections/ServicesPage";
import { services } from "@/content/services";
import { faqs } from "@/content/faqs";
import { generateServiceListJsonLd, generateFaqJsonLd } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "AI Strategy & Automation Services",
  description:
    "AI strategy, workflow automation, sales systems, and ongoing management for small businesses. We build it and run it alongside you.",
  ogTitle: "Our Services",
  ogSubtitle: "AI strategy, automation, and ongoing management",
});

export default function ServicesPage() {
  return (
    <>
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
    </>
  );
}

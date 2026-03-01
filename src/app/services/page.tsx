import { seoMetadata } from "@/lib/og";
import { ServicesPageContent } from "@/components/sections/ServicesPage";
import { services } from "@/content/services";
import { faqs } from "@/content/faqs";
import { generateServiceListJsonLd, generateFaqJsonLd } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "Services",
  description:
    "AI-powered websites, automations, and intelligent agents built to help small businesses capture more leads, save time, and grow faster.",
  ogTitle: "Our Services",
  ogSubtitle: "AI-powered websites, automations, and intelligent agents",
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

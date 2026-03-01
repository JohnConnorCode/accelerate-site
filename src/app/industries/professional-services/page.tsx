import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "professional-services")!;

export const metadata = seoMetadata({
  title: "Professional Services AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Professional Services AI",
  ogSubtitle: "AI-powered growth tools for professional service firms",
});

export default function ProfessionalServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical, "compass-financial")),
        }}
      />
      <VerticalPage
        vertical={vertical}
        preSelectedIndustry="professional_services"
      />
    </>
  );
}

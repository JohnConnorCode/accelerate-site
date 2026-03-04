import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "professional-services")!;

export const metadata = seoMetadata({
  title: "Professional Services AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Professional Services AI",
  ogSubtitle: "AI-powered growth tools for professional service firms",
  path: "/industries/professional-services",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Industries", url: "/industries" },
  { name: "Professional Services", url: "/industries/professional-services" },
]);

export default function ProfessionalServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical, "montoya-capital")),
        }}
      />
      <VerticalPage
        vertical={vertical}
        preSelectedIndustry="professional_services"
      />
    </>
  );
}

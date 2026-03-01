import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "home-services")!;

export const metadata = seoMetadata({
  title: "Home Services AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Home Services AI Solutions",
  ogSubtitle: "AI-powered growth tools for home service businesses",
});

export default function HomeServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical, "farrell-roofing")),
        }}
      />
      <VerticalPage vertical={vertical} preSelectedIndustry="home_services" />
    </>
  );
}

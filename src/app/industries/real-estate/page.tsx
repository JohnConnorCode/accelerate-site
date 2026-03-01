import { seoMetadata } from "@/lib/og";
import { verticals } from "@/content/verticals";
import { VerticalPage } from "@/components/sections/VerticalPage";
import { generateVerticalJsonLd } from "@/lib/seo";

const vertical = verticals.find((v) => v.slug === "real-estate")!;

export const metadata = seoMetadata({
  title: "Real Estate AI Solutions",
  description: vertical.shortDescription,
  ogTitle: "Real Estate AI Solutions",
  ogSubtitle: "AI-powered growth tools for real estate professionals",
});

export default function RealEstatePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateVerticalJsonLd(vertical)),
        }}
      />
      <VerticalPage vertical={vertical} preSelectedIndustry="real_estate" />
    </>
  );
}

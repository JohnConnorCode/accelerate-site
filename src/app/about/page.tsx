import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { AboutPageContent } from "@/components/sections/AboutPage";

export const metadata = seoMetadata({
  title: "About Us: Built by a Business Owner",
  description:
    "Built by a business owner who ran into the same problems you have. Accelerate delivers AI strategy and systems for small businesses.",
  ogTitle: "About Accelerate",
  ogSubtitle: "Built by a business owner, for business owners",
  path: "/about",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "About", url: "/about" },
]);

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  mainEntity: {
    "@id": "https://www.acceleratewith.us/#organization",
  },
  url: "https://www.acceleratewith.us/about",
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutJsonLd),
        }}
      />
      <AboutPageContent />
    </>
  );
}

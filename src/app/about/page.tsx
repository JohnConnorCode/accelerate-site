import { seoMetadata } from "@/lib/og";
import { AboutPageContent } from "@/components/sections/AboutPage";

export const metadata = seoMetadata({
  title: "About Us — Built by a Business Owner",
  description:
    "Built by a business owner who ran into the same problems you have. Accelerate delivers AI strategy and systems for small businesses.",
  ogTitle: "About Accelerate",
  ogSubtitle: "Built by a business owner, for business owners",
});

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Accelerate",
  url: "https://acceleratewith.us",
  description:
    "AI strategy and systems for small businesses. We figure out where AI fits, then build and manage the systems that make it happen.",
  founder: {
    "@type": "Person",
    name: "John Connor",
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <AboutPageContent />
    </>
  );
}

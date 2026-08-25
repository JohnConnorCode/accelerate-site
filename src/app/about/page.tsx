import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { AboutPageContent } from "@/components/sections/AboutPage";

export const metadata = seoMetadata({
  title: "About Accelerate",
  description:
    "Accelerate helps businesses choose, build, and run useful AI and automation through direct strategy, engineering, execution, and support.",
  ogTitle: "About Accelerate",
  ogSubtitle: "Practical AI strategy, engineering, and execution",
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

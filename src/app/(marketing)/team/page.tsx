import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { TeamPageContent } from "@/components/sections/TeamPage";

export const metadata: Metadata = seoMetadata({
  title: "Meet the Team",
  description:
    "The operators and advisors behind Accelerate: strategy, engineering, execution, and partnerships, led by founder John Connor.",
  ogTitle: "Meet the Team",
  ogSubtitle: "Operators and advisors behind the work",
  path: "/team",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Team", url: "/team" },
]);

const teamJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  mainEntity: {
    "@id": "https://www.acceleratewith.us/#organization",
  },
  url: "https://www.acceleratewith.us/team",
};

export default function TeamPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(teamJsonLd),
        }}
      />
      <TeamPageContent />
    </>
  );
}

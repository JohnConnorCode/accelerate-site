import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd, generateFaqJsonLd } from "@/lib/seo";
import { OpenSourcePageContent } from "@/components/sections/OpenSourcePage";
import { openSourceFaqs } from "@/content/open-source";

export const metadata = seoMetadata({
  title: "Open Source",
  description:
    "The Command Center is MIT licensed and open source. Run it yourself for free, or have Accelerate build and run a custom managed version for your business.",
  ogTitle: "The Command Center Is Open Source",
  ogSubtitle: "Self-host it free, or have us build and run it for you",
  path: "/open-source",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Open Source", url: "/open-source" },
]);

export default function OpenSourcePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateFaqJsonLd(openSourceFaqs)),
        }}
      />
      <OpenSourcePageContent />
      <PageEngagementTracker />
    </>
  );
}

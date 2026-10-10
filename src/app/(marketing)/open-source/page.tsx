import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd, generateFaqJsonLd } from "@/lib/seo";
import { OpenSourcePageContent } from "@/components/sections/OpenSourcePage";
import { openSourceFaqs } from "@/content/open-source";

const bundledMetadata = seoMetadata({
  title: "Open Source",
  description:
    "Build business Apps on shared customer records, sales, delivery, billing, marketing and AI services. Run and extend the MIT-licensed Command Center.",
  ogTitle: "Build business Apps on a working foundation.",
  ogSubtitle: "Try the demo, self-host the source, or build with Accelerate",
  path: "/open-source",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Open Source", url: "/open-source" },
]);

export default async function OpenSourcePage() {
  const published = await publishedWebsiteOverride("/open-source");
  if (published) return published;
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

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/open-source")) ?? bundledMetadata;
}

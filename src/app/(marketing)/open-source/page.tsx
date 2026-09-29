import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd, generateFaqJsonLd } from "@/lib/seo";
import { OpenSourcePageContent } from "@/components/sections/OpenSourcePage";
import { openSourceFaqs } from "@/content/open-source";

const bundledMetadata = seoMetadata({
  title: "Open Source",
  description:
    "Own the customer workspace behind your team's records, next actions and AI work. Try the demo, self-host the MIT-licensed source, or work with Accelerate.",
  ogTitle: "Keep customer work connected. Own the system behind it.",
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

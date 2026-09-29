import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { CommandCenterPageContent } from "@/components/sections/CommandCenterPage";
import { productFaqs } from "@/content/command-center-faq";
import { generateFaqJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const bundledMetadata = seoMetadata({
  title: "Command Center",
  description:
    "Keep customer conversations, records and next actions together. See the work that needs attention, prepare supported AI actions and trace the result.",
  ogTitle: "Command Center",
  ogSubtitle: "Know what happened. Move the work forward.",
  path: "/command-center",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Command Center", url: "/command-center" },
]);

export default async function CommandCenterPage() {
  const published = await publishedWebsiteOverride("/command-center");
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
          __html: JSON.stringify(generateFaqJsonLd(productFaqs)),
        }}
      />
      <CommandCenterPageContent />
      <PageEngagementTracker />
    </>
  );
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/command-center")) ?? bundledMetadata;
}

import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { CommandCenterPageContent } from "@/components/sections/CommandCenterPage";
import { commandCenterFaqs } from "@/content/command-center-faq";
import { generateFaqJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

const bundledMetadata = seoMetadata({
  title: "Command Center",
  description:
    "See what needs you, follow the customer conversation, and move the next action forward. Command Center connects your records, approvals, and workflows in one workspace.",
  ogTitle: "Command Center",
  ogSubtitle: "Your work. One clear view.",
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
          __html: JSON.stringify(generateFaqJsonLd(commandCenterFaqs)),
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

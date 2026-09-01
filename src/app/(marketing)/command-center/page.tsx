import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import { seoMetadata } from "@/lib/og";
import { CommandCenterPageContent } from "@/components/sections/CommandCenterPage";
import { commandCenterFaqs } from "@/content/command-center-faq";
import { generateFaqJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo";

export const metadata = seoMetadata({
  title: "Command Center",
  description:
    "A multi-tenant operating layer for service businesses: prioritized work, pipeline, communications, analytics, safe automation, and tenant-controlled AI costs.",
  ogTitle: "Command Center",
  ogSubtitle: "An integrated operating layer, when that is the right solution",
  path: "/command-center",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Command Center", url: "/command-center" },
]);

export default function CommandCenterPage() {
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

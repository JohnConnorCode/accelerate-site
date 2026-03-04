import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ResourcesPage } from "@/components/sections/ResourcesPage";

export const metadata = seoMetadata({
  title: "Free AI Guides & Tools",
  description:
    "Download free guides, checklists, and comparisons to help your small business adopt AI and automation. No fluff, just actionable insights.",
  ogSubtitle: "Guides, checklists, and comparisons for small businesses",
  path: "/resources",
});

const breadcrumbJsonLd = generateBreadcrumbJsonLd([
  { name: "Home", url: "/" },
  { name: "Resources", url: "/resources" },
]);

export default function Resources() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ResourcesPage />
    </>
  );
}

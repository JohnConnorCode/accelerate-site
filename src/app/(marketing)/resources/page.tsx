import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { ResourcesPage } from "@/components/sections/ResourcesPage";

const bundledMetadata = seoMetadata({
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

export default async function Resources() {
  const published = await publishedWebsiteOverride("/resources");
  if (published) return published;
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

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/resources")) ?? bundledMetadata;
}

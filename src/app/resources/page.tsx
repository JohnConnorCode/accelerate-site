import { seoMetadata } from "@/lib/og";
import { ResourcesPage } from "@/components/sections/ResourcesPage";

export const metadata = seoMetadata({
  title: "Free Resources",
  description:
    "Download free guides, checklists, and comparisons to help your small business leverage AI and automation. No fluff, just actionable insights.",
  ogSubtitle: "Guides, checklists, and comparisons for small businesses",
});

export default function Resources() {
  return <ResourcesPage />;
}

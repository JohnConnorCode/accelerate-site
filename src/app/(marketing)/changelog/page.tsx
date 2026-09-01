import { seoMetadata } from "@/lib/og";
import { ChangelogPage } from "@/components/sections/ChangelogPage";

export const metadata = seoMetadata({
  title: "Changelog",
  description: "What we shipped and when. Tools, packages, and system changes, dated.",
  ogSubtitle: "Product updates, new features, and improvements",
  alternates: {
    canonical: "https://www.acceleratewith.us/changelog",
    types: { "application/rss+xml": "/changelog/rss.xml" },
  },
});

export default function Changelog() {
  return <ChangelogPage />;
}

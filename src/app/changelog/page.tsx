import { seoMetadata } from "@/lib/og";
import { ChangelogPage } from "@/components/sections/ChangelogPage";

export const metadata = seoMetadata({
  title: "Changelog",
  description:
    "See what's new at Accelerate. Product updates, new features, and improvements to our AI solutions for small businesses.",
  ogSubtitle: "Product updates, new features, and improvements",
  alternates: {
    canonical: "https://www.acceleratewith.us/changelog",
    types: { "application/rss+xml": "/changelog/rss.xml" },
  },
});

export default function Changelog() {
  return <ChangelogPage />;
}

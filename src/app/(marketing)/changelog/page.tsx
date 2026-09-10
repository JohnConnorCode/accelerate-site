import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { ChangelogPage } from "@/components/sections/ChangelogPage";

const bundledMetadata = seoMetadata({
  title: "Changelog",
  description: "What we shipped and when. Tools, packages, and system changes, dated.",
  ogSubtitle: "Product updates, new features, and improvements",
  alternates: {
    canonical: "https://www.acceleratewith.us/changelog",
    types: { "application/rss+xml": "/changelog/rss.xml" },
  },
});

export default async function Changelog() {
  const published = await publishedWebsiteOverride("/changelog");
  if (published) return published;
  return <ChangelogPage />;
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/changelog")) ?? bundledMetadata;
}

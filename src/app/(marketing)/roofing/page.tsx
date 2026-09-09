import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { RoofingCampaignPage } from "@/components/roofing/RoofingCampaignPage";

const bundledMetadata = seoMetadata({
  title: "AI Strategy for Roofing Operations | Accelerate",
  description:
    "Find where AI and automation can improve inquiry handling, estimates, scheduling, follow-up, reporting, and office operations for a roofing company.",
  ogTitle: "Your next roofing job may already be in the pipeline",
  ogSubtitle: "A focused AI strategy session for roofing and exterior operators",
  path: "/roofing",
});

export default async function RoofingPage() {
  const published = await publishedWebsiteOverride("/roofing");
  if (published) return published;
  return <RoofingCampaignPage />;
}

export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/roofing")) ?? bundledMetadata;
}

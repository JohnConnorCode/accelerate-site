import { seoMetadata } from "@/lib/og";
import { RoofingCampaignPage } from "@/components/roofing/RoofingCampaignPage";

export const metadata = seoMetadata({
  title: "Roofing Revenue Leak Audit | Accelerate",
  description: "Find where roofing inquiries, estimates, and follow-up are leaking booked work. Free 30-minute audit for established roofing and exterior companies.",
  ogTitle: "Your next roofing job may already be in the pipeline",
  ogSubtitle: "A free revenue leak audit for roofing and exterior operators",
  path: "/roofing",
});

export default function RoofingPage() {
  return <RoofingCampaignPage />;
}


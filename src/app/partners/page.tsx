import { seoMetadata } from "@/lib/og";
import { PartnersPage } from "@/components/sections/PartnersPage";

export const metadata = seoMetadata({
  title: "Partner Program",
  description:
    "Join the Accelerate Partner Program. Earn commissions, get white-label pricing, and grow your business alongside ours.",
  ogSubtitle: "Earn commissions and grow your business alongside ours",
  path: "/partners",
});

export default function Partners() {
  return <PartnersPage />;
}

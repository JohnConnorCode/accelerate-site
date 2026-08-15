import { seoMetadata } from "@/lib/og";
import { PartnersPage } from "@/components/sections/PartnersPage";

export const metadata = seoMetadata({
  title: "Partner Program: 20% Recurring",
  description:
    "Refer a client or white-label the work. 20% every month they stay. We build it and run it, your name stays on the win.",
  ogSubtitle: "Earn commissions and grow your business alongside ours",
  path: "/partners",
});

export default function Partners() {
  return <PartnersPage />;
}

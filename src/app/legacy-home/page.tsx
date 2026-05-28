/**
 * /legacy-home — the previous homepage, preserved unlinked for reference.
 *
 * The v2 design is now live at `/`. This route is kept (noindex, no nav link,
 * disallowed in robots.txt) so historical sections stay reachable for QA, but
 * it is NOT promoted or canonical. Don't link to it.
 */
import type { Metadata } from "next";
import { seoMetadata } from "@/lib/og";
import { Hero } from "@/components/sections/Hero";
import { ProblemSolution } from "@/components/sections/ProblemSolution";
import { ServicesOverview } from "@/components/sections/ServicesOverview";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhyAccelerate } from "@/components/sections/WhyAccelerate";
import { WhoThisIsFor } from "@/components/sections/WhoThisIsFor";
import { Integrations } from "@/components/sections/Integrations";
import { SocialProof } from "@/components/sections/SocialProof";
import { HomeFAQ } from "@/components/sections/HomeFAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { SectionDivider } from "@/components/ui/SectionDivider";

export const metadata: Metadata = {
  ...seoMetadata({
    title: "Accelerate — legacy homepage",
    description: "Previous homepage layout (archived, unlinked).",
    path: "/legacy-home",
  }),
  robots: { index: false, follow: false },
};

export default function LegacyHomePage() {
  return (
    <>
      <Hero />
      <div className="relative bg-bg-base">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-px w-20 bg-gradient-to-r from-[var(--gold-base)] to-transparent" />
        </div>
      </div>
      <ServicesOverview />
      <SectionDivider variant="fade" />
      <WhoThisIsFor />
      <SectionDivider variant="line" />
      <ProblemSolution />
      <SectionDivider variant="glow" />
      <SocialProof />
      <SectionDivider variant="fade" />
      <HowItWorks />
      <SectionDivider variant="glow" />
      <WhyAccelerate />
      <SectionDivider variant="line" />
      <Integrations />
      <SectionDivider variant="glow" />
      <HomeFAQ />
      <SectionDivider variant="fade" />
      <FinalCTA />
    </>
  );
}

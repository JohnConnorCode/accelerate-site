import { Hero } from "@/components/home/Hero";
import { HeroStatement } from "@/components/home/HeroStatement";
import { Marquee } from "@/components/home/Marquee";
import { Systems } from "@/components/home/Systems";
import { CommandCenter } from "@/components/home/CommandCenter";
import { Trades } from "@/components/home/Trades";
import { HowWeWork } from "@/components/home/HowWeWork";
import { Plan } from "@/components/home/Plan";
import { HomeSelectedWork } from "@/components/home/HomeSelectedWork";
import { Who } from "@/components/home/Who";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

/** The homepage moves from the agency's work to its offer, then the product,
 * delivery process, sample plan and booking. Published Site Studio documents
 * retain their saved order; this is the bundled site's default composition. */
export function Studio() {
  return (
    <>
      {/* The hero keeps its message and CTA in the opening viewport. The
          explanatory beat follows before the marquee. */}
      <div className="hero-band">
        <Hero />
        <HeroStatement />
        <Marquee />
      </div>
      <HomeSelectedWork />
      <Systems />
      <Trades />
      <CommandCenter />
      <HowWeWork />
      <Plan />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

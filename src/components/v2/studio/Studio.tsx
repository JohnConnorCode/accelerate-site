"use client";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Evidence } from "@/components/home/Evidence";
import { CommandCenter } from "@/components/home/CommandCenter";
import { Outcomes } from "@/components/home/Outcomes";
import { HowWeWork } from "@/components/home/HowWeWork";
import { Plan } from "@/components/home/Plan";
import { Who } from "@/components/home/Who";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

/**
 * Accelerate homepage. Most traffic here has already talked to John, not
 * cold — so the page confirms and closes rather than re-pitching (Evidence
 * is a single compact beat, not a discovery-stage sales case).
 */
export function Studio() {
  return (
    <>
      {/* Grouped so the marquee band can sit pinned to the bottom of the
          initial mobile viewport (see `.hero-band` in globals.css) — that
          only works if hero + band share one flex parent, since a single
          section can't reserve space for a sibling's height on its own. */}
      <div className="hero-band">
        <Hero />
        <Marquee />
      </div>
      <Evidence />
      <Outcomes />
      <CommandCenter />
      <HowWeWork />
      <Plan />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

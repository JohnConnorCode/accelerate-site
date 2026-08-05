"use client";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Evidence } from "@/components/home/Evidence";
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
      <Hero />
      <Marquee />
      <Evidence />
      <Outcomes />
      <HowWeWork />
      <Plan />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

"use client";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Evidence } from "@/components/home/Evidence";
import { Outcomes } from "@/components/home/Outcomes";
import { WherePays } from "@/components/home/WherePays";
import { HowWeWork } from "@/components/home/HowWeWork";
import { Plan } from "@/components/home/Plan";
import { Who } from "@/components/home/Who";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

/**
 * Accelerate homepage — a faithful build of the reference editorial mockup
 * (see accelerate.html), using the site's real Header/Footer chrome and deep
 * links into /services, /packages, /about, /learn in place of the mockup's
 * static anchors.
 */
export function Studio() {
  return (
    <>
      <Hero />
      <Marquee />
      <Evidence />
      <Outcomes />
      <WherePays />
      <HowWeWork />
      <Plan />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

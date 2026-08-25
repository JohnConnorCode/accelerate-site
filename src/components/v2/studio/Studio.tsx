"use client";

import { Hero } from "@/components/home/Hero";
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

/**
 * Accelerate homepage. The arc below the hero: what we build (Systems, an
 * editorial index of named machines), the product artifact (CommandCenter),
 * the photography beat showing where it runs (Trades), then process, plan,
 * firm, questions, close. No statistics lead a section; the numbers live in
 * the sample plan deck where they are framed as a plan, not a pitch.
 */
export function Studio() {
  return (
    <>
      {/* Grouped so the mobile hero, proof copy, and marquee can share one
          continuous opening composition (see `.hero-band` in globals.css). */}
      <div className="hero-band">
        <Hero />
        <Marquee />
      </div>
      <Systems />
      <Trades />
      <CommandCenter />
      <HowWeWork />
      <Plan />
      <HomeSelectedWork />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

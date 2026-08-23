"use client";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Systems } from "@/components/home/Systems";
import { CommandCenter } from "@/components/home/CommandCenter";
import { Trades } from "@/components/home/Trades";
import { HowWeWork } from "@/components/home/HowWeWork";
import { Plan } from "@/components/home/Plan";
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
      {/* Grouped so the mobile hero can reserve a stable first fold for the
          headline and booking action while the proof copy and marquee continue
          directly below it (see `.hero-band` in globals.css). */}
      <div className="hero-band">
        <Hero />
        <Marquee />
      </div>
      <Systems />
      <CommandCenter />
      <Trades />
      <HowWeWork />
      <Plan />
      <Who />
      <Faq />
      <FinalCta />
    </>
  );
}

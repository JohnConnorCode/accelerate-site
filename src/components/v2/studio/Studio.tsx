"use client";

import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { Week } from "@/components/home/Week";
import { CommandCenter } from "@/components/home/CommandCenter";
import { Trades } from "@/components/home/Trades";
import { HowWeWork } from "@/components/home/HowWeWork";
import { Plan } from "@/components/home/Plan";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";

/**
 * Public homepage. Cold and warm visitors both land here, so the page has
 * to show the offer, the machine, and the session — not re-argue it in
 * nine sections of prose.
 */
export function Studio() {
  return (
    <>
      <div className="hero-band">
        <Hero />
        <Marquee />
      </div>
      <Week />
      <CommandCenter />
      <Trades />
      <HowWeWork />
      <Plan />
      <Faq />
      <FinalCta />
    </>
  );
}

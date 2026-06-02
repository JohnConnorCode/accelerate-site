"use client";

import { FluidCursor } from "./FluidCursor";
import { Hero } from "./Hero";
import { ScrollSequence } from "./ScrollSequence";
import { Manifesto } from "./Manifesto";
import { Services } from "./Services";
import { IndustryList } from "./IndustryList";
import { Results } from "./Results";
import { ValueBand } from "./ValueBand";
import { FAQ } from "./FAQ";
import { ClosingCTA } from "./ClosingCTA";

/**
 * Accelerate homepage — single unifying concept: VELOCITY.
 * Scroll-reactive marquees, G-force heading skew, a velocity HUD, living shapes,
 * a fluid cursor. Cuberto-grade interactivity; outcome-first copy. No particles.
 */
export function Studio() {
  return (
    <>
      <FluidCursor />
      <Hero />
      <Manifesto />
      <ScrollSequence />
      <Services />
      <IndustryList />
      <Results />
      <ValueBand />
      <FAQ />
      <ClosingCTA />
    </>
  );
}

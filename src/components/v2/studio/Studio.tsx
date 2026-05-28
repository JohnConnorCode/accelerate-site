"use client";

import { LenisProvider } from "../living/LenisProvider";
import { FluidCursor } from "./FluidCursor";
import { ScrollProgress } from "./ScrollProgress";
import { Hero } from "./Hero";
import { ScrollSequence } from "./ScrollSequence";
import { Manifesto } from "./Manifesto";
import { Services } from "./Services";
import { IndustryList } from "./IndustryList";
import { ValueBand } from "./ValueBand";
import { ClosingCTA } from "./ClosingCTA";

/**
 * Accelerate homepage — single unifying concept: VELOCITY.
 * Scroll-reactive marquees, G-force heading skew, a velocity HUD, living shapes,
 * a fluid cursor. Cuberto-grade interactivity; outcome-first copy. No particles.
 */
export function Studio() {
  return (
    <>
      <LenisProvider />
      <FluidCursor />
      <ScrollProgress />
      <Hero />
      <ScrollSequence />
      <Manifesto />
      <Services />
      <IndustryList />
      <ValueBand />
      <ClosingCTA />
    </>
  );
}

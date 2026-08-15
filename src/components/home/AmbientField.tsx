"use client";

import { ScrollParallax } from "./ScrollParallax";

/**
 * Ambient atmosphere: two soft blurred blobs with a continuous CSS idle
 * drift (.atmo-a/.atmo-b, already reduced-motion-safe, see globals.css)
 * PLUS a scroll-linked drift on top via ScrollParallax, so sections that
 * have no other scroll-parallax on their content (HowWeWork, Who, Faq,
 * FinalCta — deliberately excluded, see the approved plan) still get real
 * felt motion as you scroll past them, not just a slow on-timer float.
 * Color comes from --ambient-1/--ambient-2, which flip to a lighter tint
 * automatically inside .ink-panel sections — same token-override pattern
 * as --surface-*. Monochrome only.
 */
export function AmbientField() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <ScrollParallax speed={-0.55}>
        <div className="ambient-blob ambient-blob--1 atmo-a" />
      </ScrollParallax>
      <ScrollParallax speed={0.55}>
        <div className="ambient-blob ambient-blob--2 atmo-b" />
      </ScrollParallax>
    </div>
  );
}

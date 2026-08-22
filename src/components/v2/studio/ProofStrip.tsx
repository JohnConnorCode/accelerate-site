"use client";

import { stats } from "@/content/stats";
import { Container, Eyebrow } from "./primitives";

export function ProofStrip() {
  return (
    <section className="relative border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] py-[clamp(4.5rem,8vw,7rem)]">
      <Container>
        <Eyebrow className="mb-6">what we build toward</Eyebrow>
        <h2 className="h2 max-w-[16ch]">Hours back. Work redirected.</h2>
        <div className="week-stats" style={{ marginTop: "clamp(36px,5vw,64px)" }}>
          {stats.map((s) => (
            <div key={s.label} className="week-stat">
              <span className="week-n">
                {s.value}
                {s.suffix}
              </span>
              <span className="week-n-label">
                {s.label}. {s.detail}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

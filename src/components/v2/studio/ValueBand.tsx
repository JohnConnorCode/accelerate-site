"use client";

import { MaskReveal } from "./MaskReveal";
import { OptimizationLoop } from "./OptimizationLoop";
import { BookCallButton } from "./primitives";

export function ValueBand() {
  return (
    <section
      className="section-y relative overflow-hidden"
      style={{ background: "var(--gold-base)", color: "var(--btn-primary-text)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[8%] -top-[30%] h-[60vw] w-[60vw] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(0,0,0,0.45), transparent 65%)" }}
      />

      <div className="page-shell page-shell--narrow relative grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
        {/* left: statement */}
        <div>
          <p className="mb-7 font-mono text-xs uppercase tracking-[0.3em] opacity-70">[ the model ]</p>
          <h2 className="font-display text-[clamp(2.6rem,6vw,6rem)] font-extrabold leading-[0.92] tracking-[-0.04em]">
            <MaskReveal>Built to run</MaskReveal>
            <MaskReveal delay={0.12} className="font-editorial italic">without you.</MaskReveal>
          </h2>
          <p className="mt-7 max-w-md text-lg leading-relaxed opacity-80">
            Not another tool to manage. A team that sets the systems up, runs them,
            and keeps them sharp — so your growth stops depending on your hours.
          </p>
          <BookCallButton variant="inverse" className="mt-9" />

          {/* always-on cue — on-brand "it keeps running" indicator */}
          <div className="mt-10 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] opacity-70">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-black" />
            </span>
            Always on · runs while you sleep
          </div>
        </div>

        {/* right: the continuous improvement loop — we iterate on the data so it
            keeps getting sharper (interactive: hover a stage to inspect it) */}
        <OptimizationLoop className="lg:self-center" />
      </div>
    </section>
  );
}

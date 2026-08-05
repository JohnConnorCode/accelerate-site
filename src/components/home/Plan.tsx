"use client";

import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal } from "./reveal";
import { PlanDeck } from "./PlanDeck";

const ITEMS = [
  "What your current process costs, measured",
  "Opportunities ranked by value against effort",
  "A sequence, and what each stage depends on",
  "What to leave alone, and why",
  "What your team can run without us",
];

export function Plan() {
  return (
    <section className="sect" id="plan">
      <div className="wrap">
        <div className="plan-grid">
          <Reveal rv>
            <p className="label eyebrow-anim">The plan</p>
            <h2 className="h2" style={{ marginTop: 18 }}>
              You leave the first
              <br />
              call with something
              <br />
              usable.
            </h2>
            <p className="lede" style={{ marginTop: 18 }}>
              Most firms hold the analysis back until you sign. We hand it
              over after the first call. If the thinking is good you will
              want the people who did it.
            </p>
            <Reveal as="ul" className="plan-list">
              {ITEMS.map((item, i) => (
                <li key={item}>
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>{item}</span>
                </li>
              ))}
            </Reveal>
            <Link
              href="/contact"
              onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "plan" })}
              className="btn"
            >
              Book a free call <span className="arw">→</span>
            </Link>
          </Reveal>

          <Reveal rv delay={0.1}>
            <PlanDeck />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

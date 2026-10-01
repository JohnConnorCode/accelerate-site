"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { trackConversion } from "@/lib/analytics";
import { Reveal } from "./reveal";
import { PlanDeck } from "./PlanDeck";
import { AmbientField } from "./AmbientField";

import { homePlanContent } from "@/content/site-studio/home";
import type { HomePlanContent } from "@/lib/site-studio/native-templates";

export function Plan({ content = homePlanContent }: { content?: HomePlanContent }) {
  return (
    <section className="sect home-plan" id="plan">
      <AmbientField />
      <div className="wrap">
        <div className="plan-grid">
          <div>
            <Reveal sequence>
              <p data-home-step="0" className="label eyebrow-anim">
                {content.eyebrow}
              </p>
              <h2 data-home-step="1" className="h2" style={{ marginTop: 18, lineHeight: 1.15 }}>
                {content.heading}
              </h2>
              <p data-home-step="2" className="lede" style={{ marginTop: 18 }}>
                {content.body}
              </p>
            </Reveal>
            <ul className="plan-list">
              {/* Each item gets its own <Reveal> — its own scroll trigger —
                  so it fades in exactly when THAT item scrolls into view,
                  not on a fixed delay from when the list appeared. --d is
                  only a small tie-breaker for a fast scroll that brings two
                  items into view in the same tick. */}
              {content.items.map((item, i) => (
                <Reveal
                  key={item}
                  as="li"
                  className="item-rv"
                  style={{ "--d": `${0.11 * i}s` } as CSSProperties}
                >
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>{item}</span>
                </Reveal>
              ))}
            </ul>
            <Reveal rv as="div" delay={0.18}>
              <Link
                href={content.ctaHref}
                onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "plan" })}
                data-booking-cta
                className="btn"
              >
                {content.ctaLabel}{" "}
                <span className="arw" aria-hidden="true">
                  →
                </span>
              </Link>
            </Reveal>
          </div>

          <Reveal rv delay={0.11}>
            <PlanDeck content={content.deck} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

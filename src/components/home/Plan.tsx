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
    <section className="sect" id="plan">
      <AmbientField />
      <div className="wrap">
        <div className="plan-grid">
          <div>
            <Reveal rv as="p" className="label eyebrow-anim">
              {content.eyebrow}
            </Reveal>
            <Reveal
              rv
              as="h2"
              className="h2"
              delay={0.06}
              style={{ marginTop: 18, lineHeight: 1.15 }}
            >
              {content.heading}
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 18 }}>
              {content.body}
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
                  style={{ "--d": `${0.06 * i}s` } as CSSProperties}
                >
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>{item}</span>
                </Reveal>
              ))}
            </ul>
            <Reveal rv as="div" delay={0.62}>
              <Link
                href={content.ctaHref}
                onClick={() => trackConversion("Strategy Call CTA Clicked", { location: "plan" })}
                className="btn"
              >
                {content.ctaLabel}{" "}
                <span className="arw" aria-hidden="true">
                  →
                </span>
              </Link>
            </Reveal>
          </div>

          {/* No ScrollParallax wrapper here —
              it continuously writes `transform` on this element's parent
              via direct DOM mutation on every scroll frame, which is
              exactly when the blur-in reveal below is supposed to be
              playing. Two independent things fighting for paint frames on
              a large backdrop-filter element was starving the reveal
              transition. PlanDeck already has its own idle float-gentle
              bob, so it isn't static once revealed.
              PlanDeck is ~490px tall — the default rootMargin fires once
              any sliver crosses in, so a tall card finished its reveal
              transition long before it was meaningfully on screen and
              read as "just appears" instead of animating in. A negative
              bottom rootMargin delays the trigger until the card's top
              has scrolled well up into the viewport instead of requiring
              a % of its own (large) area to be visible — scales correctly
              regardless of the card's height. */}
          <Reveal rv delay={0.1} threshold={0} rootMargin="0px 0px -22% 0px">
            <PlanDeck content={content.deck} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

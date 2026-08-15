"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useState } from "react";
import { homeFaqs } from "@/content/home-faq";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="sect" id="faq" style={{ paddingTop: 0 }}>
      <AmbientField />
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(28px,3.6vw,46px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            Common questions
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Answered plainly.
          </Reveal>
        </div>

        <div className="efaq">
          {/* Each row gets its own <Reveal> — its own scroll trigger — so
              it fades in exactly when THAT row scrolls into view, not on a
              fixed delay measured from when the list's top appeared (which
              broke down completely on a slow scroll: a later row's delay
              had long since elapsed before it was ever on screen). --d is
              only a small tie-breaker for a fast scroll that brings two
              rows into view in the same tick. */}
          {homeFaqs.map((faq, i) => (
            <Reveal
              key={faq.question}
              as="details"
              className="item-rv"
              style={{ "--d": `${0.06 * i}s` } as CSSProperties}
              open={open === i}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                setOpen(open === i ? -1 : i);
              }}
            >
              <summary>
                {faq.question}
                <span className="pm" />
              </summary>
              <div className="ans">
                <div>
                  <p>{faq.answer}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

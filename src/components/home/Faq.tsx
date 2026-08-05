"use client";

import { useState } from "react";
import { homeFaqs } from "@/content/home-faq";
import { Reveal } from "./reveal";

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="sect" id="faq" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(28px,3.6vw,46px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            Common questions
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            Answered plainly.
          </Reveal>
        </div>

        <Reveal as="div" className="efaq">
          {homeFaqs.map((faq, i) => (
            <details
              key={faq.question}
              open={open === i}
              onClick={(e) => {
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
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

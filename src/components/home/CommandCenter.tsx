"use client";

import Link from "next/link";
import { ProductSlider } from "@/components/media/ProductSlider";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { homeCommandCenterContent } from "@/content/site-studio/home";
import type { HomeCommandCenterContent } from "@/lib/site-studio/native-templates";

export function CommandCenter({
  content = homeCommandCenterContent,
}: {
  content?: HomeCommandCenterContent;
}) {
  return (
    <section className="sect" id="command-center">
      <AmbientField />
      <div className="wrap">
        <Reveal sequence className="shead">
          <p data-home-step="0" className="label eyebrow-anim">
            {content.eyebrow}
          </p>
          <div>
            <h2 data-home-step="1" className="h2">
              {content.headingStart}
              <br />
              <span className="it">{content.headingEnd}</span>
            </h2>
            <p data-home-step="2" className="lede" style={{ marginTop: 20 }}>
              {content.body}
            </p>
            <p data-home-step="3" className="lede" style={{ marginTop: 16 }}>
              {content.introduction}
            </p>
          </div>
        </Reveal>

        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <ProductSlider slides={content.slides} groupLabel={content.groupLabel} priority={false} />
        </Reveal>

        <Reveal
          sequence
          as="div"
          delay={0.16}
          className="flex flex-wrap gap-x-6 gap-y-3"
          style={{ marginTop: "clamp(22px,2.6vw,32px)" }}
        >
          {content.links.map((link, index) => (
            <Link
              key={index}
              data-home-step={Math.min(index, 4)}
              href={link.href}
              className="ink-sweep inline-flex min-h-11 items-center gap-1 text-[15.5px] text-[var(--fg)]"
            >
              {link.label} <span aria-hidden="true">&rarr;</span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

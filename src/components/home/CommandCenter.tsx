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
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {content.eyebrow}
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              {content.headingStart}
              <br />
              <span className="it">{content.headingEnd}</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              {content.body}
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.18} style={{ marginTop: 16 }}>
              {content.introduction}
            </Reveal>
          </div>
        </div>

        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <ProductSlider slides={content.slides} groupLabel={content.groupLabel} />
        </Reveal>

        <Reveal
          rv
          as="div"
          delay={0.16}
          className="flex flex-wrap gap-x-6 gap-y-3"
          style={{ marginTop: "clamp(22px,2.6vw,32px)" }}
        >
          {content.links.map((link, index) => (
            <Link
              key={index}
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

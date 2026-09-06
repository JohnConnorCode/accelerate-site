"use client";

import Link from "next/link";
import { ProductSlider } from "@/components/media/ProductSlider";
import { PRODUCT_SCREENSHOTS } from "@/content/product-screenshots";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { marketingPositioning } from "@/content/marketing-positioning";

export function CommandCenter() {
  return (
    <section className="sect" id="command-center">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {marketingPositioning.commandCenter.label}
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              When the work needs
              <br />
              <span className="it">one place to run.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              {marketingPositioning.commandCenter.description}
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.18} style={{ marginTop: 16 }}>
              Browse real product screens with fictional business data. Open the demo to explore the
              same workspace, records, and workflows yourself.
            </Reveal>
          </div>
        </div>

        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <ProductSlider slides={PRODUCT_SCREENSHOTS} groupLabel="Command Center screens" />
        </Reveal>

        <Reveal
          rv
          as="div"
          delay={0.16}
          className="flex flex-wrap gap-x-6 gap-y-3"
          style={{ marginTop: "clamp(22px,2.6vw,32px)" }}
        >
          <Link
            href="/command-center"
            className="ink-sweep inline-flex min-h-11 items-center gap-1 text-[15.5px] text-[var(--fg)]"
          >
            Explore the Command Center <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link
            href="/demo/command-center"
            className="ink-sweep inline-flex min-h-11 items-center gap-1 text-[15.5px] text-[var(--fg)]"
          >
            Explore the demo <span aria-hidden="true">&rarr;</span>
          </Link>
          <Link
            href="/docs"
            className="ink-sweep inline-flex min-h-11 items-center gap-1 text-[15.5px] text-[var(--fg)]"
          >
            Read the docs <span aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

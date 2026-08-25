import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { marketingPositioning } from "@/content/marketing-positioning";

/* The second beat is the complete offer, not a product capability map. The
   Command Center has its own section and page; these four doors explain how a
   client can engage Accelerate before any solution has been chosen. */

const GLYPHS = ["◆", "✦", "→", "↻"] as const;
const COLORS = ["96,165,250", "167,139,250", "163,230,53", "34,211,238"] as const;

export function Systems() {
  return (
    <section className="sect" id="systems">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            How we help
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Start with the business.
              <br />
              Build <span className="it">what it needs.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              We do not begin with a product. We learn how your team works, find the best use of AI or automation, and choose the right-sized solution.
            </Reveal>
          </div>
        </div>

        <div className="pillars">
          {/* Each panel gets its own <Reveal> — its own scroll trigger — so it
              fades in exactly when THAT panel scrolls into view. --d is only a
              tie-breaker for panels entering in the same tick. */}
          {marketingPositioning.engagementModes.map((mode, i) => (
            <Reveal
              key={mode.key}
              rv
              as="div"
              className="item-rv h-full"
              style={{ "--d": `${0.06 * (i % 2)}s` } as CSSProperties}
            >
              <Link href={mode.href} className="pillar">
                <span className="pillar-head">
                  <span className="pillar-glyph" style={{ color: `rgb(${COLORS[i]})` }} aria-hidden="true">
                    {GLYPHS[i]}
                  </span>
                  <span className="pillar-k">{mode.label}</span>
                  <span className="pillar-n">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <span className="pillar-name">{mode.title}</span>
                <span className="pillar-d">{mode.description}</span>
                <span className="pillar-eg">
                  <span className="pillar-eg-glyph" style={{ color: `rgb(${COLORS[i]})` }} aria-hidden="true">
                    {GLYPHS[i]}
                  </span>
                  {mode.example}
                  <span className="pillar-arw" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

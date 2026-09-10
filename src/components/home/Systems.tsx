import Link from "next/link";
import { Reveal } from "./reveal";
import { AmbientField } from "./AmbientField";
import { homeSystemsContent } from "@/content/site-studio/home";
import type { HomeSystemsContent } from "@/lib/site-studio/native-templates";

/** Small, authored diagrams explain each engagement rather than decorate it. */
function EngagementDrawing({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 160 100" fill="none" aria-hidden="true" className="engagement-drawing">
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {kind === "strategy" && (
          <>
            <path opacity="0.35" d="M16 22h38M16 50h26M16 78h38M64 22l28 28-28 28" />
            <path d="M42 50h50M102 50h34m-6-6 6 6-6 6" />
            <circle cx="96" cy="50" r="5" fill="currentColor" stroke="none" />
          </>
        )}
        {kind === "build" && (
          <>
            <rect x="14" y="15" width="28" height="24" />
            <rect x="14" y="61" width="28" height="24" />
            <path opacity="0.4" d="M42 27h25v46H42M67 50h30" />
            <rect x="97" y="32" width="46" height="36" />
            <path d="m112 50 6 6 12-12" />
          </>
        )}
        {kind === "execute" && (
          <>
            <path opacity="0.4" d="M18 20h92M18 50h68M18 80h92" />
            <circle cx="126" cy="50" r="20" />
            <path d="m118 50 6 6 11-12" />
            <path d="M18 20h18M18 50h18M18 80h18" />
          </>
        )}
        {kind === "improve" && (
          <>
            <path d="M44 33a38 38 0 0 1 67-6l7 13m0-16v16h-16M116 67a38 38 0 0 1-67 6l-7-13m0 16V60h16" />
            <circle cx="80" cy="50" r="5" fill="currentColor" stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}

export function Systems({ content = homeSystemsContent }: { content?: HomeSystemsContent }) {
  return (
    <section className="sect" id="systems" aria-labelledby="systems-heading">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            {content.eyebrow}
          </Reveal>
          <div>
            <Reveal rv as="h2" id="systems-heading" className="h2" delay={0.06}>
              {content.headingStart}
              <br />
              {content.headingMiddle} <span className="it">{content.headingEnd}</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              {content.body}
            </Reveal>
          </div>
        </div>
        <ol className="engagement-list" aria-label={content.listLabel}>
          {content.modes.map((mode, i) => (
            <Reveal key={mode.key} rv as="li" className="engagement-item">
              <Link href={mode.href} className="engagement-link">
                <span className="engagement-index" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="engagement-title">
                  <p className="engagement-label">{mode.label}</p>
                  <h3>{mode.title}</h3>
                </div>
                <div className="engagement-detail">
                  <p>{mode.description}</p>
                  <p className="engagement-deliverables">{mode.example}</p>
                </div>
                <EngagementDrawing kind={mode.key} />
                <span className="engagement-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
        <p className="engagement-note">{content.note}</p>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, type PointerEvent } from "react";

/** A typographic print of one workflow, rather than a menu of services. */
export function HeroArtwork() {
  const artwork = useRef<HTMLElement>(null);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(release.current), []);
  const move = (event: PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(release.current);
    const bounds = event.currentTarget.getBoundingClientRect();
    artwork.current?.style.setProperty(
      "--print-x",
      String((event.clientX - bounds.left) / bounds.width - 0.5),
    );
    artwork.current?.style.setProperty(
      "--print-y",
      String((event.clientY - bounds.top) / bounds.height - 0.5),
    );
  };
  const reset = () => {
    artwork.current?.style.setProperty("--print-x", "0");
    artwork.current?.style.setProperty("--print-y", "0");
  };
  return (
    <figure
      ref={artwork}
      className="home-hero-artwork"
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") reset();
      }}
      onPointerUp={(event) => {
        if (event.pointerType === "touch") release.current = setTimeout(reset, 600);
      }}
    >
      {[false, true].map((compact) => (
        <svg
          key={String(compact)}
          className={`home-hero-print${compact ? " home-hero-print-mobile" : " home-hero-print-desktop"}`}
          viewBox={compact ? "0 0 600 400" : "0 0 1200 285"}
          aria-hidden="true"
        >
          <g className="home-hero-print-input">
            <text
              x="0"
              y={compact ? 96 : 100}
              className="home-hero-print-outline"
              textLength={compact ? 385 : 570}
              lengthAdjust="spacingAndGlyphs"
            >
              INQUIRY
            </text>
            <text x="4" y={compact ? 126 : 130} className="home-hero-print-note">
              YOUR INBOX + CRM
            </text>
          </g>
          <path
            className="home-hero-print-route"
            d={
              compact
                ? "M458 70H558Q584 70 584 100V208Q584 240 558 240H505"
                : "M588 70H976Q1180 70 1180 155Q1180 240 976 240H895"
            }
          />
          <g
            className="home-hero-print-mark-position"
            transform={compact ? "translate(410 145) scale(0.72)" : undefined}
          >
            <g className="home-hero-print-mark">
              {[0, 1, 2].map((index) => (
                <path
                  key={index}
                  d="M0 0H34L58 44L34 88H0L24 44Z"
                  transform={`translate(${compact ? index * 53 : 636 + index * 53} ${compact ? 0 : 26})`}
                  opacity={0.35 + index * 0.325}
                />
              ))}
            </g>
          </g>
          <g className="home-hero-print-output">
            <text
              x="0"
              y={compact ? 336 : 240}
              className="home-hero-print-solid"
              textLength={compact ? 560 : 870}
              lengthAdjust="spacingAndGlyphs"
            >
              FOLLOW-UP
            </text>
            <text x="4" y={compact ? 375 : 275} className="home-hero-print-note">
              A REPLY. A NEXT STEP. A HANDOFF.
            </text>
          </g>
        </svg>
      ))}
      <figcaption className="sr-only">
        An example of custom automation: connect an inquiry in your inbox with your CRM, prepare a
        reply, schedule the follow-up and hand the work to your team.
      </figcaption>
    </figure>
  );
}

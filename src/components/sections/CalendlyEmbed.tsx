"use client";

import { useEffect, useRef, useState } from "react";
import { CALENDLY_URL } from "@/lib/booking";

/* Calendly's own widget.js is deliberately NOT used here. That script had to
   download, hydrate and execute before it injected the iframe, so the booking
   calendar couldn't even start loading until every other script on the page
   was interactive (~0.6s of dead time on desktop broadband, more on mobile).
   Rendering the iframe directly puts the request in the server-rendered HTML,
   so the browser starts fetching Calendly immediately, in parallel with our
   own bundle (layout.tsx already preconnects to both Calendly origins). All
   widget.js added was auto-resize + analytics, and the fixed height below
   already fits the inline calendar. */
const EMBED_DOMAIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://acceleratewith.us").replace(
  /^https?:\/\//,
  "",
);

const EMBED_SRC = `${CALENDLY_URL}?hide_gdpr_banner=1&embed_domain=${EMBED_DOMAIN}&embed_type=Inline`;

/* Calendly's app keeps booting for a few seconds after the iframe's own load
   event, and it gives us no cross-origin signal for when it finally paints
   (its "calendly.*" postMessage events never fire without widget.js driving
   the handshake — verified). So instead of guessing one cutover moment, the
   placeholder holds through the load event and then dissolves slowly, letting
   the real calendar surface through the fade whenever it arrives. It is
   pointer-events-none throughout, so it can never swallow a click. */
const HOLD_AFTER_LOAD_MS = 1200;
const HARD_CAP_MS = 6000;

export function CalendlyEmbed() {
  const [fading, setFading] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.push(window.setTimeout(() => setFading(true), HARD_CAP_MS));
    const pending = timers.current;
    return () => pending.forEach(window.clearTimeout);
  }, []);

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl border border-border-glass"
        style={{ minWidth: "280px", height: "700px" }}
      >
        <iframe
          src={EMBED_SRC}
          title="Book a 30-minute strategy call"
          className="h-full w-full border-0"
          onLoad={() => {
            timers.current.push(window.setTimeout(() => setFading(true), HOLD_AFTER_LOAD_MS));
          }}
        />

        <div
          aria-hidden={fading}
          className={`pointer-events-none absolute inset-0 grid place-items-center bg-[color-mix(in_srgb,var(--bg-elevated)_98%,transparent)] transition-opacity duration-[2200ms] ease-out ${
            fading ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-border-glass border-t-gold" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-white-muted">
              Loading available times
            </span>
          </div>
        </div>
      </div>

      {/* escape hatch if the embed is blocked (privacy extensions, corporate
          networks) or just crawling on a bad connection */}
      <p className="mt-3 px-2 text-center text-xs text-white-muted">
        Calendar not loading?{" "}
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="link"
          className="underline underline-offset-4 transition-colors hover:text-heading"
        >
          Open it in a new tab
        </a>
      </p>
    </>
  );
}

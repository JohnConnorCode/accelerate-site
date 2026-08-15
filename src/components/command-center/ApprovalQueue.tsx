"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/lib/animations";
import { ACTION_KIND, DEMO_ACTIONS } from "./demo/demo-data";

/* The signature visual for /command-center: the approval queue, running.

   Every few seconds the top item is approved and leaves, a new one arrives at
   the bottom, and the tally moves. That loop IS the product, so the page shows
   it rather than describing it.

   Built on the same `.deck` shell as the homepage sample-plan card (dark
   frosted card floating on the light hero) so it reads as the same system.
   Hover or tap pauses. Reduced motion gets the static list and no cycling.

   Rows come from DEMO_ACTIONS, the same data the full interactive demo uses,
   so the hero teaser and the real thing can never drift apart. Deriving the
   visible window from a constant cursor keeps the server and the first client
   render in agreement, so the LCP element paints before hydration. */

const VISIBLE = 4;
const TICK_MS = 3400;

export function ApprovalQueue() {
  const reduced = useReducedMotion();
  const [cursor, setCursor] = useState(0);
  const [approved, setApproved] = useState(11);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const t = setInterval(() => {
      setCursor((c) => (c + 1) % DEMO_ACTIONS.length);
      setApproved((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [reduced, paused]);

  const items = Array.from({ length: VISIBLE }, (_, i) => DEMO_ACTIONS[(cursor + i) % DEMO_ACTIONS.length]!);

  return (
    <div
      className="deck"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused((p) => !p)}
    >
      <div className="deck-hd">
        <span>
          <b>{VISIBLE} waiting</b> / approval queue
        </span>
        <span className="cnt">{paused && !reduced ? "paused" : "live"}</span>
      </div>

      <ul className="cc-q">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item, i) => {
            const k = ACTION_KIND[item.kind];
            return (
              <motion.li
                key={item.id}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: 26, transition: { duration: 0.32, ease: EASE } }}
                transition={{ duration: 0.45, ease: EASE, delay: reduced ? 0 : i * 0.04 }}
                className="cc-qrow"
              >
                <span
                  className="cc-qglyph"
                  style={{ color: `rgb(${k.rgb})`, background: `rgba(${k.rgb},0.14)` }}
                  aria-hidden="true"
                >
                  {k.glyph}
                </span>
                <span className="cc-qtext">
                  <b>{item.title}</b>
                  <em>{item.because}</em>
                </span>
                <span className="cc-qacts" aria-hidden="true">
                  <span className="cc-qbtn cc-qyes">Approve</span>
                  <span className="cc-qbtn">Edit</span>
                  <span className="cc-qbtn">Skip</span>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="deck-ft cc-qft">
        <span>
          Approved today <b>{approved}</b>
        </span>
        <span>
          Edited <b>2</b> / Rejected <b>1</b>
        </span>
      </div>
    </div>
  );
}

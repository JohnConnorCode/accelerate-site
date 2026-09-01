"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { EASE } from "@/lib/animations";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { ACTION_KIND, DEMO_ACTIONS } from "./demo/demo-data";
import type { ActionKind, DemoAction } from "./demo/demo-data";

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

export type LiveQueueItem = Pick<DemoAction, "id" | "title" | "because"> & { kind: ActionKind };

type QueueCopy = {
  header: string;
  actions: readonly [string, string, string];
  footer: readonly [string, string];
};

const APPROVAL_COPY: QueueCopy = {
  header: "approval queue",
  actions: ["Approve", "Edit", "Skip"],
  footer: ["Approved today", "Edited 2 / Rejected 1"],
};

export function ApprovalQueue({
  items: source = DEMO_ACTIONS,
  header = APPROVAL_COPY.header,
  actions = APPROVAL_COPY.actions,
  footer = APPROVAL_COPY.footer,
  initialCount = 11,
}: {
  items?: readonly LiveQueueItem[];
  header?: string;
  actions?: QueueCopy["actions"];
  footer?: QueueCopy["footer"];
  initialCount?: number;
}) {
  const reduced = useHydratedReducedMotion();
  const [cursor, setCursor] = useState(0);
  const [approved, setApproved] = useState(initialCount);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const t = setInterval(() => {
      setCursor((c) => (c + 1) % source.length);
      setApproved((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [reduced, paused, source.length]);

  const items = Array.from({ length: VISIBLE }, (_, i) => source[(cursor + i) % source.length]!);

  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { damping: 20, stiffness: 100 });
  const smoothY = useSpring(mouseY, { damping: 20, stiffness: 100 });
  const rotateX = useTransform(smoothY, [-1, 1], [1.5, -1.5]);
  const rotateY = useTransform(smoothX, [-1, 1], [-1.5, 1.5]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!ref.current || reduced) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    mouseY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  return (
    <motion.div
      ref={ref}
      className="deck"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
        setPaused(false);
      }}
      onMouseEnter={() => setPaused(true)}
      onTouchStart={() => setPaused((p) => !p)}
      style={reduced ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
    >
      <div className="deck-hd">
        <span>
          <b>{VISIBLE} waiting</b> / {header}
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
                exit={
                  reduced
                    ? undefined
                    : { opacity: 0, x: 26, transition: { duration: 0.32, ease: EASE } }
                }
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
                  <span className="cc-qbtn cc-qyes">{actions[0]}</span>
                  <span className="cc-qbtn">{actions[1]}</span>
                  <span className="cc-qbtn">{actions[2]}</span>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="deck-ft cc-qft">
        <span>
          {footer[0]} <b>{approved}</b>
        </span>
        <span>{footer[1]}</span>
      </div>
    </motion.div>
  );
}

"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

interface PlanRow {
  label: string;
  value: string;
  detail?: string;
  tail?: string;
  mute?: boolean;
}
interface PlanPage {
  title: string;
  sub: string;
  rows: PlanRow[];
  note: string;
}

const PAGES: PlanPage[] = [
  {
    title: "1. Where the hours go",
    sub: "Named in the team's language, from the first session",
    rows: [
      { label: "Missed first contact", detail: "Calls and forms while the crew is on a job", value: "Evenings" },
      { label: "Median first response", detail: "Business hours only, today", value: "Hours", mute: true },
      { label: "Routine inquiry handling", detail: "Per week, across two people", value: "22 hrs" },
      { label: "Quote turnaround", detail: "Request to something the customer can act on", value: "Days" },
      { label: "Follow-up that depends on memory", detail: "Estimates that sit until someone has an evening", value: "Most" },
    ],
    note: "The team is spending the week on qualification and chasing. The work only they can do waits.",
  },
  {
    title: "2. What we take off them first",
    sub: "Sequenced so people get the week back where it counts",
    rows: [
      { label: "Phase 1: Front desk", detail: "Capture, qualification, and routing, including after hours", value: "Week 1" },
      { label: "Phase 2: Follow-up", detail: "The unclosed estimate that currently depends on memory", value: "Week 2" },
      { label: "Phase 3: CRM connection", detail: "So the record and the conversation stay in one place", value: "Week 3" },
      { label: "Phase 4: Field notes", detail: "End-of-day paperwork that should not need a desk", value: "Week 4", mute: true },
    ],
    note: "Phase one is live in under two weeks. The crew keeps doing jobs while the machine starts catching what they were missing.",
  },
  {
    title: "3. What the week looks like after",
    sub: "Typical on the workflows we take on, not a headline return",
    rows: [
      { label: "First response", detail: "While the inquiry is still warm, any hour", value: "Minutes" },
      { label: "Hours returned", detail: "Per person, per week, on the work we absorb", value: "~10 hrs" },
      { label: "Routine work absorbed", detail: "Intake, follow-up, scheduling no longer needs a person", value: "One role" },
      { label: "Who still decides", detail: "Anything that needs judgment comes to you", value: "You" },
      { label: "You own it", detail: "Accounts, code, documentation", value: "Yours" },
    ],
    note: "The same people spend the week on jobs, cases, and clients. We run the rest.",
  },
];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function PlanDeck() {
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [-1, 1], [1.5, -1.5]);
  const rotateY = useTransform(smoothX, [-1, 1], [-1.5, 1.5]);

  const go = (next: number) => {
    setIdx(Math.max(0, Math.min(PAGES.length - 1, next)));
    setDx(0);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setDragging(true);
    dragStart.current.x = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) {
      setDx(e.clientX - dragStart.current.x);
    }
    
    // Parallax
    if (!ref.current || reduced) return;
    const rect = ref.current.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseX.set(normX);
    mouseY.set(normY);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1));
    else setDx(0);
  };
  const onPointerLeave = () => {
    endDrag();
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div 
      ref={ref}
      className="deck transition-all duration-300"
      style={reduced ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      onPointerLeave={onPointerLeave}
    >
      <div className="deck-hd">
        <span>
          <b>Sample plan</b> · Regional services co.
        </span>
        <span className="cnt">
          {pad(idx + 1)} / {pad(PAGES.length)}
        </span>
      </div>
      <div
        className={`deck-view${dragging ? " drag" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
          if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
        }}
      >
        <div
          className="deck-track"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${dx}px))`,
            transition: dragging ? "none" : undefined,
          }}
        >
          {PAGES.map((page) => (
            <section className="page" key={page.title} aria-label={page.title}>
              <p className="page-t">{page.title}</p>
              <span className="page-s">{page.sub}</span>
              {page.rows.map((row) => (
                <div className={`prow${row.mute ? " mute" : ""}`} key={row.label}>
                  <span>
                    <b>{row.label}</b>
                    {row.detail && <em>{row.detail}</em>}
                  </span>
                  <span className="v">
                    {row.value} {row.tail && <em>{row.tail}</em>}
                  </span>
                </div>
              ))}
              <p className="pnote">{page.note}</p>
            </section>
          ))}
        </div>
      </div>
      <div className="deck-ft">
        <div className="dots" role="tablist" aria-label="Plan pages">
          {PAGES.map((page, i) => (
            <button
              key={page.title}
              role="tab"
              type="button"
              aria-label={`Page ${i + 1}`}
              aria-selected={i === idx}
              className={i === idx ? "on" : ""}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <span className="swipe-hint">Swipe</span>
        <div className="arrows">
          <button type="button" aria-label="Previous page" disabled={idx === 0} onClick={() => go(idx - 1)}>
            ←
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={idx === PAGES.length - 1}
            onClick={() => go(idx + 1)}
          >
            →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

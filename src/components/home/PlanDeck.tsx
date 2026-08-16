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
    title: "1. Diagnostic & Baseline Metrics",
    sub: "Measured over a 30-day sample period",
    rows: [
      { label: "Inbound lead abandonment", detail: "Dropped after 1st missed contact", value: "38%" },
      { label: "Median first response time", detail: "Business hours only", value: "4.8 hrs", mute: true },
      { label: "Time spent on routine inquiries", detail: "Per week, across 2 team members", value: "22 hrs" },
      { label: "Quote turnaround latency", detail: "Initial request to delivery", value: "3.2 days" },
      { label: "Estimated annual lost revenue", detail: "Due to delayed or missed follow-ups", value: "$142,000" },
    ],
    note: "Your team is spending significant time on qualification, leading to slow quoting and dropped leads on high-value projects before price is even discussed.",
  },
  {
    title: "2. Implementation Roadmap",
    sub: "Prioritized by immediate business value",
    rows: [
      { label: "Phase 1: AI Front Desk", detail: "24/7 capture, qualification & routing", value: "Week 1", tail: "· High ROI" },
      { label: "Phase 2: Automated Follow-ups", detail: "Multi-channel drip for unclosed quotes", value: "Week 2", tail: "· High ROI" },
      { label: "Phase 3: Deep CRM Integration", detail: "Bi-directional sync & pipeline updates", value: "Week 3", tail: "· Medium" },
      { label: "Phase 4: Field Voice Notes", detail: "End-of-day paperwork automation", value: "Week 4", mute: true },
    ],
    note: "We deploy in modular phases based on highest impact. You start capturing and qualifying leads automatically by day 7 without disrupting current operations.",
  },
  {
    title: "3. Projected 12-Month Impact",
    sub: "Modeled on similar regional service operators",
    rows: [
      { label: "Response time reduction", detail: "Under 3 minutes, 24/7/365", value: "98%" },
      { label: "Recovered administrative hours", detail: "Monthly hours returned to the team", value: "85+ hrs" },
      { label: "Lead-to-appointment conversion", detail: "Driven by automated persistent follow-up", value: "+24%" },
      { label: "Implementation cost recovery", detail: "Expected time to break even", value: "2.5 mo" },
      { label: "First-year ROI", detail: "Conservative estimate", value: "340%" },
    ],
    note: "By automating the top of your funnel, your operations team can focus entirely on closing qualified appointments and executing the actual work.",
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

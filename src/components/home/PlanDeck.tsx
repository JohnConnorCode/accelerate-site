"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

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
    title: "What the process costs today",
    sub: "Measured over four weeks",
    rows: [
      { label: "Inbound requests", detail: "per week", value: "41" },
      { label: "Median first reply", value: "19 hrs" },
      { label: "Median time to quote", value: "4.2 days" },
      { label: "Quotes revised for pricing errors", value: "1 in 5" },
      { label: "Inquiries never contacted twice", value: "22%" },
    ],
    note: "Competing bids come back within 48 hours. Most of the loss happens before anyone compares price.",
  },
  {
    title: "Opportunities, ranked",
    sub: "Value against effort",
    rows: [
      { label: "01 · Same-day quote drafting", detail: "Runs on the CRM you have", value: "3 wks", tail: "· high" },
      { label: "02 · Automated second contact", detail: "Recovers inquiries now dropped", value: "1 wk", tail: "· high" },
      { label: "03 · Field notes by voice", detail: "Ends evening paperwork", value: "2 wks", tail: "· med" },
      { label: "Not recommended · Website chat", detail: "Volume too low to return the effort", value: "n/a", mute: true },
    ],
    note: "Order follows dependency as well as value. Quoting produces the clean pricing data the follow-up needs.",
  },
  {
    title: "What delivery takes",
    sub: "Commitments on both sides",
    rows: [
      { label: "Your time", detail: "One operations lead", value: "2 hrs / wk" },
      { label: "Access needed", value: "CRM, inbox, price list" },
      { label: "Systems replaced", value: "None" },
      { label: "Live to your team", value: "Week 3" },
      { label: "Measured by", detail: "30 consecutive quotes", value: "Under 24 hrs" },
    ],
    note: "If turnaround does not hold under 24 hours across 30 quotes, the work is not finished.",
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
    if (!dragging) return;
    setDx(e.clientX - dragStart.current.x);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1));
    else setDx(0);
  };

  return (
    <div className="deck">
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
    </div>
  );
}

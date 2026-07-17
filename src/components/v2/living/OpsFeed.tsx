"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/utils";

type Kind = "call" | "text" | "follow" | "book" | "review" | "capture" | "won" | "paid";

interface Event {
  id: number;
  time: string;
  kind: Kind;
  label: string;
  value?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// Each event type carries its own color — the feed reads as a living, multi-channel
// system, not a one-note list. Money events (won/paid) glow green; ops events use
// a calm cool/warm spread so the eye can tell channels apart at a glance.
const KIND: Record<Kind, { glyph: string; rgb: string }> = {
  call:    { glyph: "●", rgb: "56,189,248" },   // sky — calls
  text:    { glyph: "→", rgb: "34,211,238" },   // cyan — texts
  follow:  { glyph: "↻", rgb: "167,139,250" },  // violet — follow-ups
  book:    { glyph: "✓", rgb: "190,242,100" },  // lime — bookings
  review:  { glyph: "★", rgb: "251,191,36" },   // amber — reviews
  capture: { glyph: "◆", rgb: "96,165,250" },   // blue — captures
  won:     { glyph: "✦", rgb: "163,230,53" },   // bright lime — deals
  paid:    { glyph: "＄", rgb: "52,211,153" },   // emerald — payments
};

const OPS: { kind: Kind; label: string }[] = [
  { kind: "call", label: "New inquiry → answered in 40s" },
  { kind: "capture", label: "After-hours inquiry captured" },
  { kind: "text", label: "Quote drafted → sent same day" },
  { kind: "follow", label: "Follow-up delivered" },
  { kind: "book", label: "Consultation booked" },
  { kind: "review", label: "Review request sent" },
  { kind: "book", label: "Appointment confirmed" },
  { kind: "follow", label: "Past customer re-engaged" },
  { kind: "call", label: "Weekly numbers → owner briefed" },
  { kind: "capture", label: "Web form routed to owner" },
];

const DEAL_AMOUNTS = [2400, 3200, 4800, 5600, 7200, 8900];
const PAY_AMOUNTS = [450, 850, 1250, 1800, 2400, 3100];
const money = (n: number) => `+$${n.toLocaleString("en-US")}`;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const isValue = (k: Kind) => k === "won" || k === "paid";

function clockFrom(base: number) {
  return new Date(base).toTimeString().slice(0, 8);
}

let counter = 7; // INITIAL_EVENTS occupies ids 0-6
function makeEvent(base: number, kind?: Kind, avoid?: string): Event {
  if (kind === "won") return { id: counter++, time: clockFrom(base), kind, label: "Deal closed", value: money(pick(DEAL_AMOUNTS)) };
  if (kind === "paid") return { id: counter++, time: clockFrom(base), kind, label: "Payment received", value: money(pick(PAY_AMOUNTS)) };
  // never repeat the previous line — a live feed that echoes itself reads as fake
  let op = pick(OPS);
  for (let g = 0; op.label === avoid && g < 8; g++) op = pick(OPS);
  return { id: counter++, time: clockFrom(base), kind: op.kind, label: op.label };
}

const MAX = 7;

// Deterministic SSR seed — the feed must be present in server HTML so the hero
// panel paints before hydration (LCP); times are re-stamped with the visitor's
// clock on mount. Must stay in sync with counter's start value below.
const INITIAL_EVENTS: Event[] = [
  { id: 6, time: "09:41:12", kind: "call", label: "New inquiry → answered in 40s" },
  { id: 5, time: "09:41:04", kind: "won", label: "Deal closed", value: "+$4,800" },
  { id: 4, time: "09:40:57", kind: "book", label: "Consultation booked" },
  { id: 3, time: "09:40:49", kind: "follow", label: "Follow-up delivered" },
  { id: 2, time: "09:40:41", kind: "paid", label: "Payment received", value: "+$1,250" },
  { id: 1, time: "09:40:33", kind: "capture", label: "After-hours inquiry captured" },
  { id: 0, time: "09:40:26", kind: "review", label: "Review request sent" },
];

export function OpsFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [count, setCount] = useState(47);
  // wall-clock seed for event timestamps — render-time read is intentional
  // eslint-disable-next-line react-hooks/purity
  const clock = useRef(Date.now());
  const paused = useRef(false);
  // visible paused state — driven by touch taps (mobile has no hover) so the
  // feed is interactive on phones, with a clear "Paused" affordance.
  const [showPaused, setShowPaused] = useState(false);
  const reduced = useReducedMotion();

  const setPaused = (v: boolean) => {
    paused.current = v;
    setShowPaused(v);
  };

  useEffect(() => {
    // re-stamp the deterministic SSR seed with the visitor's wall clock —
    // updates text in place (same ids), so nothing re-animates or flickers
    let t = Date.now() - MAX * 4200;
    const times: string[] = [];
    for (let i = 0; i < MAX; i++) {
      t += 3200 + Math.random() * 2400;
      times.push(clockFrom(t));
    }
    clock.current = t;
    setEvents((prev) => prev.map((e, i) => ({ ...e, time: times[MAX - 1 - i] ?? e.time })));
    setCount(38 + Math.floor(Math.random() * 24));

    if (prefersReducedMotion()) return;

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!paused.current) {
        clock.current += 2400 + Math.random() * 2400;
        setCount((c) => c + 1);
        setEvents((prev) => {
          // Guarantee a deal AND a payment always survive the next push, so the
          // feed never stops reading as revenue.
          const surviving = prev.slice(0, MAX - 1);
          const needWon = !surviving.some((e) => e.kind === "won");
          const needPaid = !surviving.some((e) => e.kind === "paid");
          const next = makeEvent(clock.current, needWon ? "won" : needPaid ? "paid" : undefined, prev[0]?.label);
          return [next, ...prev].slice(0, MAX);
        });
      }
      timer = setTimeout(tick, 2400 + Math.random() * 2000);
    };
    timer = setTimeout(tick, 1600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-[color-mix(in_srgb,var(--bg-elevated)_92%,transparent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl ${className ?? ""}`}
    >
      {/* title bar */}
      <div className="flex items-center justify-between border-b border-[var(--border-glass)] px-5 py-3.5">
        <span className="flex items-center gap-2.5 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-[var(--white-secondary)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold-base)] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--gold-base)]" />
          </span>
          live · operations
        </span>
        <button
          type="button"
          onClick={() => setPaused(!paused.current)}
          aria-pressed={showPaused}
          className="cursor-pointer"
        >
          <span className="sr-only">{showPaused ? "resume live feed:" : "pause live feed:"}</span>
          {showPaused ? (
            <span className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--gold-base)]">
              <span className="grid grid-cols-2 gap-[2px]">
                <span className="h-2 w-[3px] rounded-[1px] bg-[var(--gold-base)]" />
                <span className="h-2 w-[3px] rounded-[1px] bg-[var(--gold-base)]" />
              </span>
              paused
            </span>
          ) : (
            <span className="font-mono text-[0.68rem] tracking-wide text-[var(--white-muted)]">built for you</span>
          )}
        </button>
      </div>

      {/* processing strip — a scanning line + a live tally make it feel alive */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border-glass)] px-5 py-2.5">
        <div className="relative h-[3px] w-full max-w-[55%] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--white-muted)_25%,transparent)]">
          {!reduced && (
            <motion.span
              className="absolute inset-y-0 w-1/3 rounded-full bg-[var(--gold-base)]"
              animate={{ x: ["-120%", "330%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[0.66rem] tabular-nums tracking-wide text-[var(--white-muted)]">
          <span className="text-[var(--gold-base)]">↑</span>
          <motion.span key={count} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-[var(--white-secondary)]">
            {count}
          </motion.span>
          today
        </span>
      </div>

      {/* feed — hover to pause & read on desktop; TAP to pause on touch (no
          hover there). Each row is its own channel/color. Mobile gets tighter
          padding/text so the panel doesn't dominate the hero. */}
      <ul
        className="flex flex-col gap-0.5 p-2 font-mono text-[0.74rem] sm:gap-1 sm:p-2.5 sm:text-[0.82rem]"
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { setPaused(false); }}
        onPointerDown={(e) => { if (e.pointerType === "touch") setPaused(!paused.current); }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {events.map((e) => {
            const value = isValue(e.kind);
            const c = KIND[e.kind].rgb;
            return (
              <motion.li
                key={e.id}
                layout
                data-cursor="link"
                initial={{ opacity: 0, y: -14, backgroundColor: `rgba(${c},0.24)` }}
                animate={{
                  opacity: 1,
                  y: 0,
                  backgroundColor: value ? `rgba(${c},0.12)` : "rgba(0,0,0,0)",
                }}
                exit={{ opacity: 0, y: 6, height: 0, marginTop: 0, transition: { duration: 0.3, ease: "easeIn" } }}
                transition={{ duration: 0.55, ease: EASE, backgroundColor: { duration: 1.2, ease: "easeOut" } }}
                whileHover={{ x: 5, backgroundColor: `rgba(${c},0.16)` }}
                className="group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2.5"
                style={{ borderColor: value ? `rgba(${c},0.42)` : "transparent" }}
              >
                <span className="text-[0.68rem] tabular-nums text-[var(--white-muted)]">{e.time}</span>
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[0.72rem] transition-transform duration-300 group-hover:scale-110"
                  style={{ color: `rgb(${c})`, background: `rgba(${c},0.16)` }}
                >
                  {KIND[e.kind].glyph}
                </span>
                <span className={`flex-1 truncate ${value ? "font-semibold text-[var(--heading-color)]" : "text-[var(--white-secondary)]"}`}>
                  {e.label}
                </span>
                {e.value ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
                    className="shrink-0 font-bold tabular-nums"
                    style={{ color: `rgb(${c})` }}
                  >
                    {e.value}
                  </motion.span>
                ) : (
                  <span className="shrink-0 text-[var(--white-muted)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    ›
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* footer — reinforces that we build & run it (not a platform you manage) */}
      <div className="flex items-center justify-between border-t border-[var(--border-glass)] px-5 py-3 font-mono text-[0.64rem] uppercase tracking-[0.18em] text-[var(--white-muted)]">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-base)]" />
          running 24/7
        </span>
        <span>built &amp; run by Accelerate</span>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { CHANNEL, type FeedEvent } from "@/content/industry-feeds";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── OpsConsole ─── the site's signature live-operations console, rendered
   from a per-industry feed. Used by the homepage Industries switchboard and
   the vertical landing-page heroes. Re-keyed on `name` so the events restream
   with a stagger whenever the feed switches. */
export function OpsConsole({
  name,
  feed,
  label = "live",
  footer,
}: {
  name: string;
  feed: FeedEvent[];
  label?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-gold bg-[var(--bg-elevated)] shadow-2xl shadow-black/40">
      {/* terminal chrome */}
      <div className="flex items-center justify-between border-b border-border-glass px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold/70" />
          </span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white-muted">
            <span className="text-gold">● {label}</span> · {name} ops
          </span>
        </div>
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-white-muted">built for you</span>
      </div>

      {/* the bespoke feed — restreams whenever `name` changes */}
      <motion.ul
        key={name}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className="divide-y divide-border-glass/60 px-5 py-1"
      >
        {feed.map((e, i) => {
          const c = CHANNEL[e.channel];
          return (
            <motion.li
              key={`${name}-${i}`}
              variants={{
                hidden: { opacity: 0, x: -12 },
                show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
              }}
              className="flex items-center gap-3 py-3"
            >
              <span className="font-mono text-[0.62rem] tabular-nums text-white-muted">{e.time}</span>
              <span className="font-mono text-sm leading-none" style={{ color: `rgb(${c.rgb})` }}>{c.glyph}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-white-secondary">{e.label}</span>
            </motion.li>
          );
        })}
      </motion.ul>

      {footer && (
        <div className="border-t border-border-glass px-5 py-4">{footer}</div>
      )}
    </div>
  );
}

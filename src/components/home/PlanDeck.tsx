"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

import { homePlanDeckContent } from "@/content/site-studio/plan-deck";
import type { HomePlanDeckContent } from "@/lib/site-studio/native-templates";

export function PlanDeck({ content = homePlanDeckContent }: { content?: HomePlanDeckContent }) {
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
    setIdx(Math.max(0, Math.min(content.pages.length - 1, next)));
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
          <b>{content.label}</b> · {content.business}
        </span>
        <span className="cnt">
          {pad(idx + 1)} / {pad(content.pages.length)}
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
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(idx + 1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(idx - 1);
          }
        }}
      >
        <div
          className="deck-track"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${dx}px))`,
            transition: dragging ? "none" : undefined,
          }}
        >
          {content.pages.map((page) => (
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
          {content.pages.map((page, i) => (
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
        <span className="swipe-hint">{content.swipeLabel}</span>
        <div className="arrows">
          <button
            type="button"
            aria-label="Previous page"
            disabled={idx === 0}
            onClick={() => go(idx - 1)}
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={idx === content.pages.length - 1}
            onClick={() => go(idx + 1)}
          >
            →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

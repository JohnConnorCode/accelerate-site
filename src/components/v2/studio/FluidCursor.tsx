"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/utils";

type Variant = "default" | "link" | "tile";

/** Subscribe to fine-pointer + non-reduced-motion via useSyncExternalStore —
 *  lint-clean (no setState in effect) and SSR-safe. */
function useFluidCursorEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(pointer: fine)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => !prefersReducedMotion() && window.matchMedia("(pointer: fine)").matches,
    () => false,
  );
}

/**
 * Cuberto-style fluid cursor: a blend-difference follower with spring lag that
 * morphs + shows a contextual label over elements marked `data-cursor`.
 * Desktop / fine-pointer only; fully bypassed on touch + reduced-motion.
 */
export function FluidCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const on = useFluidCursorEnabled();
  const [variant, setVariant] = useState<Variant>("default");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!on) return;
    document.documentElement.classList.add("cursor-none");

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const cur = { ...target };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };
    const onOver = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      if (el) {
        setVariant(((el.dataset.cursor as Variant) || "link"));
        setLabel(el.dataset.cursorLabel ?? "");
      } else {
        setVariant("default");
        setLabel("");
      }
    };

    const loop = () => {
      cur.x += (target.x - cur.x) * 0.2;
      cur.y += (target.y - cur.y) * 0.2;
      const el = ref.current;
      if (el) el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerover", onOver);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      document.documentElement.classList.remove("cursor-none");
    };
  }, [on]);

  if (!on) return null;

  const size = variant === "tile" ? 104 : variant === "link" ? 60 : 16;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] flex items-center justify-center rounded-full mix-blend-difference"
      style={{
        width: size,
        height: size,
        background: variant === "default" ? "var(--gold-base)" : "rgba(var(--accent-rgb),0.15)",
        border: variant === "default" ? "none" : "1.5px solid var(--gold-base)",
        transition: "width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1), background-color 0.3s",
        willChange: "transform",
      }}
    >
      {label && (
        <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.15em] text-gold">
          {label}
        </span>
      )}
    </div>
  );
}

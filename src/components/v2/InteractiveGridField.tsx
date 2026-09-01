"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-reactive point grid rendered on a 2D canvas.
 * Points drift on a slow sine wave ("alive") and are attracted + brightened
 * near the pointer. Lime accent on near-black. Respects reduced-motion.
 */
export function InteractiveGridField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const context = el.getContext("2d");
    if (!context) return;
    const canvas: HTMLCanvasElement = el;
    const ctx: CanvasRenderingContext2D = context;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const SPACING = 38;
    const DOT = 1.3;
    const RADIUS = 170; // pointer influence
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;

    const pointer = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let t = 0;

    // Read theme colors from CSS tokens so the field adapts to light/dark.
    let accent = "198,255,61";
    let dot = "190,200,210";
    function readTheme() {
      const cs = getComputedStyle(document.documentElement);
      accent = cs.getPropertyValue("--accent-rgb").trim() || accent;
      dot = cs.getPropertyValue("--field-dot-rgb").trim() || dot;
    }
    readTheme();
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / SPACING) + 1;
      rows = Math.ceil(h / SPACING) + 1;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.012;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const baseX = i * SPACING;
          const baseY = j * SPACING;

          // slow organic drift
          const wave = reduced ? 0 : Math.sin(t + i * 0.45 + j * 0.3) * 1.6;
          let x = baseX + wave;
          let y = baseY + wave;

          // pointer attraction + brightness
          let alpha = 0.22;
          let size = DOT;
          if (pointer.active) {
            const dx = pointer.x - baseX;
            const dy = pointer.y - baseY;
            const dist = Math.hypot(dx, dy);
            if (dist < RADIUS) {
              const f = 1 - dist / RADIUS;
              x += dx * f * 0.22;
              y += dy * f * 0.22;
              alpha = 0.16 + f * 0.8;
              size = DOT + f * 1.8;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = alpha > 0.35 ? `rgba(${accent},${alpha})` : `rgba(${dot},${alpha})`;
          ctx.fill();
        }
      }

      // soft glow around pointer
      if (pointer.active) {
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, RADIUS);
        g.addColorStop(0, `rgba(${accent},0.10)`);
        g.addColorStop(1, `rgba(${accent},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(pointer.x - RADIUS, pointer.y - RADIUS, RADIUS * 2, RADIUS * 2);
      }

      raf = requestAnimationFrame(draw);
    }

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }
    function onLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

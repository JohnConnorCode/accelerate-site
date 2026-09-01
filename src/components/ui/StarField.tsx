"use client";

import { useRef, useEffect, useCallback } from "react";
import { prefersReducedMotion } from "@/lib/utils";

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  depth: number;
  r: number;
  g: number;
  b: number;
  targetX: number;
  targetY: number;
  sizeBoost: number;
}

const STAR_COUNT_DESKTOP = 280;
const STAR_COUNT_MOBILE = 120;
const PARALLAX_STRENGTH = 12;
const CLICK_RADIUS = 0.15;
const CLICK_SIZE_BOOST = 2.0;
const CLICK_DECAY = 0.97;

const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [255, 248, 230],
  [240, 220, 180],
  [212, 175, 55],
  [245, 215, 110],
  [255, 240, 200],
];

function pickColor(): [number, number, number] {
  const roll = Math.random();
  if (roll < 0.35) return STAR_COLORS[0]!;
  if (roll < 0.6) return STAR_COLORS[1]!;
  if (roll < 0.75) return STAR_COLORS[5]!;
  return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]!;
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animId = useRef(0);
  const time = useRef(0);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const stars = useRef<Star[]>([]);
  const dpr = useRef(1);

  const onMove = useCallback((e: MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mouse.current.x = (e.clientX - r.left) / r.width;
    mouse.current.y = (e.clientY - r.top) / r.height;
  }, []);

  const onLeave = useCallback(() => {
    mouse.current.x = 0.5;
    mouse.current.y = 0.5;
  }, []);

  const onClick = useCallback((e: MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const pts = stars.current;
    for (let i = 0; i < pts.length; i++) {
      const s = pts[i]!;
      const dx = s.x - clickX;
      const dy = s.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CLICK_RADIUS) {
        const influence = 1 - dist / CLICK_RADIUS;
        const angle = Math.random() * Math.PI * 2;
        const shift = 0.02 + Math.random() * 0.04 * influence;
        s.targetX = Math.max(0.01, Math.min(0.99, s.x + Math.cos(angle) * shift));
        s.targetY = Math.max(0.01, Math.min(0.99, s.y + Math.sin(angle) * shift));
        s.sizeBoost = 1 + (CLICK_SIZE_BOOST - 1) * influence;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dpr.current = Math.min(window.devicePixelRatio || 1, 2);

    function initStars() {
      const isMobile = window.innerWidth < 640;
      const count = isMobile ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;
      const pts: Star[] = [];
      for (let i = 0; i < count; i++) {
        const [r, g, b] = pickColor();
        const depth = Math.random();
        const x = Math.random();
        const y = Math.random();
        pts.push({
          x,
          y,
          size: 0.5 + Math.random() * 1.3 + depth * 0.4,
          baseOpacity: 0.3 + Math.random() * 0.5 + depth * 0.2,
          twinkleSpeed: 0.4 + Math.random() * 2.0,
          twinklePhase: Math.random() * Math.PI * 2,
          depth,
          r,
          g,
          b,
          targetX: x,
          targetY: y,
          sizeBoost: 1,
        });
      }
      stars.current = pts;
    }

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const d = dpr.current;
      canvas.width = rect.width * d;
      canvas.height = rect.height * d;
    }

    initStars();
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", onClick);

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const d = dpr.current;
      time.current += 1;
      const seconds = time.current / 60;

      const sm = smoothMouse.current;
      sm.x += (mouse.current.x - sm.x) * 0.03;
      sm.y += (mouse.current.y - sm.y) * 0.03;
      const mx = (sm.x - 0.5) * 2;
      const my = (sm.y - 0.5) * 2;

      // Clear to transparent
      ctx.clearRect(0, 0, w, h);

      const pts = stars.current;
      for (let i = 0; i < pts.length; i++) {
        const s = pts[i]!;

        // Drift toward target (click scatter)
        s.x += (s.targetX - s.x) * 0.04;
        s.y += (s.targetY - s.y) * 0.04;

        // Decay size boost
        if (s.sizeBoost > 1.005) {
          s.sizeBoost = 1 + (s.sizeBoost - 1) * CLICK_DECAY;
        } else {
          s.sizeBoost = 1;
        }

        const twinkle =
          0.5 + 0.5 * (0.5 + 0.5 * Math.sin(seconds * s.twinkleSpeed + s.twinklePhase));
        const alpha = s.baseOpacity * twinkle;
        if (alpha < 0.02) continue;

        const parallax = (0.15 + s.depth * 0.85) * PARALLAX_STRENGTH * d;
        const px = s.x * w + mx * parallax;
        const py = s.y * h + my * parallax * 0.4;

        const sz = s.size * s.sizeBoost * d;

        // Subtle glow on brighter stars
        if ((s.baseOpacity > 0.35 && sz > 0.8) || s.sizeBoost > 1.1) {
          ctx.beginPath();
          ctx.arc(px, py, sz * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha * 0.12 * Math.max(1, s.sizeBoost * 0.5)})`;
          ctx.fill();
        }

        // Star dot
        if (sz < 1.2) {
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha})`;
          ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, sz * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha})`;
          ctx.fill();
        }
      }

      animId.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", onClick);
    };
  }, [onMove, onLeave, onClick]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      aria-hidden="true"
    />
  );
}

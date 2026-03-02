"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTheme } from "next-themes";
import { prefersReducedMotion } from "@/lib/utils";

interface Star {
  x: number;        // 0-1 normalized
  y: number;        // 0-1 normalized (within sky area)
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
  depth: number;    // parallax layer (0 = far, 1 = near)
  r: number;
  g: number;
  b: number;
  // Click effect state
  targetX: number;
  targetY: number;
  sizeBoost: number;  // multiplicative, decays back to 1
}

const STAR_COUNT = 280;
const PARALLAX_STRENGTH = 18;
const CLICK_RADIUS = 0.12;      // normalized radius of click influence
const CLICK_SIZE_BOOST = 2.2;   // how much stars grow on click
const CLICK_DECAY = 0.97;       // how fast sizeBoost decays back to 1

const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [255, 248, 230],
  [240, 220, 180],
  [212, 175, 55],
  [245, 215, 110],
  [255, 240, 200],
];

function pickStarColor(): [number, number, number] {
  const roll = Math.random();
  if (roll < 0.35) return STAR_COLORS[0]!;
  if (roll < 0.6) return STAR_COLORS[1]!;
  if (roll < 0.75) return STAR_COLORS[5]!;
  return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]!;
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animId = useRef(0);
  const time = useRef(0);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const stars = useRef<Star[]>([]);
  const horizonFrac = useRef(0.55);
  const dpr = useRef(1);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  // Track grid height as state so JSX updates when horizon changes
  const [gridHeight, setGridHeight] = useState("42%");

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
    const horizon = horizonFrac.current;

    // Normalize click Y to sky area (0 to horizon)
    const clickYNorm = clickY / horizon;
    if (clickYNorm > 1) return; // clicked below horizon, ignore for stars

    const pts = stars.current;
    for (let i = 0; i < pts.length; i++) {
      const s = pts[i]!;
      const dx = s.x - clickX;
      const dy = s.y - clickYNorm;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CLICK_RADIUS) {
        const influence = 1 - dist / CLICK_RADIUS;
        // Shift to a new nearby position
        const angle = Math.random() * Math.PI * 2;
        const shift = 0.02 + Math.random() * 0.04 * influence;
        s.targetX = Math.max(0.01, Math.min(0.99, s.x + Math.cos(angle) * shift));
        s.targetY = Math.max(0.01, Math.min(0.99, s.y + Math.sin(angle) * shift));
        // Boost size proportional to proximity
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
      const pts: Star[] = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const [r, g, b] = pickStarColor();
        const depth = Math.random();
        const x = Math.random();
        const y = Math.random();
        pts.push({
          x,
          y,
          size: 0.4 + Math.random() * 1.1 + depth * 0.3,
          baseOpacity: 0.12 + Math.random() * 0.65 + depth * 0.15,
          twinkleSpeed: 0.4 + Math.random() * 2.0,
          twinklePhase: Math.random() * Math.PI * 2,
          depth,
          r, g, b,
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

      const aspect = canvas.width / canvas.height;
      if (aspect > 1.2) {
        horizonFrac.current = 0.58;
        setGridHeight("42%"); // 100% - 58% = 42%
      } else if (aspect > 0.8) {
        horizonFrac.current = 0.50;
        setGridHeight("50%"); // 100% - 50% = 50%
      } else {
        horizonFrac.current = 0.45;
        setGridHeight("55%"); // 100% - 45% = 55%
      }
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
      const t = time.current;
      const seconds = t / 60;
      const horizon = horizonFrac.current;
      const horizonY = h * horizon;

      // Smooth mouse
      const sm = smoothMouse.current;
      sm.x += (mouse.current.x - sm.x) * 0.03;
      sm.y += (mouse.current.y - sm.y) * 0.03;
      const mx = (sm.x - 0.5) * 2;
      const my = (sm.y - 0.5) * 2;

      // Background
      const bgFill = isDark ? "rgba(10,8,6,1)" : "rgba(250,250,248,1)";
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, w, h);

      // Subtle sky gradient — slightly warmer near horizon
      if (isDark) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "rgba(10,8,6,1)");
        skyGrad.addColorStop(0.8, "rgba(14,11,7,1)");
        skyGrad.addColorStop(1, "rgba(20,16,8,1)");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY + 2);
      }

      // --- Stars ---
      const pts = stars.current;
      for (let i = 0; i < pts.length; i++) {
        const s = pts[i]!;

        // Animate position toward target (click drift)
        s.x += (s.targetX - s.x) * 0.04;
        s.y += (s.targetY - s.y) * 0.04;

        // Decay size boost back to 1
        if (s.sizeBoost > 1.005) {
          s.sizeBoost = 1 + (s.sizeBoost - 1) * CLICK_DECAY;
        } else {
          s.sizeBoost = 1;
        }

        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(seconds * s.twinkleSpeed + s.twinklePhase));
        const alpha = s.baseOpacity * twinkle;
        if (alpha < 0.02) continue;

        // Stars positioned in sky area (0 to horizon)
        const parallax = (0.15 + s.depth * 0.85) * PARALLAX_STRENGTH * d;
        const px = s.x * w + mx * parallax;
        const py = s.y * horizonY + my * parallax * 0.4;

        // Don't render below horizon
        if (py > horizonY) continue;

        const sz = s.size * s.sizeBoost * d;

        // Faint halo on brighter/boosted stars
        if ((s.baseOpacity > 0.5 && sz > 1) || s.sizeBoost > 1.1) {
          ctx.beginPath();
          ctx.arc(px, py, sz * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha * 0.04 * Math.max(1, s.sizeBoost * 0.5)})`;
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

      // --- Horizon glow ---
      const breathe = 0.93 + Math.sin(seconds * 0.4) * 0.07;

      if (isDark) {
        // Soft diffused glow centered on horizon — single clean gradient
        const glow = ctx.createRadialGradient(
          w * 0.5, horizonY, 0,
          w * 0.5, horizonY, w * 0.45,
        );
        glow.addColorStop(0, `rgba(212,175,55,${0.09 * breathe})`);
        glow.addColorStop(0.25, `rgba(212,175,55,${0.04 * breathe})`);
        glow.addColorStop(0.6, `rgba(200,160,45,${0.01 * breathe})`);
        glow.addColorStop(1, "rgba(200,160,45,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, horizonY - h * 0.2, w, h * 0.3);

        // Horizon line — soft atmospheric glow, no hard edges
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // Core line — very gentle fade from edges, long transparent tails
        const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
        lineGrad.addColorStop(0, "rgba(212,175,55,0)");
        lineGrad.addColorStop(0.25, `rgba(212,175,55,${0.10 * breathe})`);
        lineGrad.addColorStop(0.5, `rgba(245,220,120,${0.20 * breathe})`);
        lineGrad.addColorStop(0.75, `rgba(212,175,55,${0.10 * breathe})`);
        lineGrad.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = lineGrad;
        ctx.fillRect(0, horizonY - 0.5 * d, w, 1 * d);

        // Feathered bloom — full-width, soft vertical spread
        const bloomH = 16 * d;
        const bloom = ctx.createLinearGradient(0, horizonY - bloomH, 0, horizonY + bloomH);
        bloom.addColorStop(0, "rgba(212,175,55,0)");
        bloom.addColorStop(0.3, `rgba(212,175,55,${0.015 * breathe})`);
        bloom.addColorStop(0.5, `rgba(235,200,80,${0.04 * breathe})`);
        bloom.addColorStop(0.7, `rgba(212,175,55,${0.015 * breathe})`);
        bloom.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, horizonY - bloomH, w, bloomH * 2);

        ctx.restore();
      } else {
        // Light mode — subtle warm line
        const glow = ctx.createRadialGradient(
          w * 0.5, horizonY, 0,
          w * 0.5, horizonY, w * 0.35,
        );
        glow.addColorStop(0, `rgba(154,123,16,${0.06 * breathe})`);
        glow.addColorStop(0.3, `rgba(154,123,16,${0.02 * breathe})`);
        glow.addColorStop(1, "rgba(154,123,16,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, horizonY - h * 0.15, w, h * 0.2);

        const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
        lineGrad.addColorStop(0, "rgba(154,123,16,0)");
        lineGrad.addColorStop(0.2, `rgba(154,123,16,${0.12 * breathe})`);
        lineGrad.addColorStop(0.5, `rgba(184,148,31,${0.20 * breathe})`);
        lineGrad.addColorStop(0.8, `rgba(154,123,16,${0.12 * breathe})`);
        lineGrad.addColorStop(1, "rgba(154,123,16,0)");
        ctx.fillStyle = lineGrad;
        ctx.fillRect(0, horizonY - 0.5 * d, w, 1 * d);
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
  }, [onMove, onLeave, onClick, isDark]);

  return (
    <div
      data-hero-bg
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {/* Stars + horizon glow canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      />

      {/* Tron perspective grid floor — dynamically aligned with canvas horizon */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-[2]"
        style={{
          height: gridHeight,
          overflow: "hidden",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 80%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 80%, transparent 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-20%",
            width: "140%",
            height: "100%",
            perspective: "500px",
            perspectiveOrigin: "50% 0%",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: isDark
                ? "linear-gradient(rgba(212,175,55,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.10) 1px, transparent 1px)"
                : "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
              transform: "rotateX(72deg)",
              transformOrigin: "50% 0%",
              animation: "tron-grid-scroll 8s linear infinite",
            }}
          />
        </div>
      </div>

      {/* Bottom fade for section transition */}
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-[3]"
        style={{
          background: isDark
            ? "linear-gradient(180deg, transparent, rgba(12,10,7,1))"
            : "linear-gradient(180deg, transparent, var(--bg-section-warm))",
        }}
      />
    </div>
  );
}

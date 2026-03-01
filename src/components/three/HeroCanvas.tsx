"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";

// Value noise for organic perturbation
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise2d(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeAngle: number;
  homeRadius: number;
  orbitSpeed: number;
  size: number;
  r: number;
  g: number;
  b: number;
  opacity: number;
  depth: number;
}

const PALETTE: [number, number, number][] = [
  [212, 175, 55],
  [235, 200, 80],
  [245, 215, 110],
  [200, 160, 45],
  [180, 145, 35],
  [255, 225, 130],
];

function pickColor(): [number, number, number] {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? PALETTE[0]!;
}

// Swarm orb parameters
const COUNT = 500;
const SPRING = 0.007;
const DAMPING = 0.96;
const NOISE_SCALE = 0.003;
const NOISE_SPEED = 0.0015;
const NOISE_FORCE = 0.8;
const MOUSE_INFLUENCE = 0.2;
const REPEL_RADIUS_FACTOR = 0.35;
const REPEL_FORCE = 3.5;
const BURST_DURATION = 40;
const BURST_FORCE = 18;
const BURST_RADIUS_FACTOR = 0.8;
const RING_DURATION = 30;

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animId = useRef(0);
  const time = useRef(0);
  const mouse = useRef({ x: -9999, y: -9999, active: false });
  const particles = useRef<Particle[]>([]);
  const orbCenter = useRef({ x: 0, y: 0 });
  const orbRadius = useRef(250);
  const smoothMouse = useRef({ x: 0, y: 0 });
  const clickBurst = useRef<{ x: number; y: number; frame: number } | null>(null);
  const dpr = useRef(1);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const onMove = useCallback((e: MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = dpr.current;
    mouse.current.x = (e.clientX - r.left) * d;
    mouse.current.y = (e.clientY - r.top) * d;
    mouse.current.active = true;
  }, []);

  const onLeave = useCallback(() => {
    mouse.current.active = false;
  }, []);

  const onClick = useCallback((e: MouseEvent) => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const d = dpr.current;
    clickBurst.current = {
      x: (e.clientX - r.left) * d,
      y: (e.clientY - r.top) * d,
      frame: time.current,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    dpr.current = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const d = dpr.current;
      canvas.width = rect.width * d;
      canvas.height = rect.height * d;

      orbCenter.current.x = canvas.width * 0.5;
      orbCenter.current.y = canvas.height * 0.44;
      orbRadius.current = Math.min(canvas.width, canvas.height) * 0.32;
      smoothMouse.current.x = orbCenter.current.x;
      smoothMouse.current.y = orbCenter.current.y;

      const oX = orbCenter.current.x;
      const oY = orbCenter.current.y;
      const oR = orbRadius.current;
      const pts: Particle[] = [];

      for (let i = 0; i < COUNT; i++) {
        const [r, g, b] = pickColor();
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.pow(Math.random(), 0.6) * oR;
        const depth = Math.random();
        pts.push({
          x: oX + Math.cos(angle) * radius,
          y: oY + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          homeAngle: angle,
          homeRadius: radius,
          orbitSpeed:
            (0.0004 + Math.random() * 0.0018) *
            (Math.random() > 0.5 ? 1 : -1) *
            (0.5 + depth * 0.5),
          size: (0.6 + Math.random() * 2.2) * (0.6 + depth * 0.4),
          r, g, b,
          opacity: (0.3 + Math.random() * 0.7) * (0.5 + depth * 0.5),
          depth,
        });
      }
      particles.current = pts;
      const bgFill = isDark ? "rgba(10,8,6,1)" : "rgba(250,250,248,1)";
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

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
      const pts = particles.current;
      const m = mouse.current;
      const orb = orbCenter.current;
      const oR = orbRadius.current;
      const sm = smoothMouse.current;
      time.current += 1;
      const t = time.current;

      // Smooth mouse tracking
      const tgtX = m.active ? m.x : orb.x;
      const tgtY = m.active ? m.y : orb.y;
      sm.x += (tgtX - sm.x) * 0.04;
      sm.y += (tgtY - sm.y) * 0.04;

      // Swarm center shifts toward mouse
      const swarmX = orb.x + (sm.x - orb.x) * MOUSE_INFLUENCE;
      const swarmY = orb.y + (sm.y - orb.y) * MOUSE_INFLUENCE;

      // Clear canvas fully — no trails, crisp particles
      ctx.clearRect(0, 0, w, h);
      const bgFill = isDark ? "rgba(10,8,6,1)" : "rgba(250,250,248,1)";
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, w, h);

      // Breathing pulse for organic feel
      const breathe = 0.9 + Math.sin(t * 0.015) * 0.1;

      // Ambient glow at swarm center — ties particles into a unified orb
      const glowGrad = ctx.createRadialGradient(
        swarmX, swarmY, 0,
        swarmX, swarmY, oR * 1.8,
      );
      if (isDark) {
        glowGrad.addColorStop(0, `rgba(212,175,55,${0.12 * breathe})`);
        glowGrad.addColorStop(0.3, `rgba(212,175,55,${0.06 * breathe})`);
        glowGrad.addColorStop(0.6, `rgba(200,160,45,${0.02 * breathe})`);
        glowGrad.addColorStop(1, "rgba(212,175,55,0)");
      } else {
        glowGrad.addColorStop(0, `rgba(184,148,31,${0.14 * breathe})`);
        glowGrad.addColorStop(0.3, `rgba(184,148,31,${0.08 * breathe})`);
        glowGrad.addColorStop(0.6, `rgba(154,123,16,${0.03 * breathe})`);
        glowGrad.addColorStop(1, "rgba(154,123,16,0)");
      }
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // Click burst — explosive scatter + expanding ring
      const burst = clickBurst.current;
      if (burst) {
        const age = t - burst.frame;
        if (age < BURST_DURATION) {
          const burstRadius = oR * BURST_RADIUS_FACTOR;
          const decay = Math.max(0, 1 - age / BURST_DURATION);
          const force = decay * decay * BURST_FORCE;
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i]!;
            const dx = p.x - burst.x;
            const dy = p.y - burst.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < burstRadius && dist > 1) {
              const f = ((1 - dist / burstRadius) ** 1.5) * force * d;
              p.vx += (dx / dist) * f;
              p.vy += (dy / dist) * f;
            }
          }
        }
        // Expanding ring visual
        if (age < RING_DURATION) {
          const progress = age / RING_DURATION;
          const ringRadius = 10 * d + progress * oR * 0.6;
          const ringAlpha = (1 - progress) * (isDark ? 0.35 : 0.25);
          ctx.beginPath();
          ctx.arc(burst.x, burst.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212,175,55,${ringAlpha})`;
          ctx.lineWidth = (2.5 - progress * 2) * d;
          ctx.stroke();
          // Inner flash
          if (age < 8) {
            const flashAlpha = (1 - age / 8) * (isDark ? 0.15 : 0.1);
            const flashGrad = ctx.createRadialGradient(
              burst.x, burst.y, 0,
              burst.x, burst.y, 40 * d,
            );
            flashGrad.addColorStop(0, `rgba(255,235,160,${flashAlpha})`);
            flashGrad.addColorStop(1, "rgba(255,235,160,0)");
            ctx.fillStyle = flashGrad;
            ctx.fill();
          }
        } else if (age >= BURST_DURATION) {
          clickBurst.current = null;
        }
      }

      const repelR = oR * REPEL_RADIUS_FACTOR;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;

        // Orbit slowly
        p.homeAngle += p.orbitSpeed;

        // Home position relative to swarm center
        const homeX = swarmX + Math.cos(p.homeAngle) * p.homeRadius;
        const homeY = swarmY + Math.sin(p.homeAngle) * p.homeRadius;

        // Organic noise perturbation
        const noiseT = t * NOISE_SPEED;
        const nx =
          (noise2d(p.x * NOISE_SCALE + noiseT, p.y * NOISE_SCALE + i * 0.1) *
            2 -
            1) *
          NOISE_FORCE;
        const ny =
          (noise2d(p.x * NOISE_SCALE + i * 0.1, p.y * NOISE_SCALE + noiseT) *
            2 -
            1) *
          NOISE_FORCE;

        // Spring toward home + noise
        p.vx += (homeX - p.x) * SPRING + nx;
        p.vy += (homeY - p.y) * SPRING + ny;

        // Mouse repulsion — scatter on close approach
        if (m.active) {
          const dx = p.x - m.x;
          const dy = p.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < repelR && dist > 1) {
            const force = ((1 - dist / repelR) ** 2) * REPEL_FORCE * d;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        // Damping
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx;
        p.y += p.vy;

        // Edge fade — particles dim as they drift from the swarm
        const distFromCenter = Math.sqrt(
          (p.x - swarmX) ** 2 + (p.y - swarmY) ** 2,
        );
        const edgeFade = Math.max(
          0,
          1 - Math.pow(distFromCenter / (oR * 1.8), 2),
        );
        const alpha = p.opacity * edgeFade;

        if (alpha < 0.01) continue;

        const sz = p.size * d;

        // Soft halo — glass blur will expand this into a natural glow
        if (sz > 0.8) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.06})`;
          ctx.fill();
        }

        // Main particle body
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fill();

        // Bright core on larger particles
        if (p.size > 1.3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,245,210,${alpha * 0.6})`;
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
  }, [onMove, onLeave, onClick, isDark]);

  return (
    <div
      data-hero-bg
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      {/* Swarm orb canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ opacity: 1 }}
      />

      {/* Subtle glass — light frosting, preserves particle clarity */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          backdropFilter: "blur(2px) saturate(120%)",
          WebkitBackdropFilter: "blur(2px) saturate(120%)",
          background: isDark
            ? "radial-gradient(ellipse 55% 45% at 50% 44%, rgba(10,8,6,0.15) 0%, rgba(10,8,6,0.05) 70%, transparent 100%)"
            : "radial-gradient(ellipse 55% 45% at 50% 44%, rgba(250,250,248,0.2) 0%, rgba(250,250,248,0.08) 70%, transparent 100%)",
        }}
      />

      {/* Grid — futuristic tech overlay, sits above glass */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundImage: isDark
            ? "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
            : "linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, transparent 75%)",
        }}
      />

      {/* Bottom fade for section transition */}
      <div
        className="absolute inset-x-0 bottom-0 h-48 pointer-events-none z-[3]"
        style={{
          background: isDark
            ? "linear-gradient(180deg, transparent, rgba(12,10,7,1))"
            : "linear-gradient(180deg, transparent, var(--bg-section-warm))",
        }}
      />

      {/* Top vignette */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none z-[3]"
        style={{
          background: isDark
            ? "linear-gradient(0deg, transparent, rgba(10,8,6,0.4))"
            : "linear-gradient(0deg, transparent, rgba(250,250,248,0.4))",
        }}
      />
    </div>
  );
}

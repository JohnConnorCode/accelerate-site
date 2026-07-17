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

interface ShootingStar {
  x: number;       // current pixel position
  y: number;
  vx: number;      // velocity in pixels/frame
  vy: number;
  life: number;    // frames remaining
  maxLife: number;
  size: number;
  tailLen: number; // trail length in pixels
}

const STAR_COUNT_DESKTOP = 360;
const STAR_COUNT_MOBILE = 140;
const PARALLAX_STRENGTH = 18;
const CLICK_RADIUS = 0.12;
const CLICK_SIZE_BOOST = 2.2;
const CLICK_DECAY = 0.97;

// Shooting star config
const SHOOT_CHANCE = 0.003;    // chance per frame (~1 every 5-6 seconds at 60fps)
const SHOOT_MIN_LIFE = 40;
const SHOOT_MAX_LIFE = 80;

const STAR_COLORS: [number, number, number][] = [
  [255, 255, 255],
  [255, 248, 230],
  [240, 220, 180],
  [212, 175, 55],
  [245, 215, 110],
  [255, 240, 200],
];

const LIGHT_STAR_COLORS: [number, number, number][] = [
  [11, 122, 122],
  [20, 149, 154],
  [6, 95, 115],
  [15, 135, 140],
  [8, 108, 125],
  [22, 145, 150],
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
  const shootingStars = useRef<ShootingStar[]>([]);
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

    const clickYNorm = clickY / horizon;
    if (clickYNorm > 1) return;

    const pts = stars.current;
    for (let i = 0; i < pts.length; i++) {
      const s = pts[i]!;
      const dx = s.x - clickX;
      const dy = s.y - clickYNorm;
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
        const [r, g, b] = pickStarColor();
        const depth = Math.random();
        const x = Math.random();
        const y = Math.random();
        pts.push({
          x,
          y,
          size: 0.5 + Math.random() * 1.2 + depth * 0.4,
          baseOpacity: 0.25 + Math.random() * 0.55 + depth * 0.2,
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

    function spawnShootingStar(w: number, h: number, horizon: number) {
      const horizonY = h * horizon;
      // Start from random position in sky, moving diagonally downward
      const startX = Math.random() * w * 0.8 + w * 0.1;
      const startY = Math.random() * horizonY * 0.6;
      const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2; // 27-63 degrees downward
      const speed = 4 + Math.random() * 6;
      const life = SHOOT_MIN_LIFE + Math.floor(Math.random() * (SHOOT_MAX_LIFE - SHOOT_MIN_LIFE));

      shootingStars.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: 1 + Math.random() * 1.5,
        tailLen: 60 + Math.random() * 80,
      });
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
        setGridHeight("42%");
      } else if (aspect > 0.8) {
        horizonFrac.current = 0.50;
        setGridHeight("50%");
      } else {
        horizonFrac.current = 0.45;
        setGridHeight("55%");
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

      // Sky gradient — deep dark with subtle blue-indigo tones for richness
      if (isDark) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "rgba(8,8,14,1)");
        skyGrad.addColorStop(0.3, "rgba(10,10,16,1)");
        skyGrad.addColorStop(0.6, "rgba(12,11,14,1)");
        skyGrad.addColorStop(0.85, "rgba(16,14,10,1)");
        skyGrad.addColorStop(1, "rgba(22,18,10,1)");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY + 2);

        // Subtle atmospheric nebula band — adds depth to mid-sky
        const nebulaY = horizonY * 0.35;
        const nebulaH = horizonY * 0.4;
        const nebula = ctx.createRadialGradient(
          w * 0.4, nebulaY, 0,
          w * 0.4, nebulaY, w * 0.5,
        );
        nebula.addColorStop(0, "rgba(30,25,50,0.12)");
        nebula.addColorStop(0.4, "rgba(25,20,45,0.06)");
        nebula.addColorStop(1, "rgba(20,15,35,0)");
        ctx.fillStyle = nebula;
        ctx.fillRect(0, nebulaY - nebulaH * 0.5, w, nebulaH);
      } else {
        // Light mode sky: subtle cool white to soft teal
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, "rgb(248,250,252)");
        skyGrad.addColorStop(0.4, "rgb(244,249,251)");
        skyGrad.addColorStop(0.7, "rgb(234,246,250)");
        skyGrad.addColorStop(0.85, "rgb(218,240,246)");
        skyGrad.addColorStop(1, "rgb(200,232,240)");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY + 2);

        // Below horizon: soft teal fading to base
        const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        groundGrad.addColorStop(0, "rgb(200,232,240)");
        groundGrad.addColorStop(0.2, "rgb(220,240,245)");
        groundGrad.addColorStop(0.5, "rgb(240,248,250)");
        groundGrad.addColorStop(1, "rgb(250,250,248)");
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, horizonY, w, h - horizonY);
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

        const twinkle = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(seconds * s.twinkleSpeed + s.twinklePhase));
        let alpha = s.baseOpacity * twinkle;
        if (alpha < 0.02) continue;

        // Light mode: use teal colors, same star rendering (no blobs)
        let sr = s.r, sg = s.g, sb = s.b;
        if (!isDark) {
          const lc = LIGHT_STAR_COLORS[i % LIGHT_STAR_COLORS.length]!;
          sr = lc[0]; sg = lc[1]; sb = lc[2];
          // Scale opacity for visibility on light bg — still crisp, not blobby
          alpha *= 0.5 + s.depth * 0.5;
        }

        // Stars positioned in sky area (0 to horizon)
        const parallax = (0.15 + s.depth * 0.85) * PARALLAX_STRENGTH * d;
        const px = s.x * w + mx * parallax;
        const py = s.y * horizonY + my * parallax * 0.4;

        // Don't render below horizon
        if (py > horizonY) continue;

        const sz = s.size * s.sizeBoost * d;

        // Subtle glow on brighter/near stars only (both modes)
        if ((s.baseOpacity > 0.4 && sz > 0.8) || s.sizeBoost > 1.1) {
          const glowAlpha = isDark
            ? alpha * 0.10 * Math.max(1, s.sizeBoost * 0.5)
            : alpha * 0.08 * Math.max(1, s.sizeBoost * 0.5);
          ctx.beginPath();
          ctx.arc(px, py, sz * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${sr},${sg},${sb},${glowAlpha})`;
          ctx.fill();
        }

        // Star dot — small and crisp
        if (sz < 1.2) {
          ctx.fillStyle = `rgba(${sr},${sg},${sb},${alpha})`;
          ctx.fillRect(px - sz * 0.5, py - sz * 0.5, sz, sz);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, sz * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${sr},${sg},${sb},${alpha})`;
          ctx.fill();
        }
      }

      // --- Shooting stars ---
      // Maybe spawn a new one
      if (Math.random() < SHOOT_CHANCE) {
        spawnShootingStar(w, h, horizon);
      }

      // Update and draw active shooting stars
      const shoots = shootingStars.current;
      for (let i = shoots.length - 1; i >= 0; i--) {
        const ss = shoots[i]!;
        ss.x += ss.vx * d;
        ss.y += ss.vy * d;
        ss.life--;

        if (ss.life <= 0 || ss.x > w + 100 || ss.y > horizonY) {
          shoots.splice(i, 1);
          continue;
        }

        const progress = 1 - ss.life / ss.maxLife; // 0 at start, 1 at end
        // Fade in quickly, fade out gradually
        const fadeIn = Math.min(1, progress * 5);
        const fadeOut = Math.min(1, ss.life / (ss.maxLife * 0.3));
        const ssAlpha = fadeIn * fadeOut;

        // Trail: line from current position back along velocity
        const tailX = ss.x - (ss.vx * d * ss.tailLen) / (Math.abs(ss.vx * d) + Math.abs(ss.vy * d)) * (ss.size + 0.5);
        const tailY = ss.y - (ss.vy * d * ss.tailLen) / (Math.abs(ss.vx * d) + Math.abs(ss.vy * d)) * (ss.size + 0.5);

        const trailGrad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        if (isDark) {
          trailGrad.addColorStop(0, "rgba(255,255,255,0)");
          trailGrad.addColorStop(0.6, `rgba(255,248,230,${0.15 * ssAlpha})`);
          trailGrad.addColorStop(1, `rgba(255,255,255,${0.7 * ssAlpha})`);
        } else {
          trailGrad.addColorStop(0, "rgba(11,122,122,0)");
          trailGrad.addColorStop(0.6, `rgba(20,149,154,${0.2 * ssAlpha})`);
          trailGrad.addColorStop(1, `rgba(20,149,154,${0.6 * ssAlpha})`);
        }

        ctx.save();
        ctx.strokeStyle = trailGrad;
        ctx.lineWidth = ss.size * d;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();

        // Bright head
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, ss.size * d * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(255,255,255,${0.9 * ssAlpha})`
          : `rgba(20,149,154,${0.8 * ssAlpha})`;
        ctx.fill();

        // Head glow
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, ss.size * d * 3, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(212,175,55,${0.12 * ssAlpha})`
          : `rgba(11,122,122,${0.15 * ssAlpha})`;
        ctx.fill();

        ctx.restore();
      }

      // --- Horizon glow ---
      const breathe = 0.93 + Math.sin(seconds * 0.4) * 0.07;

      if (isDark) {
        // Soft diffused glow centered on horizon — stronger for visibility
        const glow = ctx.createRadialGradient(
          w * 0.5, horizonY, 0,
          w * 0.5, horizonY, w * 0.5,
        );
        glow.addColorStop(0, `rgba(212,175,55,${0.14 * breathe})`);
        glow.addColorStop(0.2, `rgba(212,175,55,${0.07 * breathe})`);
        glow.addColorStop(0.5, `rgba(200,160,45,${0.025 * breathe})`);
        glow.addColorStop(1, "rgba(200,160,45,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, horizonY - h * 0.25, w, h * 0.35);

        // Horizon line — soft atmospheric glow
        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
        lineGrad.addColorStop(0, "rgba(212,175,55,0)");
        lineGrad.addColorStop(0.2, `rgba(212,175,55,${0.12 * breathe})`);
        lineGrad.addColorStop(0.5, `rgba(245,220,120,${0.25 * breathe})`);
        lineGrad.addColorStop(0.8, `rgba(212,175,55,${0.12 * breathe})`);
        lineGrad.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = lineGrad;
        ctx.fillRect(0, horizonY - 1 * d, w, 2 * d);

        const bloomH = 24 * d;
        const bloom = ctx.createLinearGradient(0, horizonY - bloomH, 0, horizonY + bloomH);
        bloom.addColorStop(0, "rgba(212,175,55,0)");
        bloom.addColorStop(0.25, `rgba(212,175,55,${0.025 * breathe})`);
        bloom.addColorStop(0.5, `rgba(235,200,80,${0.06 * breathe})`);
        bloom.addColorStop(0.75, `rgba(212,175,55,${0.025 * breathe})`);
        bloom.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, horizonY - bloomH, w, bloomH * 2);

        ctx.restore();
      } else {
        // Light mode — atmospheric teal horizon glow

        // Radial glow centered at horizon
        const glow = ctx.createRadialGradient(
          w * 0.5, horizonY, 0,
          w * 0.5, horizonY, w * 0.55,
        );
        glow.addColorStop(0, `rgba(11,122,122,${0.18 * breathe})`);
        glow.addColorStop(0.15, `rgba(11,122,122,${0.12 * breathe})`);
        glow.addColorStop(0.35, `rgba(15,135,140,${0.06 * breathe})`);
        glow.addColorStop(0.6, `rgba(6,90,110,${0.02 * breathe})`);
        glow.addColorStop(1, "rgba(6,90,110,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // Vertical bloom
        const bloomH = h * 0.12;
        const bloom = ctx.createLinearGradient(0, horizonY - bloomH, 0, horizonY + bloomH * 0.5);
        bloom.addColorStop(0, "rgba(11,122,122,0)");
        bloom.addColorStop(0.35, `rgba(15,130,135,${0.04 * breathe})`);
        bloom.addColorStop(0.6, `rgba(15,130,135,${0.08 * breathe})`);
        bloom.addColorStop(0.85, `rgba(15,130,135,${0.03 * breathe})`);
        bloom.addColorStop(1, "rgba(11,122,122,0)");
        ctx.fillStyle = bloom;
        ctx.fillRect(0, horizonY - bloomH, w, bloomH * 1.5);

        // Horizon band
        const bandH = 6 * d;
        const band = ctx.createLinearGradient(0, horizonY - bandH, 0, horizonY + bandH);
        band.addColorStop(0, "rgba(20,149,154,0)");
        band.addColorStop(0.3, `rgba(20,149,154,${0.08 * breathe})`);
        band.addColorStop(0.5, `rgba(20,149,154,${0.14 * breathe})`);
        band.addColorStop(0.7, `rgba(20,149,154,${0.08 * breathe})`);
        band.addColorStop(1, "rgba(20,149,154,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, horizonY - bandH, w, bandH * 2);
      }

      // --- Grid hover glow (below horizon, follows mouse) ---
      const gridMouseX = sm.x * w;
      const gridMouseY = sm.y * h;
      if (gridMouseY > horizonY) {
        const glowRadius = w * 0.18;
        const gAlpha = isDark ? 0.07 : 0.16;
        const gridGlow = ctx.createRadialGradient(
          gridMouseX, gridMouseY, 0,
          gridMouseX, gridMouseY, glowRadius,
        );
        gridGlow.addColorStop(0, isDark
          ? `rgba(212,175,55,${gAlpha * breathe})`
          : `rgba(11,122,122,${gAlpha * breathe})`);
        gridGlow.addColorStop(0.5, isDark
          ? `rgba(212,175,55,${gAlpha * 0.3 * breathe})`
          : `rgba(11,122,122,${gAlpha * 0.3 * breathe})`);
        gridGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gridGlow;
        ctx.fillRect(gridMouseX - glowRadius, gridMouseY - glowRadius, glowRadius * 2, glowRadius * 2);
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
                ? "linear-gradient(rgba(212,175,55,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.13) 1px, transparent 1px)"
                : "linear-gradient(rgba(11,122,122,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(11,122,122,0.15) 1px, transparent 1px)",
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
            : "linear-gradient(180deg, transparent, var(--bg-base))",
        }}
      />
    </div>
  );
}

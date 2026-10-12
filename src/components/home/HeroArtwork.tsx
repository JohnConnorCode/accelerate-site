"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { CalendarDays, FileText, ListChecks, Mail, Send, UserRound } from "lucide-react";

// Concrete work enters a shared intelligence layer and branches into actions.
// The sculpture, connections and signals all respond to the same steerable pose.
const inputs = [
  {
    icon: Mail,
    x: 94,
    y: 180,
    outputs: [0, 1],
    label: "Select customer inquiry workflow",
    result: "Example inquiry selected: prepare a reply and update a customer record.",
  },
  {
    icon: CalendarDays,
    x: 66,
    y: 310,
    outputs: [1, 2],
    label: "Select meeting workflow",
    result: "Example meeting selected: update a customer record and create a follow-up task.",
  },
  {
    icon: FileText,
    x: 108,
    y: 448,
    outputs: [0, 2],
    label: "Select invoice workflow",
    result: "Example invoice selected: prepare a reminder and create a follow-up task.",
  },
] as const;
const outputs = [
  { icon: Send, x: 490, y: 180 },
  { icon: UserRound, x: 532, y: 310 },
  { icon: ListChecks, x: 492, y: 448 },
] as const;
type Point = { x: number; y: number };
type Source = 0 | 1 | 2;
type Curve = [Point, Point, Point, Point];
type Controller = {
  select: (index: number) => void;
  steer: (x: number, y: number) => void;
  drag: (x: number, y: number) => void;
  release: () => boolean;
  nudge: (x: number, y: number) => void;
  reset: () => void;
};
const outline = [
  [-58, -46],
  [19, -46],
  [67, 0],
  [19, 46],
  [-58, 46],
  [-10, 0],
] as const;
const baseOutline = [
  [-92, -92],
  [92, -92],
  [92, 92],
  [-92, 92],
] as const;
const directions: Record<string, readonly [number, number]> = {
  ArrowLeft: [-14, 0],
  ArrowRight: [14, 0],
  ArrowUp: [0, -14],
  ArrowDown: [0, 14],
};
const clamp = (number: number, min: number, max: number) => Math.max(min, Math.min(max, number));
const point = ({ x, y }: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const polygon = (points: Point[]) => `M${points.map(point).join("L")}Z`;
const curvePath = ([a, b, c, d]: Curve) => `M${point(a)}C${point(b)} ${point(c)} ${point(d)}`;
function onCurve([a, b, c, d]: Curve, t: number): Point {
  const s = 1 - t;
  return {
    x: s ** 3 * a.x + 3 * s ** 2 * t * b.x + 3 * s * t ** 2 * c.x + t ** 3 * d.x,
    y: s ** 3 * a.y + 3 * s ** 2 * t * b.y + 3 * s * t ** 2 * c.y + t ** 3 * d.y,
  };
}
function geometry(pose: Point, phase: number, live: boolean) {
  const center = { x: 300 + pose.x, y: 372 + pose.y };
  const yaw = -0.22 + pose.x / 185;
  const pitch = pose.y / 340;
  const project = (x: number, y: number, z: number): Point => {
    const u = x * Math.cos(yaw) - y * Math.sin(yaw);
    const v = x * Math.sin(yaw) + y * Math.cos(yaw);
    const w = v * Math.cos(pitch) - z * Math.sin(pitch);
    const h = v * Math.sin(pitch) + z * Math.cos(pitch);
    return { x: center.x + (u - w) * 1.12, y: center.y + (u + w) * 0.55 - h * 0.94 };
  };
  const bloom = live ? Math.sin(clamp((phase - 0.26) / 0.55, 0, 1) * Math.PI) : 0;
  const layers = [0, 1, 2].map((layer) => {
    const z = 42 + layer * (39 + bloom * 15) + bloom * 6;
    const top = outline.map(([x, y]) => project(x, y, z));
    const bottom = outline.map(([x, y]) => project(x, y, z - 16));
    return {
      top: polygon(top),
      sides: top.map((p, i) => polygon([p, top[(i + 1) % 6]!, bottom[(i + 1) % 6]!, bottom[i]!])),
    };
  });
  const base = baseOutline.map(([x, y]) => project(x, y, 0));
  const baseLower = baseOutline.map(([x, y]) => project(x, y, -12));
  const socketIn = project(-76, 24, 8),
    socketOut = project(76, -24, 8);
  const incoming = inputs.map(({ x, y }): Curve => [
    { x, y },
    { x: x + 80, y },
    { x: socketIn.x - 60, y: socketIn.y },
    socketIn,
  ]);
  const outgoing = outputs.map(({ x, y }): Curve => [
    socketOut,
    { x: socketOut.x + 60, y: socketOut.y },
    { x: x - 80, y },
    { x, y },
  ]);
  return {
    layers,
    base: polygon(base),
    baseEdge: polygon([base[1]!, base[2]!, base[3]!, baseLower[3]!, baseLower[2]!, baseLower[1]!]),
    incoming,
    outgoing,
    pins: [0, 1, 2, 3, 4].map((pin) => project(88, 48 - pin * 19, 1)),
    center,
  };
}
const initial = geometry({ x: 0, y: 0 }, 0, false);

export function HeroArtwork() {
  const id = useId().replaceAll(":", "");
  const scene = useRef<HTMLDivElement>(null);
  const controller = useRef<Controller | null>(null);
  const suppressClick = useRef(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    const root = element.parentElement!;
    const get = <T extends Element>(selector: string) => element.querySelector<T>(selector)!;
    const faces = [...element.querySelectorAll<SVGPathElement>(".home-system-layer path")];
    const wires = [...element.querySelectorAll<SVGPathElement>(".home-system-wire")];
    const signals = [...element.querySelectorAll<SVGCircleElement>(".home-system-signal")];
    const pins = [...element.querySelectorAll<SVGCircleElement>(".home-system-pin")];
    const ports = [...element.querySelectorAll<HTMLElement>(".home-system-port")];
    const handle = get<HTMLButtonElement>(".home-system-handle");
    const base = get<SVGPathElement>(".home-system-base"),
      baseEdge = get<SVGPathElement>(".home-system-base-edge");
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = matchMedia("(pointer: coarse)").matches;
    const pose = { x: 0, y: 0 },
      target = { x: 0, y: 0 },
      anchor = { x: 0, y: 0 };
    let selected: Source = 0;
    let manual = false,
      dragging = false,
      moved = false;
    let dragStart = { x: 0, y: 0 },
      dragPose = { x: 0, y: 0 };
    let visible = true,
      reduced = media.matches,
      frame = 0,
      elapsed = 0,
      previous = 0,
      painted = 0,
      cycle = -1;

    function choose(index: number) {
      selected = clamp(Math.floor(index), 0, 2) as Source;
      root.dataset.source = String(index);
      ports.forEach((port, i) => {
        if (i < 3) port.setAttribute("aria-pressed", String(i === selected));
        else
          port.dataset.connected = String(
            inputs[selected].outputs.some((output) => output === i - 3),
          );
      });
    }
    function paint() {
      const phase = reduced ? 0 : (elapsed % 3200) / 3200;
      const shape = geometry(pose, phase, !reduced);
      shape.layers.forEach((layer, i) => {
        layer.sides.forEach((d, side) => faces[i * 7 + side]!.setAttribute("d", d));
        faces[i * 7 + 6]!.setAttribute("d", layer.top);
      });
      base.setAttribute("d", shape.base);
      baseEdge.setAttribute("d", shape.baseEdge);
      const paths = [...shape.incoming, ...shape.outgoing];
      paths.forEach((path, i) => {
        const active =
          i < 3 ? i === selected : inputs[selected].outputs.some((output) => output === i - 3);
        wires[i]!.setAttribute("d", curvePath(path));
        wires[i]!.setAttribute("stroke-opacity", active ? ".6" : ".13");
        // Signals enter, the layers separate to process, and two actions leave.
        const t = i < 3 ? phase / 0.48 : (phase - 0.52) / 0.48;
        const signal = signals[i]!,
          p = onCurve(path, clamp(t, 0, 1));
        signal.setAttribute("cx", p.x.toFixed(2));
        signal.setAttribute("cy", p.y.toFixed(2));
        signal.setAttribute("opacity", !reduced && active && t > 0 && t < 1 ? "1" : "0");
      });
      shape.pins.forEach((p, i) => {
        pins[i]!.setAttribute("cx", p.x.toFixed(2));
        pins[i]!.setAttribute("cy", p.y.toFixed(2));
        pins[i]!.setAttribute(
          "opacity",
          reduced || Math.abs(phase - (0.36 + i * 0.065)) < 0.075 ? ".85" : ".18",
        );
      });
      ports.slice(3).forEach((port, i) => {
        port.dataset.complete = String(
          inputs[selected].outputs.some((output) => output === i) && (reduced || phase > 0.9),
        );
      });
      handle.style.setProperty("--core-x", `${shape.center.x / 6}%`);
      handle.style.setProperty("--core-y", `${(shape.center.y - 72) / 6}%`);
      root.dataset.pose = `${pose.x.toFixed(2)},${pose.y.toFixed(2)}`;
      root.dataset.phase = phase.toFixed(3);
    }
    function blocked() {
      return !visible || document.hidden || document.body.dataset.mobileNavigation === "open";
    }
    function tick(now: number) {
      frame = 0;
      if (reduced || blocked()) return;
      const delta = previous ? Math.min(now - previous, 64) : 0;
      previous = now;
      elapsed += delta;
      const nextCycle = Math.floor(elapsed / 6400);
      if (!manual && cycle !== nextCycle) {
        cycle = nextCycle;
        choose(nextCycle % 3);
      }
      if (now - painted >= (coarse ? 32 : 16)) {
        const follow = 1 - Math.exp(-Math.max(now - painted, 16) / 85);
        pose.x += (target.x - pose.x) * follow;
        pose.y += (target.y - pose.y) * follow;
        paint();
        painted = now;
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      root.dataset.motion = reduced ? "reduced" : blocked() ? "suspended" : "live";
      root.dataset.routeState = reduced ? "settled" : "running";
      if (reduced) {
        pose.x = target.x;
        pose.y = target.y;
        paint();
      } else if (!blocked()) frame = requestAnimationFrame(tick);
    }
    function setTarget(x: number, y: number) {
      target.x = clamp(x, -72, 72);
      target.y = clamp(y, -55, 55);
      if (reduced) {
        pose.x = target.x;
        pose.y = target.y;
        paint();
      }
    }
    controller.current = {
      select(index) {
        manual = true;
        elapsed = 0;
        choose(index);
        paint();
      },
      steer(x, y) {
        if (!dragging) setTarget(anchor.x + x, anchor.y + y);
      },
      drag(x, y) {
        if (!dragging) {
          dragging = true;
          moved = false;
          dragStart = { x, y };
          dragPose = { ...pose };
          root.dataset.dragging = "true";
        }
        const dx = x - dragStart.x,
          dy = y - dragStart.y;
        moved ||= Math.hypot(dx, dy) > 4;
        setTarget(dragPose.x + dx, dragPose.y + dy);
      },
      release() {
        dragging = false;
        anchor.x = target.x;
        anchor.y = target.y;
        root.dataset.dragging = "false";
        return moved;
      },
      nudge(x, y) {
        anchor.x = clamp(target.x + x, -72, 72);
        anchor.y = clamp(target.y + y, -55, 55);
        setTarget(anchor.x, anchor.y);
      },
      reset() {
        anchor.x = 0;
        anchor.y = 0;
        setTarget(0, 0);
      },
    };
    choose(0);
    paint();
    sync();
    root.dataset.artworkReady = "true";
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    observer.observe(root);
    const menu = new MutationObserver(sync);
    menu.observe(document.body, { attributes: true, attributeFilter: ["data-mobile-navigation"] });
    const onMotion = () => {
      reduced = media.matches;
      sync();
    };
    media.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      menu.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", sync);
      controller.current = null;
    };
  }, []);

  function select(index: number) {
    const input = inputs[index];
    if (!input) return;
    controller.current?.select(index);
    setAnnouncement(input.result);
  }
  function coordinates(event: PointerEvent): Point {
    const bounds = scene.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.x) * 600) / bounds.width,
      y: ((event.clientY - bounds.y) * 600) / bounds.height,
    };
  }
  return (
    <div
      className="home-hero-artwork home-system-artwork"
      data-artwork-design="live-intelligence-routing"
      data-artwork-ready="false"
      data-source="0"
      data-route-state="settled"
      data-motion="fallback"
      role="group"
      aria-label="Interactive automation system. Select a workflow or steer the intelligence core."
    >
      <div
        ref={scene}
        className="home-system-scene"
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse" || event.buttons) return;
          const p = coordinates(event);
          controller.current?.steer((p.x - 300) * 0.1, (p.y - 300) * 0.075);
        }}
        onPointerLeave={() => controller.current?.steer(0, 0)}
      >
        <svg className="home-system-diagram" viewBox="0 0 600 600" fill="none" aria-hidden="true">
          <defs>
            <linearGradient
              id={`${id}-metal`}
              x1="180"
              y1="150"
              x2="420"
              y2="380"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="var(--bg)" />
              <stop offset=".45" stopColor="var(--bg)" />
              <stop offset="1" stopColor="color-mix(in srgb, var(--fg) 18%, var(--bg))" />
            </linearGradient>
            <linearGradient
              id={`${id}-edge`}
              x1="220"
              y1="250"
              x2="400"
              y2="400"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="color-mix(in srgb, var(--fg) 28%, var(--bg))" />
              <stop offset="1" stopColor="color-mix(in srgb, var(--fg) 65%, var(--bg))" />
            </linearGradient>
            <radialGradient id={`${id}-light`}>
              <stop stopColor="var(--fg)" stopOpacity=".075" />
              <stop offset="1" stopColor="var(--fg)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="300" cy="378" rx="234" ry="166" fill={`url(#${id}-light)`} />
          <g stroke="var(--fg)" strokeOpacity=".055" strokeWidth="1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((line) => (
              <g key={line}>
                <path d={`M${60 + line * 30} ${270 + line * 15}l240 120`} />
                <path d={`M${60 + line * 30} ${390 - line * 15}l240-120`} />
              </g>
            ))}
          </g>
          <g stroke="var(--fg)" strokeWidth="1.4">
            {[...initial.incoming, ...initial.outgoing].map((path, index) => (
              <path
                key={index}
                className="home-system-wire"
                d={curvePath(path)}
                strokeOpacity={index === 0 || index === 3 || index === 4 ? ".6" : ".13"}
              />
            ))}
          </g>
          <path
            className="home-system-base-edge"
            d={initial.baseEdge}
            fill={`url(#${id}-edge)`}
            stroke="var(--fg)"
            strokeOpacity=".35"
          />
          <path
            className="home-system-base"
            d={initial.base}
            fill={`url(#${id}-metal)`}
            stroke="var(--fg)"
            strokeOpacity=".3"
          />
          <g
            className="home-system-core"
            stroke="var(--fg)"
            strokeWidth="1.1"
            strokeLinejoin="round"
          >
            {initial.layers.map((layer, index) => (
              <g key={index} className="home-system-layer">
                {layer.sides.map((d, side) => (
                  <path key={side} d={d} fill={`url(#${id}-edge)`} strokeOpacity=".38" />
                ))}
                <path d={layer.top} fill={`url(#${id}-metal)`} strokeOpacity=".7" />
              </g>
            ))}
          </g>
          <g fill="var(--fg)">
            {initial.pins.map((p, index) => (
              <circle
                className="home-system-pin"
                key={index}
                cx={p.x}
                cy={p.y}
                r="2.2"
                opacity=".18"
              />
            ))}
          </g>
          <g className="home-system-packets" fill="var(--fg)">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <circle className="home-system-signal" key={index} r="3.8" opacity="0" />
            ))}
          </g>
        </svg>
        {inputs.map(({ icon: Icon, x, y, label }, index) => (
          <button
            key={label}
            type="button"
            className="home-system-port home-system-input"
            style={{ "--port-x": `${x / 6}%`, "--port-y": `${y / 6}%` } as CSSProperties}
            aria-label={label}
            aria-pressed={index === 0}
            onClick={() => select(index)}
          >
            <Icon aria-hidden="true" strokeWidth={1.4} />
            <span className="home-system-port-dot" aria-hidden="true" />
          </button>
        ))}
        {outputs.map(({ icon: Icon, x, y }, index) => (
          <span
            key={index}
            className="home-system-port home-system-output"
            style={{ "--port-x": `${x / 6}%`, "--port-y": `${y / 6}%` } as CSSProperties}
            data-connected={index !== 2}
            data-complete="false"
            aria-hidden="true"
          >
            <Icon strokeWidth={1.4} />
            <span className="home-system-port-dot" />
          </span>
        ))}
        <button
          type="button"
          className="home-system-handle"
          aria-label="Steer automation core. Drag to reshape connections, use arrow keys to move, Home to center, or Enter to change workflow."
          onPointerDown={(event) => {
            const p = coordinates(event);
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            controller.current?.drag(p.x, p.y);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const p = coordinates(event);
            controller.current?.drag(p.x, p.y);
          }}
          onPointerUp={(event) => {
            suppressClick.current = controller.current?.release() ?? false;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            suppressClick.current = true;
            controller.current?.release();
          }}
          onClick={(event) => {
            if (event.detail && suppressClick.current) return;
            select((Number(scene.current?.parentElement?.dataset.source ?? 0) + 1) % 3);
          }}
          onKeyDown={(event) => {
            const direction = directions[event.key];
            if (direction) {
              event.preventDefault();
              controller.current?.nudge(direction[0], direction[1]);
            }
            if (event.key === "Home") {
              event.preventDefault();
              controller.current?.reset();
            }
          }}
        />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

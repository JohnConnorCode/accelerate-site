"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, FileText, ListChecks, Mail, Send, UserRound } from "lucide-react";

// Work comes in on the left, the system decides in the middle, and the actions
// it took land on the right. Hollow marks are the outside world; filled signal
// marks are the system acting, matching the activity stream below the hero.
const inputs = [
  {
    icon: Mail,
    label: "Customer inquiry",
    note: "Matched to an existing customer",
    outputs: [0, 1],
    result: "Customer inquiry: message sent and record updated.",
  },
  {
    icon: CalendarDays,
    label: "Meeting held",
    note: "Notes turned into next steps",
    outputs: [1, 2],
    result: "Meeting held: record updated and follow-up task created.",
  },
  {
    icon: FileText,
    label: "Invoice overdue",
    note: "Checked against payment terms",
    outputs: [0, 2],
    result: "Invoice overdue: reminder sent and follow-up task created.",
  },
] as const;
const outputs = [
  { icon: Send, label: "Message sent" },
  { icon: UserRound, label: "Record updated" },
  { icon: ListChecks, label: "Task created" },
] as const;

type Phase = "intake" | "thinking" | "acting" | "done";
const phases: [Phase, number][] = [
  ["intake", 700],
  ["thinking", 1100],
  ["acting", 800],
  ["done", 2600],
];
// Row centers in the 600 × 340 stage; the core sits at (300, 170).
const rows = [40, 170, 300];
const wireIn = (y: number) => `M200 ${y}C230 ${y} 220 170 250 170`;
const wireOut = (y: number) => `M350 170C380 170 370 ${y} 400 ${y}`;

// Reuse the shipped SVG projection. Geometry changes only with workflow phases;
// pointer parallax stays in CSS instead of running a continuous JavaScript clock.
type Point = { x: number; y: number };
const outline = [
  [-44, -64],
  [12, -64],
  [44, 0],
  [12, 64],
  [-44, 64],
  [-12, 0],
] as const;
const baseOutline = [
  [-92, -92],
  [92, -92],
  [92, 92],
  [-92, 92],
] as const;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
const point = ({ x, y }: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const polygon = (points: Point[]) => `M${points.map(point).join("L")}Z`;
function sculptureGeometry(pose: Point, phase: number, live: boolean, formation = 0) {
  const center = { x: 300 + pose.x * 0.5, y: 372 + pose.y * 0.45 };
  const yaw = -0.28 + pose.x / 110;
  const pitch = 0.58 + pose.y / 210;
  const project = (x: number, y: number, z: number): Point & { depth: number } => {
    const u = x * Math.cos(yaw) - y * Math.sin(yaw);
    const v = x * Math.sin(yaw) + y * Math.cos(yaw);
    const depth = (u + v) / Math.SQRT2;
    const perspective = 720 / (720 - depth * Math.cos(pitch) - z * Math.sin(pitch));
    return {
      x: center.x + ((u - v) / Math.SQRT2) * 1.42 * perspective,
      y: center.y + (depth * Math.sin(pitch) - z * Math.cos(pitch)) * 1.42 * perspective,
      depth: depth * Math.cos(pitch) + z * Math.sin(pitch),
    };
  };
  const facesCamera = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0;
  const layers = [0, 1, 2].map((layer) => {
    // The processing beat travels through the arrows instead of moving one rigid stack.
    const wave = live ? Math.sin(clamp((phase - 0.18 - layer * 0.07) / 0.5, 0, 1) * Math.PI) : 0;
    const turn =
      (layer - 1) * formation +
      (live ? Math.sin(phase * Math.PI * 2 - layer * 0.7) * 0.14 : 0) +
      (layer - 1) * wave * 0.18;
    const bank = (live ? Math.sin(phase * Math.PI * 2 - layer * 0.8) * 0.12 : 0) + pose.y / 650;
    const spread = (layer - 1) * (formation * 50 + wave * 12);
    const z = 34 + layer * 48 + wave * (12 + layer * 6);
    const vertex = (x: number, y: number, height: number) => {
      const u = x * Math.cos(turn) - y * Math.sin(turn);
      const v = x * Math.sin(turn) + y * Math.cos(turn);
      return project(
        u + spread,
        v * Math.cos(bank) - height * Math.sin(bank),
        z + v * Math.sin(bank) + height * Math.cos(bank),
      );
    };
    const top = outline.map(([x, y]) => vertex(x, y, 22));
    const bottom = outline.map(([x, y]) => vertex(x, y, 0));
    const sides = top
      .map((p, i) => {
        const nextTop = top[(i + 1) % 6]!,
          lower = bottom[i]!,
          nextLower = bottom[(i + 1) % 6]!;
        const [x, y] = outline[i]!;
        const next = outline[(i + 1) % 6]!;
        const normal = Math.atan2(next[1] - y, next[0] - x) + turn + yaw;
        return {
          path: polygon([p, nextTop, nextLower, lower]),
          shade: (42 + Math.cos(normal - 0.7) * 22).toFixed(1),
          visible: facesCamera(p, nextTop, lower),
          depth: (p.depth + nextTop.depth + nextLower.depth + lower.depth) / 4,
        };
      })
      .sort((a, b) => a.depth - b.depth);
    return {
      top: polygon(top),
      sides,
      shadow: polygon(
        outline.map(([x, y]) =>
          project(
            x * Math.cos(turn) - y * Math.sin(turn) + spread + z * 0.18,
            x * Math.sin(turn) + y * Math.cos(turn) + z * 0.12,
            2,
          ),
        ),
      ),
    };
  });
  const base = baseOutline.map(([x, y]) => project(x, y, 0));
  const baseLower = baseOutline.map(([x, y]) => project(x, y, -12));
  return {
    layers,
    base: polygon(base),
    baseEdge: base
      .map((p, i) => {
        const next = (i + 1) % 4;
        return facesCamera(p, base[next]!, baseLower[i]!)
          ? polygon([p, base[next]!, baseLower[next]!, baseLower[i]!])
          : "";
      })
      .join(""),
  };
}

export function HeroArtwork() {
  const sculptureId = useId().replaceAll(":", "");
  const root = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(0);
  const [phase, setPhase] = useState<Phase>("done");
  const [motion, setMotion] = useState<"live" | "reduced" | "suspended">("suspended");
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const restart = useRef<(index: number) => void>(() => {});

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false,
      timer = 0,
      current = 0,
      step = 0;

    const blocked = () =>
      !visible || document.hidden || document.body.dataset.mobileNavigation === "open";
    function schedule() {
      window.clearTimeout(timer);
      if (media.matches || blocked()) return;
      const [name, duration] = phases[step]!;
      setPhase(name);
      timer = window.setTimeout(() => {
        step = (step + 1) % phases.length;
        if (step === 0) {
          current = (current + 1) % inputs.length;
          setSource(current);
        }
        schedule();
      }, duration);
    }
    function sync() {
      const next = media.matches ? "reduced" : blocked() ? "suspended" : "live";
      setMotion(next);
      if (next === "live") schedule();
      else {
        window.clearTimeout(timer);
        setPhase("done");
      }
    }
    restart.current = (index: number) => {
      current = index;
      step = 0;
      setSource(index);
      if (media.matches) setPhase("done");
      else schedule();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
      // The first observation always arrives, so it also marks hydration.
      setReady(true);
    });
    const menu = new MutationObserver(sync);
    observer.observe(element);
    menu.observe(document.body, { attributes: true, attributeFilter: ["data-mobile-navigation"] });
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      menu.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const active = inputs[source]!;
  const sculpture = sculptureGeometry(
    { x: (source - 1) * 8, y: 0 },
    phase === "thinking" ? 0.45 : 0,
    motion === "live" && phase === "thinking",
    source * 0.045,
  );
  const connected = (output: number) => active.outputs.some((index) => index === output);
  const caption =
    phase === "intake"
      ? `${active.label} received`
      : phase === "thinking"
        ? active.note
        : active.outputs
            .map((index, order) => {
              const label = outputs[index]!.label;
              return order === 0 ? label : label.toLowerCase();
            })
            .join(" and ");

  return (
    <div
      ref={root}
      className="home-hero-artwork home-flow"
      onPointerMove={(event) => {
        if (motion !== "live" || event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        event.currentTarget.style.setProperty("--flow-tilt-x", `${-y * 14}deg`);
        event.currentTarget.style.setProperty("--flow-tilt-y", `${x * 18}deg`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.removeProperty("--flow-tilt-x");
        event.currentTarget.style.removeProperty("--flow-tilt-y");
      }}
      data-artwork-design="labeled-flow"
      data-artwork-ready={String(ready)}
      data-motion={motion}
      data-phase={phase}
      data-source={source}
      role="group"
      aria-label="Example workflows. Select one to see what the system does with it."
    >
      <div className="home-flow-heads" aria-hidden="true">
        <span>Comes in</span>
        <span>The system</span>
        <span>Gets done</span>
      </div>
      <div className="home-flow-stage">
        <svg className="home-flow-wires" viewBox="0 0 600 340" fill="none" aria-hidden="true">
          {rows.map((y, index) => (
            <g key={`in-${y}`} className="home-flow-wire" data-active={index === source}>
              <path d={wireIn(y)} />
              <path className="home-flow-pulse" d={wireIn(y)} pathLength={1} />
            </g>
          ))}
          {rows.map((y, index) => (
            <g
              key={`out-${y}`}
              className="home-flow-wire home-flow-wire-out"
              data-active={connected(index)}
            >
              <path d={wireOut(y)} />
              <path className="home-flow-pulse" d={wireOut(y)} pathLength={1} />
            </g>
          ))}
        </svg>
        {inputs.map(({ icon: Icon, label }, index) => (
          <button
            key={label}
            type="button"
            className="home-flow-chip home-flow-input"
            style={{ top: `${(rows[index]! / 340) * 100}%` }}
            aria-pressed={index === source}
            onClick={() => {
              restart.current(index);
              setAnnouncement(inputs[index]!.result);
            }}
          >
            <span className="home-flow-mark" aria-hidden="true" />
            <Icon aria-hidden="true" strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
        <div className="home-flow-core" aria-hidden="true">
          <svg viewBox="60 110 480 430" fill="none" className="home-flow-sculpture">
            <defs>
              <linearGradient id={`${sculptureId}-metal`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="color-mix(in srgb, var(--fg) 24%, var(--bg))" />
                <stop offset=".4" stopColor="var(--bg)" />
                <stop offset="1" stopColor="color-mix(in srgb, var(--fg) 38%, var(--bg))" />
              </linearGradient>
            </defs>
            <path d={sculpture.baseEdge} fill="var(--soft)" />
            <path
              d={sculpture.base}
              fill={`url(#${sculptureId}-metal)`}
              stroke="var(--fg)"
              strokeOpacity=".3"
              strokeWidth="1.5"
            />
            <g fill="var(--fg)" fillOpacity=".1">
              {sculpture.layers.map((layer, index) => (
                <path key={index} d={layer.shadow} />
              ))}
            </g>
            {sculpture.layers.map((layer, index) => (
              <g
                key={index}
                className="home-flow-sculpture-layer"
                style={{ "--i": index } as CSSProperties}
              >
                {layer.sides
                  .filter((face) => face.visible)
                  .map((face, side) => (
                    <path
                      key={side}
                      d={face.path}
                      fill={`color-mix(in srgb, var(--fg) ${face.shade}%, var(--bg))`}
                      stroke="var(--fg)"
                      strokeOpacity=".25"
                    />
                  ))}
                <path
                  className="home-flow-sculpture-top"
                  d={layer.top}
                  fill={`url(#${sculptureId}-metal)`}
                  stroke="var(--fg)"
                  strokeOpacity=".55"
                  strokeWidth="1.5"
                />
              </g>
            ))}
          </svg>
        </div>
        {outputs.map(({ icon: Icon, label }, index) => (
          <div
            key={label}
            className="home-flow-chip home-flow-output"
            style={{ top: `${(rows[index]! / 340) * 100}%` }}
            data-connected={connected(index)}
            data-complete={phase === "done" && connected(index)}
            aria-hidden="true"
          >
            <span className="home-flow-mark" />
            <Icon strokeWidth={1.6} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="home-flow-caption" aria-hidden="true">
        <span className="home-flow-caption-key">{phase === "done" ? "Done" : "Working"}</span>
        <span key={`${source}-${phase === "done" || phase === "acting" ? "out" : phase}`}>
          {caption}
        </span>
      </p>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

"use client";

import { useId } from "react";

type Point = { x: number; y: number };
// LogoMark's exact six-point chevron, centered and scaled into a physical plane.
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

const point = ({ x, y }: Point) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const polygon = (points: Point[]) => `M${points.map(point).join("L")}Z`;

function geometry() {
  const yaw = -0.28,
    pitch = 0.58;
  const project = (x: number, y: number, z: number): Point & { depth: number } => {
    const u = x * Math.cos(yaw) - y * Math.sin(yaw);
    const v = x * Math.sin(yaw) + y * Math.cos(yaw);
    const depth = (u + v) / Math.SQRT2;
    const perspective = 720 / (720 - depth * Math.cos(pitch) - z * Math.sin(pitch));
    return {
      x: 300 + ((u - v) / Math.SQRT2) * 1.42 * perspective,
      y: 372 + (depth * Math.sin(pitch) - z * Math.cos(pitch)) * 1.42 * perspective,
      depth: depth * Math.cos(pitch) + z * Math.sin(pitch),
    };
  };
  const facesCamera = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) < 0;
  const layers = [0, 1, 2].map((layer) => {
    const z = 34 + layer * 48;
    const vertex = (x: number, y: number, height: number) => project(x, y, z + height);
    const top = outline.map(([x, y]) => vertex(x, y, 22));
    const bottom = outline.map(([x, y]) => vertex(x, y, 0));
    const sides = top
      .map((p, i) => {
        const nextTop = top[(i + 1) % 6]!,
          lower = bottom[i]!,
          nextLower = bottom[(i + 1) % 6]!;
        const [x, y] = outline[i]!;
        const next = outline[(i + 1) % 6]!;
        const normal = Math.atan2(next[1] - y, next[0] - x) + yaw;
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
      shadow: polygon(outline.map(([x, y]) => project(x + z * 0.18, y + z * 0.12, 2))),
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
const sculpture = geometry();

/** One entrance, then rest. The mark has no ambient clock or workflow controls. */
export function HeroArtwork() {
  const id = useId().replaceAll(":", "");
  return (
    <div
      className="home-hero-artwork home-sculpture"
      data-artwork-design="brand-sculpture"
      aria-hidden="true"
    >
      <svg className="home-sculpture-diagram" viewBox="0 0 600 600" fill="none">
        <defs>
          <linearGradient
            id={`${id}-metal`}
            x1="180"
            y1="150"
            x2="420"
            y2="380"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="color-mix(in srgb, var(--fg) 14%, var(--bg))" />
            <stop offset=".24" stopColor="var(--bg)" />
            <stop offset=".48" stopColor="color-mix(in srgb, var(--fg) 10%, var(--bg))" />
            <stop offset=".54" stopColor="var(--bg)" />
            <stop offset="1" stopColor="color-mix(in srgb, var(--fg) 25%, var(--bg))" />
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
          <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <path
          d={sculpture.baseEdge}
          fill={`url(#${id}-edge)`}
          stroke="var(--fg)"
          strokeOpacity=".35"
        />
        <path d={sculpture.base} fill={`url(#${id}-metal)`} stroke="var(--fg)" strokeOpacity=".3" />
        <g fill="var(--fg)" fillOpacity=".12" filter={`url(#${id}-shadow)`}>
          {sculpture.layers.map((layer, index) => (
            <path key={index} d={layer.shadow} />
          ))}
        </g>
        <g stroke="var(--fg)" strokeWidth="1.1" strokeLinejoin="round">
          {sculpture.layers.map((layer, index) => (
            <g key={index} className="home-sculpture-layer">
              {layer.sides
                .filter((face) => face.visible)
                .map((face, side) => (
                  <path
                    key={side}
                    d={face.path}
                    fill={`color-mix(in srgb, var(--fg) ${face.shade}%, var(--bg))`}
                    strokeOpacity=".38"
                  />
                ))}
              <path d={layer.top} fill={`url(#${id}-metal)`} strokeOpacity=".7" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";

type Point = [number, number, number];
type Face = Point[];
const outline: [number, number][] = [
  [0, 1],
  [0.875, 1],
  [1.375, 0],
  [0.875, -1],
  [0, -1],
  [0.5, 0],
];
const inset: [number, number][] = [
  [0.04, 0.96],
  [0.85, 0.96],
  [1.32, 0],
  [0.85, -0.96],
  [0.04, -0.96],
  [0.53, 0],
];
const front = inset.map(([x, y]) => [x, y, 0.19] as Point);
const back = inset.map(([x, y]) => [x, y, -0.19] as Point);
const edge = outline.map(([x, y]) => [x, y, 0.14] as Point);
const rear = outline.map(([x, y]) => [x, y, -0.14] as Point);
const faces: Face[] = [
  ...[
    [0, 5, 1],
    [1, 5, 2],
    [2, 5, 3],
    [3, 5, 4],
  ].flatMap((indices) => [
    indices.map((i) => front[i]!),
    indices
      .slice()
      .reverse()
      .map((i) => back[i]!),
  ]),
  ...outline.flatMap((_, i) => {
    const j = (i + 1) % outline.length;
    return [
      [front[i]!, front[j]!, edge[j]!, edge[i]!],
      [edge[i]!, edge[j]!, rear[j]!, rear[i]!],
      [back[j]!, back[i]!, rear[i]!, rear[j]!],
    ];
  }),
];
const normal = (face: Face): Point => {
  const origin = face[0]!,
    second = face[1]!,
    third = face[2]!;
  const a: Point = [second[0] - origin[0], second[1] - origin[1], second[2] - origin[2]];
  const b: Point = [third[0] - origin[0], third[1] - origin[1], third[2] - origin[2]];
  const n: Point = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const length = Math.hypot(...n);
  return n.map((v) => v / length) as Point;
};

// A small, real mesh of the existing brand mark. Flat planes, bevels and studio
// reflections give it a material; there is no pointer-following decoration.
const vertex = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 model;
uniform vec2 viewport;
varying vec3 point;
varying vec3 surface;
void main() {
  vec4 p = model * vec4(position, 1.0);
  point = p.xyz;
  surface = mat3(model) * normal;
  float camera = 6.8 - p.z;
  float aspect = viewport.x / viewport.y;
  float scale = min(2.65, aspect * 3.0);
  gl_Position = vec4(p.x * scale / aspect, p.y * scale, camera * 1.002 - 0.2002, camera);
}`;
const fragment = `
precision mediump float;
varying vec3 point;
varying vec3 surface;
uniform float dark;
void main() {
  vec3 n = normalize(surface);
  vec3 eye = normalize(vec3(0.0, 0.0, 6.8) - point);
  vec3 r = reflect(-eye, n);
  float key = max(dot(n, normalize(vec3(-1.0, 1.8, 2.0))), 0.0);
  float rim = pow(1.0 - max(dot(n, eye), 0.0), 3.0);
  // Rectangular studio softboxes reflected by the actual bevelled geometry.
  float strip = exp(-pow((r.x + 0.68) / 0.16, 2.0)) * (1.0 - smoothstep(0.6, 0.9, abs(r.y)));
  float softbox = exp(-pow((r.x - 0.3) / 0.45, 2.0)) * exp(-pow((r.y + 0.4) / 0.6, 2.0));
  float roof = exp(-pow((r.y + 0.74) / 0.25, 2.0)) * 0.3;
  float edge = pow(max(dot(n, normalize(vec3(1.0, -0.3, 2.0))), 0.0), 32.0);
  vec3 graphite = vec3(0.027, 0.032, 0.038);
  vec3 steel = vec3(0.92, 0.94, 0.96);
  vec3 color = mix(graphite, steel, clamp(key * 0.05 + strip * 0.86 + softbox * 0.42 + roof, 0.0, 1.0));
  color += rim * mix(0.04, 0.14, dark) + edge * 0.2;
  gl_FragColor = vec4(color, 1.0);
}`;

function pose(yaw: number, pitch: number, roll: number, offset: number, depth = 0) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cx = Math.cos(pitch),
    sx = Math.sin(pitch);
  const cz = Math.cos(roll),
    sz = Math.sin(roll);
  const rotate = ([x, y, z]: Point): Point => {
    const a = cy * x + sy * z,
      b = -sy * x + cy * z;
    const c = cx * y - sx * b,
      d = sx * y + cx * b;
    return [cz * a - sz * c, sz * a + cz * c, d];
  };
  const x = rotate([1, 0, 0]),
    y = rotate([0, 1, 0]),
    z = rotate([0, 0, 1]);
  const t = rotate([offset - 1.8125, 0, depth]);
  return new Float32Array([...x, 0, ...y, 0, ...z, 0, ...t, 1]);
}
const transform = (p: Point, m: Float32Array): Point => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
];
const poster = [0, 1, 2]
  .flatMap((index) => {
    const m = pose(-0.65, 0.25, -0.3, index * 1.125);
    return faces
      .map((face) => {
        const points = face.map((p) => transform(p, m));
        return {
          points,
          shade: normal(points)[2],
          depth: points.reduce((s, p) => s + p[2], 0) / points.length,
        };
      })
      .filter((face) => face.shade > 0);
  })
  .sort((a, b) => a.depth - b.depth);

export function HeroArtwork() {
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsed = useRef(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>(".home-hero");
    if (!canvas || !hero) return;
    const stage = canvas.parentElement!;
    stage.dataset.motionState = "paused";
    // Shader compilation can block on software renderers. Let the readable
    // entrance finish first; the server poster occupies the same stage meanwhile.
    let cancelled = false;
    let queued = false;
    let dispose: (() => void) | undefined;
    const render = () => {
      const gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      if (!gl) {
        stage.dataset.artworkReady = "false";
        return;
      }
      const shaders: WebGLShader[] = [];
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
      };
      const program = gl.createProgram();
      const vs = compile(gl.VERTEX_SHADER, vertex),
        fs = compile(gl.FRAGMENT_SHADER, fragment);
      if (!program || !vs || !fs) {
        shaders.forEach((shader) => gl.deleteShader(shader));
        if (program) gl.deleteProgram(program);
        stage.dataset.artworkReady = "false";
        return;
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
        stage.dataset.artworkReady = "false";
        return;
      }
      const vertices: number[] = [];
      faces.forEach((face) => {
        const n = normal(face);
        for (let i = 1; i < face.length - 1; i++)
          [face[0]!, face[i]!, face[i + 1]!].forEach((p) => vertices.push(...p, ...n));
      });
      const buffer = gl.createBuffer();
      if (!buffer) {
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
        stage.dataset.artworkReady = "false";
        return;
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      for (const [name, offset] of [
        ["position", 0],
        ["normal", 12],
      ] as const) {
        const attribute = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, offset);
      }
      gl.enable(gl.DEPTH_TEST);
      const model = gl.getUniformLocation(program, "model");
      const viewport = gl.getUniformLocation(program, "viewport");
      const theme = gl.getUniformLocation(program, "dark");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0,
        last = 0,
        painted = 0,
        active = false,
        lostContext = false;
      const draw = () => {
        if (lostContext) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(viewport, canvas.width, canvas.height);
        gl.uniform1f(theme, Number(document.documentElement.classList.contains("dark")));
        const t = reduced.matches ? 0 : elapsed.current;
        const arc = (t * Math.PI) / 9;
        for (let i = 0; i < 3; i++) {
          const depth = Math.sin(arc) ** 2 * (i - 1) * 0.5;
          gl.uniformMatrix4fv(
            model,
            false,
            pose(
              -0.65 + Math.sin(arc) * 0.45,
              0.25 + Math.sin(arc * 2) * 0.09,
              -0.3 + Math.sin(arc) * 0.12,
              i * 1.125,
              depth,
            ),
          );
          gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
        }
        stage.dataset.artworkReady = "true";
      };
      const tick = (now: number) => {
        if (!active) return;
        if (last) elapsed.current += Math.min(now - last, 100) / 1000;
        last = now;
        if (now - painted >= 1000 / 30) {
          draw();
          painted = now;
        }
        frame = requestAnimationFrame(tick);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        last = 0;
        active =
          !lostContext &&
          !paused &&
          !reduced.matches &&
          !document.hidden &&
          hero.dataset.heroActive === "true" &&
          document.body.dataset.mobileNavigation !== "open";
        stage.dataset.motionState = active ? "playing" : "paused";
        draw();
        if (active) frame = requestAnimationFrame(tick);
      };
      const resize = () => {
        const bounds = canvas.getBoundingClientRect();
        const density = Math.min(devicePixelRatio || 1, 1.5);
        canvas.width = Math.max(1, Math.round(bounds.width * density));
        canvas.height = Math.max(1, Math.round(bounds.height * density));
        sync();
      };
      const size = new ResizeObserver(resize);
      size.observe(canvas);
      const state = new MutationObserver(sync);
      state.observe(hero, { attributes: true, attributeFilter: ["data-hero-active"] });
      state.observe(document.body, {
        attributes: true,
        attributeFilter: ["data-mobile-navigation"],
      });
      state.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      const lost = (event: Event) => {
        event.preventDefault();
        lostContext = true;
        active = false;
        cancelAnimationFrame(frame);
        stage.dataset.artworkReady = "false";
        stage.dataset.motionState = "paused";
      };
      // A lost GPU keeps the server-rendered poster. It never hides the content.
      canvas.addEventListener("webglcontextlost", lost);
      reduced.addEventListener("change", sync);
      document.addEventListener("visibilitychange", sync);
      resize();
      return () => {
        active = false;
        cancelAnimationFrame(frame);
        size.disconnect();
        state.disconnect();
        reduced.removeEventListener("change", sync);
        document.removeEventListener("visibilitychange", sync);
        canvas.removeEventListener("webglcontextlost", lost);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        shaders.forEach((shader) => gl.deleteShader(shader));
      };
    };
    const prepare = () => {
      if (
        queued ||
        (hero.dataset.revealState !== "visible" &&
          document.documentElement.classList.contains("motion-ready"))
      )
        return;
      queued = true;
      entrance.disconnect();
      const animations = hero
        .getAnimations({ subtree: true })
        .filter(
          (animation) =>
            animation instanceof CSSAnimation && animation.animationName.startsWith("home-hero-"),
        );
      void Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(
        () => {
          if (!cancelled) dispose = render();
        },
      );
    };
    const entrance = new MutationObserver(prepare);
    entrance.observe(hero, { attributes: true, attributeFilter: ["class", "data-reveal-state"] });
    prepare();
    return () => {
      cancelled = true;
      stage.dataset.motionState = "paused";
      entrance.disconnect();
      dispose?.();
    };
  }, [paused]);
  return (
    <div className="home-hero-artwork" data-artwork-ready="false" data-motion-state="paused">
      <svg className="home-hero-poster" viewBox="0 0 600 650" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.5">
            <stop stopColor="#22262a" />
            <stop offset="0.28" stopColor="#9ca1a5" />
            <stop offset="0.46" stopColor="#e7e9ea" />
            <stop offset="0.53" stopColor="#555b60" />
            <stop offset="1" stopColor="#292d31" />
          </linearGradient>
        </defs>
        {poster.map(({ points, shade }, index) => (
          <path
            key={index}
            d={
              points
                .map(
                  ([x, y, z], i) =>
                    `${i ? "L" : "M"}${(300 + (x * 861.25) / (6.8 - z)).toFixed(3)} ${(325 - (y * 861.25) / (6.8 - z)).toFixed(3)}`,
                )
                .join(" ") + " Z"
            }
            fill={
              shade > 0.5
                ? `url(#${id})`
                : `rgb(${(40 + shade * 110).toFixed(2)}, ${(43 + shade * 110).toFixed(2)}, ${(47 + shade * 110).toFixed(2)})`
            }
          />
        ))}
      </svg>
      <canvas ref={canvasRef} className="home-hero-canvas" aria-hidden="true" />
      <div className="home-hero-artwork-caption">
        <span aria-hidden="true">Accelerate / 01</span>
        <button
          type="button"
          className="home-hero-artwork-pause"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Play hero animation" : "Pause hero animation"}
        >
          <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          {paused ? "Play motion" : "Pause motion"}
        </button>
      </div>
    </div>
  );
}

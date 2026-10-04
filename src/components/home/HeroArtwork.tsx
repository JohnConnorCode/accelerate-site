"use client";

import { useEffect, useId, useRef, useState } from "react";

const chapters = [
  {
    label: "Strategy",
    input: "Your everyday work",
    output: "A clear plan",
    route:
      "M100 48 C100 100 176 104 176 174 M266 198 C318 184 338 236 374 246 M466 278 C516 290 514 314 514 350",
    body: "An inquiry lost between a form and an inbox. A report rebuilt by hand every week. We find the gaps worth fixing.",
    yaw: -0.55,
    pitch: 0.2,
    roll: -0.22,
    spread: 0.3,
    depth: 0.5,
  },
  {
    label: "Build",
    input: "The tools you use",
    output: "Connected systems",
    route: "M100 48 C100 132 144 208 200 208 C290 208 294 208 380 208 C488 208 514 280 514 350",
    body: "Your inbox, CRM and team knowledge can work together. We connect them through custom workflows, AI agents and integrations.",
    yaw: -0.3,
    pitch: 0.12,
    roll: -0.12,
    spread: 0,
    depth: 0,
  },
  {
    label: "Run & improve",
    input: "Work in motion",
    output: "Reliable follow-through",
    route: "M100 48 C34 48 28 318 126 318 H438 C558 318 568 100 466 100 H346",
    body: "Follow-ups get handled. Your team learns the system. We monitor results and adjust the agreed work as your business changes.",
    yaw: -0.42,
    pitch: -0.12,
    roll: -0.2,
    spread: 0.12,
    depth: -0.35,
  },
];

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

// The three brand chevrons move from separate opportunities into a connected
// system. Pointer movement changes the viewpoint and the studio reflections.
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
uniform vec2 pointer;
void main() {
  vec3 n = normalize(surface);
  vec3 eye = normalize(vec3(0.0, 0.0, 6.8) - point);
  vec3 r = reflect(-eye, n);
  float key = max(dot(n, normalize(vec3(-1.0 + pointer.x, 1.8 + pointer.y, 2.0))), 0.0);
  float rim = pow(1.0 - max(dot(n, eye), 0.0), 3.0);
  // Rectangular studio softboxes reflected by the actual bevelled geometry.
  float strip = exp(-pow((r.x + 0.68 - pointer.x * 0.18) / 0.16, 2.0)) * (1.0 - smoothstep(0.6, 0.9, abs(r.y)));
  float softbox = exp(-pow((r.x - 0.3) / 0.45, 2.0)) * exp(-pow((r.y + 0.4) / 0.6, 2.0));
  float roof = exp(-pow((r.y + 0.74) / 0.25, 2.0)) * 0.3;
  float edge = pow(max(dot(n, normalize(vec3(1.0, -0.3, 2.0))), 0.0), 32.0);
  vec3 graphite = vec3(0.027, 0.032, 0.038);
  vec3 steel = vec3(0.92, 0.94, 0.96);
  vec3 color = mix(graphite, steel, clamp(key * 0.16 + strip * 0.86 + softbox * 0.42 + roof, 0.0, 1.0));
  color += vec3(0.15, 0.1, 0.04) * rim * 0.35;
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
const posters = chapters.map((chapter) =>
  [0, 1, 2]
    .flatMap((index) => {
      const m = pose(
        chapter.yaw + (index - 1) * chapter.spread * 0.18,
        chapter.pitch,
        chapter.roll,
        index * 1.125 + (index - 1) * chapter.spread,
        (1 - index) * chapter.depth,
      );
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
    .sort((a, b) => a.depth - b.depth),
);

export function HeroArtwork() {
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chapter, setChapter] = useState(0);
  const selected = useRef(0);
  const wake = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = canvasRef.current;
    const hero = canvas?.closest<HTMLElement>(".home-hero");
    if (!canvas || !hero) return;
    const scene = canvas.parentElement!;
    const stage = canvas.closest<HTMLElement>(".home-hero-artwork")!;
    stage.dataset.motionState = "paused";
    // Shader compilation can block on software renderers. Let the readable
    // entrance finish first; the server poster occupies the same stage meanwhile.
    let cancelled = false;
    let queued = false;
    const mountedAt = performance.now();
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
      const pointer = gl.getUniformLocation(program, "pointer");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const current = { ...chapters[selected.current]!, x: 0, y: 0 };
      let targetX = 0,
        targetY = 0,
        elapsed = Math.min((performance.now() - mountedAt) / 1000, 4.4);
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
        gl.uniform2f(pointer, current.x, current.y);
        // One short entrance settles into a still composition. Further motion
        // follows an intentional interaction, with no perpetual playback control.
        const entrance = reduced.matches ? 0 : Math.sin(Math.min(elapsed / 4.4, 1) * Math.PI) ** 2;
        for (let i = 0; i < 3; i++) {
          const separation = (i - 1) * current.spread;
          gl.uniformMatrix4fv(
            model,
            false,
            pose(
              current.yaw + current.x * 0.38 + entrance * 0.18 + separation * 0.18,
              current.pitch + current.y * 0.24,
              current.roll + current.x * 0.04,
              i * 1.125 + separation,
              (1 - i) * (current.depth + entrance * 0.3),
            ),
          );
          gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
        }
        stage.dataset.artworkReady = "true";
      };
      const tick = (now: number) => {
        if (!active) return;
        const delta = last ? Math.min(now - last, 64) : 16;
        elapsed += delta / 1000;
        last = now;
        const blend = 1 - Math.exp(-delta / 170);
        const goal = chapters[selected.current]!;
        let distance = Math.abs(targetX - current.x) + Math.abs(targetY - current.y);
        current.x += (targetX - current.x) * blend;
        current.y += (targetY - current.y) * blend;
        for (const key of ["yaw", "pitch", "roll", "spread", "depth"] as const) {
          distance += Math.abs(goal[key] - current[key]);
          current[key] += (goal[key] - current[key]) * blend;
        }
        if (now - painted >= 1000 / 30) {
          draw();
          painted = now;
        }
        if (elapsed < 4.4 || distance > 0.0005) frame = requestAnimationFrame(tick);
        else {
          active = false;
          stage.dataset.motionState = "settled";
        }
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        last = 0;
        active =
          !lostContext &&
          !reduced.matches &&
          !document.hidden &&
          hero.dataset.heroActive === "true" &&
          document.body.dataset.mobileNavigation !== "open";
        stage.dataset.motionState = active ? "playing" : "paused";
        if (reduced.matches) {
          Object.assign(current, chapters[selected.current]!, { x: 0, y: 0 });
          targetX = targetY = 0;
        }
        draw();
        if (active) frame = requestAnimationFrame(tick);
      };
      wake.current = sync;
      const point = (event: PointerEvent) => {
        if (event.pointerType === "touch" || reduced.matches) return;
        const bounds = scene.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
        targetY = Math.max(-1, Math.min(1, 1 - ((event.clientY - bounds.top) / bounds.height) * 2));
        if (!active) sync();
      };
      const release = () => {
        targetX = targetY = 0;
        if (!active) sync();
      };
      scene.addEventListener("pointermove", point);
      scene.addEventListener("pointerleave", release);
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
        scene.removeEventListener("pointermove", point);
        scene.removeEventListener("pointerleave", release);
        wake.current = () => {};
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
            animation instanceof CSSAnimation &&
            /^home-hero-(word|detail|action)-enter$/.test(animation.animationName),
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
  }, []);
  const chapterContent = chapters[chapter]!;
  return (
    <div
      className="home-hero-artwork"
      data-artwork-ready="false"
      data-motion-state="paused"
      data-chapter={chapter}
    >
      <div className="home-hero-scene" aria-hidden="true">
        <svg className="home-hero-flow" viewBox="0 0 600 400" preserveAspectRatio="none">
          <path d={chapterContent.route} />
          <path
            key={chapter}
            className="home-hero-flow-signal"
            d={chapterContent.route}
            pathLength="1"
          />
          <circle cx="100" cy="48" r="3" />
          {chapter === 2 ? <circle cx="346" cy="100" r="3" /> : <circle cx="514" cy="350" r="3" />}
        </svg>
        <span className="home-hero-signal home-hero-signal-input">{chapterContent.input}</span>
        <svg className="home-hero-poster" viewBox="0 0 600 650" aria-hidden="true">
          <defs>
            <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="600" y2="325">
              <stop stopColor="#22262a" />
              <stop offset="0.28" stopColor="#9ca1a5" />
              <stop offset="0.46" stopColor="#e7e9ea" />
              <stop offset="0.53" stopColor="#555b60" />
              <stop offset="1" stopColor="#292d31" />
            </linearGradient>
          </defs>
          {posters[chapter]!.map(({ points, shade }, index) => (
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
        <span className="home-hero-signal home-hero-signal-output">{chapterContent.output}</span>
      </div>
      <div className="home-hero-chapters" role="group" aria-label="Explore how we help">
        {chapters.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={chapter === index}
            aria-controls={`${id}-detail`}
            onClick={() => {
              selected.current = index;
              setChapter(index);
              wake.current();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-detail`}
        className="home-hero-artwork-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <p>{chapterContent.body}</p>
      </div>
    </div>
  );
}

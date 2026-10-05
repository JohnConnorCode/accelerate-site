"use client";

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

const chapters = [
  {
    label: "Strategy",
    input: "The work between the tools",
    output: "A clear direction",
    body: "Repeated data entry and reports rebuilt by hand are places to start. We trace the work and prioritize useful changes.",
    yaw: -0.48,
    pitch: 0.2,
    roll: -0.19,
    spread: 0.32,
    depth: 0.5,
  },
  {
    label: "Build",
    input: "Your tools, knowledge and people",
    output: "One connected system",
    body: "Your inbox, CRM and team knowledge can work together. We connect them through custom workflows, AI agents and integrations.",
    yaw: -0.24,
    pitch: 0.04,
    roll: 0,
    spread: 0,
    depth: 0,
  },
  {
    label: "Run & improve",
    input: "Work that keeps moving",
    output: "Follow-through, built in",
    body: "Follow-ups get handled. Your team learns the system. We monitor results and adjust the agreed work as your business changes.",
    yaw: -0.13,
    pitch: -0.11,
    roll: -0.09,
    spread: 0.1,
    depth: -0.18,
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
  float edge = pow(max(dot(n, normalize(vec3(1.0, -0.3, 2.0))), 0.0), 32.0);
  // Neutral ink and paper, with broad studio light on the crisp bevels.
  // The frontal silhouette remains the brand mark in either theme.
  float ink = 0.035 + key * 0.075 + strip * 0.24 + softbox * 0.09 + rim * 0.08 + edge * 0.12;
  float paper = 0.76 + key * 0.17 - strip * 0.35 - softbox * 0.10 + rim * 0.08;
  vec3 color = vec3(mix(ink, paper, dark));
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
// SVG fills the concave front/back planes directly, avoiding anti-alias seams
// between the triangles used by the GPU mesh.
const posterFaces = [front.slice().reverse(), back, ...faces.slice(8)];
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
      return posterFaces
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

// Routes express the work: identify separate handoffs, connect the tools,
// then keep delivery moving with a feedback path. Their angles echo the mark.
const filaments = [
  [
    "M46 78 H115 L160 145 H205",
    "M35 200 H100 L145 245 H185",
    "M118 318 H220 L264 274 H310",
    "M360 130 H438 L487 179 H554",
    "M390 280 H469 L522 333 H554",
  ],
  [
    "M46 78 H104 L180 154 H252",
    "M35 200 H116 L162 154 H252",
    "M46 318 H104 L180 242 H252",
    "M348 200 H554",
    "M348 200 H438 L496 142 H554",
  ],
  [
    "M35 158 H108 L150 200 H554",
    "M35 200 H554",
    "M35 242 H108 L150 200 H554",
    "M498 200 L538 240 V290 H192 L150 248",
  ],
];
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
        gl.uniform1f(theme, Number(document.documentElement.dataset.theme === "dark"));
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
        const blend = 1 - Math.exp(-delta / 230);
        const goal = chapters[selected.current]!;
        let distance = Math.abs(targetX - current.x) + Math.abs(targetY - current.y);
        current.x += (targetX - current.x) * blend;
        current.y += (targetY - current.y) * blend;
        for (const key of ["yaw", "pitch", "roll", "spread", "depth"] as const) {
          distance += Math.abs(goal[key] - current[key]);
          current[key] += (goal[key] - current[key]) * blend;
        }
        if (now - painted >= 1000 / 60) {
          draw();
          painted = now;
        }
        if (elapsed < 4.4 || distance > 0.0005) frame = requestAnimationFrame(tick);
        else {
          active = false;
          // Paint the exact resting pose even if the last tick missed the
          // frame budget. Subsequent visibility/resize reads stay identical.
          Object.assign(current, goal, { x: targetX, y: targetY });
          draw();
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
      state.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
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
  return (
    <div
      className="home-hero-artwork"
      data-artwork-ready="false"
      data-motion-state="paused"
      data-chapter={chapter}
    >
      <div className="home-hero-scene" aria-hidden="true">
        <svg className="home-hero-flow" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
          {filaments.map((paths, index) => (
            <g key={index} data-active={chapter === index}>
              {paths.map((d, line) => (
                <path key={line} d={d} />
              ))}
            </g>
          ))}
        </svg>
        <div className="home-hero-signal home-hero-signal-input">
          {chapters.map((item, index) => (
            <span key={item.label} data-active={chapter === index}>
              {item.input}
            </span>
          ))}
        </div>
        <svg className="home-hero-poster" viewBox="0 0 600 400" aria-hidden="true">
          {posters.map((planes, index) => (
            <g key={index} data-active={chapter === index}>
              {planes.map(({ points, shade }, plane) => (
                <path
                  key={plane}
                  d={
                    points
                      .map(
                        ([x, y, z], i) =>
                          `${i ? "L" : "M"}${(300 + (x * 530) / (6.8 - z)).toFixed(3)} ${(200 - (y * 530) / (6.8 - z)).toFixed(3)}`,
                      )
                      .join(" ") + " Z"
                  }
                  fill="var(--fg)"
                  fillOpacity={0.45 + shade * 0.55}
                />
              ))}
            </g>
          ))}
        </svg>
        <canvas ref={canvasRef} className="home-hero-canvas" aria-hidden="true" />
        <div className="home-hero-signal home-hero-signal-output">
          {chapters.map((item, index) => (
            <span key={item.label} data-active={chapter === index}>
              {item.output}
            </span>
          ))}
        </div>
      </div>
      <div
        className="home-hero-chapters"
        role="group"
        aria-label="Explore how we help"
        style={{ "--hero-chapter": chapter } as CSSProperties}
      >
        <span className="home-hero-chapter-line" aria-hidden="true" />
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
      <div id={`${id}-detail`} className="home-hero-artwork-detail">
        <div className="home-hero-detail-layers" aria-hidden="true">
          {chapters.map((item, index) => (
            <p key={item.label} data-active={chapter === index}>
              {item.body}
            </p>
          ))}
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {chapters[chapter]!.body}
        </p>
      </div>
    </div>
  );
}

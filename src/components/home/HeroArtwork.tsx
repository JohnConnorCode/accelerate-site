"use client";

import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

const chapters = [
  {
    label: "Strategy",
    output: "Priorities",
    body: "Repeated data entry and reports rebuilt by hand are places to start. We trace the work and prioritize useful changes.",
    yaw: -0.12,
    pitch: 0.06,
    roll: 0,
  },
  {
    label: "Build",
    output: "Workflows",
    body: "Your inbox, CRM and team knowledge can work together. We connect them through custom workflows, AI agents and integrations.",
    yaw: -0.12,
    pitch: 0.06,
    roll: 0,
  },
  {
    label: "Run & improve",
    output: "Delivery",
    body: "Follow-ups get handled. Your team learns the system. We monitor results and adjust the agreed work as your business changes.",
    yaw: -0.12,
    pitch: 0.06,
    roll: 0,
  },
];

type Point = [number, number, number];
const add = (a: Point, b: Point): Point => a.map((value, i) => value + b[i]!) as Point;
const subtract = (a: Point, b: Point): Point => a.map((value, i) => value - b[i]!) as Point;
const scale = (p: Point, amount: number): Point => p.map((value) => value * amount) as Point;
const unit = (p: Point): Point => scale(p, 1 / (Math.hypot(...p) || 1));
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// A single continuous material changes from separate strands to a woven system
// to a returning loop. The mesh has the same topology in every state, so the
// GPU can deform it continuously instead of replacing one sculpture with another.
// Every state shares the same inputs and destination. The work reorganizes
// between those fixed points, so the composition remains one connected system.
function center(u: number, strand: number, chapter: number): Point {
  const tau = Math.PI * 2;
  const envelope = Math.abs(Math.sin(u * Math.PI)) ** 1.5;
  const baseline = (1 - strand) * (0.82 * (1 - u) + 0.08 * u);
  const phase = u * tau + (strand * tau) / 3;
  if (chapter === 0)
    return [
      (u - 0.5) * 3.4,
      baseline + envelope * (1 - strand) * 0.17,
      envelope * (strand - 1) * 0.14,
    ];
  if (chapter === 1)
    return [
      (u - 0.5) * 3.4,
      baseline + Math.sin(phase) * envelope * 0.75,
      Math.cos(phase) * envelope * 0.72,
    ];
  return [
    (u - 0.5) * 3.4,
    baseline + (1 - strand) * envelope * 0.85 + Math.sin(u * tau) * envelope * 0.12,
    Math.sin(phase) * envelope * 0.26,
  ];
}
function ribbon(u: number, angle: number, strand: number, chapter: number): Point {
  const tangent = unit(
    subtract(center(u + 0.001, strand, chapter), center(u - 0.001, strand, chapter)),
  );
  const width = unit(cross([0, 0, 1], tangent));
  const depth = unit(cross(tangent, width));
  const across = width;
  const through = depth;
  return add(
    center(u, strand, chapter),
    add(
      scale(across, Math.cos(angle) * (0.1 + Math.sin(u * Math.PI) * 0.23)),
      scale(through, Math.sin(angle) * 0.014),
    ),
  );
}
const segments = 88;
const sides = 12;
const vertices: number[] = [];
const append = (u: number, angle: number, strand: number, cap = 0, hub = false) => {
  const samples = chapters.map((_, chapter) => {
    const position = hub ? center(u, strand, chapter) : ribbon(u, angle, strand, chapter);
    const along = subtract(
      ribbon(u + 0.0005, angle, strand, chapter),
      ribbon(u - 0.0005, angle, strand, chapter),
    );
    const around = subtract(
      ribbon(u, angle + 0.0005, strand, chapter),
      ribbon(u, angle - 0.0005, strand, chapter),
    );
    const normal = cap
      ? scale(
          unit(subtract(center(u + 0.001, strand, chapter), center(u - 0.001, strand, chapter))),
          cap,
        )
      : unit(cross(around, along));
    return [...position, ...normal];
  });
  vertices.push(...samples.flat(), u, Math.cos(angle), strand / 2);
};
const elements: number[] = [];
for (let strand = 0; strand < 3; strand++) {
  const offset = vertices.length / 21;
  for (let segment = 0; segment <= segments; segment++)
    for (let side = 0; side <= sides; side++)
      append(segment / segments, (side * Math.PI * 2) / sides, strand);
  for (let segment = 0; segment < segments; segment++)
    for (let side = 0; side < sides; side++) {
      const a = offset + segment * (sides + 1) + side;
      const b = a + sides + 1;
      elements.push(a, b, b + 1, a, b + 1, a + 1);
    }
  // Close the thin ends with their own face normals, retaining the crisp edge
  // of a folded sheet while the long surfaces remain smoothly shaded.
  for (const u of [0, 1]) {
    const start = vertices.length / 21;
    const direction = u === 0 ? -1 : 1;
    append(u, 0, strand, direction, true);
    for (let side = 0; side <= sides; side++)
      append(u, (side * Math.PI * 2) / sides, strand, direction);
    for (let side = 0; side < sides; side++)
      elements.push(start, start + side + 1, start + side + 2);
  }
}
const mesh = new Float32Array(vertices);
const indices = new Uint16Array(elements);

const vertex = `
attribute vec3 position0;
attribute vec3 normal0;
attribute vec3 position1;
attribute vec3 normal1;
attribute vec3 position2;
attribute vec3 normal2;
attribute vec3 registration;
uniform mat4 model;
uniform vec3 weights;
uniform vec2 viewport;
uniform mediump vec2 pointer;
uniform float entrance;
varying vec3 point;
varying vec3 surface;
varying mediump vec3 print;
void main() {
  vec3 local = position0 * weights.x + position1 * weights.y + position2 * weights.z;
  vec3 n = normal0 * weights.x + normal1 * weights.y + normal2 * weights.z;
  float pull = exp(-pow((local.x - pointer.x * 2.0) / 1.5, 2.0));
  local.z += sin(registration.x * 3.14159) * sin(registration.x * 3.14159) * (pointer.y * pull * 0.2 + entrance * sin(local.x * 1.8) * 0.14);
  vec4 p = model * vec4(local, 1.0);
  point = p.xyz;
  surface = mat3(model) * n;
  print = registration;
  float camera = 6.0 - p.z;
  float aspect = viewport.x / viewport.y;
  float zoom = min(3.25, aspect * 2.05);
  gl_Position = vec4(p.x * zoom / aspect, p.y * zoom, camera * 1.002 - 0.2002, camera);
}`;
const fragment = `
precision mediump float;
varying vec3 point;
varying vec3 surface;
varying mediump vec3 print;
uniform float dark;
uniform mediump vec2 pointer;
void main() {
  vec3 n = normalize(surface);
  float key = max(dot(n, normalize(vec3(-1.0 + pointer.x * 0.4, 1.8 + pointer.y, 2.0))), 0.0);
  // A graphic ink surface replaces reflective metal. Fine inlaid lines follow
  // the material through every transformation, rather than floating over it.
  float ink = 0.045 + (1.0 - print.z) * 0.10 + key * 0.07;
  float paper = 0.94 - (1.0 - print.z) * 0.10 - (1.0 - key) * 0.06;
  float grain = abs(fract(print.x * 60.0 + print.y * 3.0) - 0.5);
  float hatch = 1.0 - smoothstep(0.055, 0.15, grain);
  float edge = 1.0 - smoothstep(0.010, 0.026, abs(abs(print.y) - 0.86));
  float engraving = hatch * 0.19 + edge * 0.24;
  float color = mix(ink, paper, dark);
  color = mix(color, mix(0.97, 0.04, dark), engraving);
  gl_FragColor = vec4(vec3(color), 1.0);
}`;

function pose(yaw: number, pitch: number, roll: number) {
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
  return new Float32Array([
    ...rotate([1, 0, 0]),
    0,
    ...rotate([0, 1, 0]),
    0,
    ...rotate([0, 0, 1]),
    0,
    0,
    0,
    0,
    1,
  ]);
}
const transform = (p: Point, m: Float32Array): Point => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2],
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2],
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2],
];
const project = ([x, y, z]: Point) =>
  `${(300 + (x * 650) / (6 - z)).toFixed(2)} ${(200 - (y * 650) / (6 - z)).toFixed(2)}`;
const posters = chapters.map((chapter, index) => {
  const matrix = pose(chapter.yaw, chapter.pitch, chapter.roll);
  return [0, 1, 2].map((strand) => {
    const edges = [0, Math.PI].map((angle) =>
      Array.from({ length: 89 }, (_, sample) =>
        transform(ribbon(sample / 88, angle, strand, index), matrix),
      ),
    );
    const outline = [...edges[0]!, ...edges[1]!.reverse()];
    return `M${outline.map(project).join(" L")} Z`;
  });
});
const filaments = chapters.map((chapter, index) => {
  const matrix = pose(chapter.yaw, chapter.pitch, chapter.roll);
  return Array.from({ length: 21 }, (_, line) => {
    const points = Array.from({ length: 65 }, (_, sample) => {
      const p = center(sample / 64, line % 3, index);
      p[1] += (Math.floor(line / 3) - 3) * 0.14 * Math.sin((sample / 64) * Math.PI);
      p[2] -= 0.3 * Math.sin((sample / 64) * Math.PI);
      return transform(p, matrix);
    });
    return `M${points.map(project).join(" L")}`;
  });
});

export function HeroArtwork() {
  const id = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portsRef = useRef<HTMLDivElement>(null);
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
    const ports = [...(portsRef.current?.querySelectorAll<HTMLElement>(".home-hero-port") ?? [])];
    const positionPorts = (matrix: Float32Array) => {
      const bounds = scene.getBoundingClientRect();
      const aspect = bounds.width / bounds.height;
      const zoom = Math.min(3.25, aspect * 2.05);
      const anchors = [0, 1, 2].map((strand) => center(0, strand, 0));
      anchors.push([1.7, 0, 0]);
      ports.forEach((port, index) => {
        const [x, y, z] = transform(anchors[index]!, matrix);
        port.style.left = `${(0.5 + (x * zoom) / (aspect * (6 - z)) / 2) * 100}%`;
        port.style.top = `${(0.5 - (y * zoom) / (6 - z) / 2) * 100}%`;
      });
    };
    positionPorts(pose(chapters[0]!.yaw, chapters[0]!.pitch, chapters[0]!.roll));
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
      const buffer = gl.createBuffer();
      const indexBuffer = gl.createBuffer();
      if (!buffer || !indexBuffer) {
        if (buffer) gl.deleteBuffer(buffer);
        if (indexBuffer) gl.deleteBuffer(indexBuffer);
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
        stage.dataset.artworkReady = "false";
        return;
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      for (let chapter = 0; chapter < 3; chapter++) {
        for (const [name, offset] of [
          [`position${chapter}`, chapter * 24],
          [`normal${chapter}`, chapter * 24 + 12],
        ] as const) {
          const attribute = gl.getAttribLocation(program, name);
          gl.enableVertexAttribArray(attribute);
          gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 84, offset);
        }
      }
      const registration = gl.getAttribLocation(program, "registration");
      gl.enableVertexAttribArray(registration);
      gl.vertexAttribPointer(registration, 3, gl.FLOAT, false, 84, 72);
      gl.enable(gl.DEPTH_TEST);
      const model = gl.getUniformLocation(program, "model");
      const viewport = gl.getUniformLocation(program, "viewport");
      const theme = gl.getUniformLocation(program, "dark");
      const pointer = gl.getUniformLocation(program, "pointer");
      const weights = gl.getUniformLocation(program, "weights");
      const intro = gl.getUniformLocation(program, "entrance");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      const current = { ...chapters[selected.current]!, x: 0, y: 0 };
      const mix = [0, 1, 2].map((index) => Number(index === selected.current));
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
        gl.uniform1f(intro, entrance);
        gl.uniform3f(weights, mix[0]!, mix[1]!, mix[2]!);
        const matrix = pose(
          current.yaw + current.x * 0.12,
          current.pitch + current.y * 0.1,
          current.roll + current.x * 0.02,
        );
        gl.uniformMatrix4fv(model, false, matrix);
        positionPorts(matrix);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
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
        for (const key of ["yaw", "pitch", "roll"] as const) {
          distance += Math.abs(goal[key] - current[key]);
          current[key] += (goal[key] - current[key]) * blend;
        }
        const shapeBlend = 1 - Math.exp(-delta / 280);
        mix.forEach((value, index) => {
          const target = Number(index === selected.current);
          distance += Math.abs(target - value);
          mix[index] = value + (target - value) * shapeBlend;
        });
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
          mix.forEach((_, index) => {
            mix[index] = Number(index === selected.current);
          });
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
          mix.forEach((_, index) => {
            mix[index] = Number(index === selected.current);
          });
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
        gl.deleteBuffer(indexBuffer);
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
        <svg className="home-hero-poster" viewBox="0 0 600 400" aria-hidden="true">
          <defs>
            <pattern
              id={`${id}-hatch`}
              patternUnits="userSpaceOnUse"
              width="6"
              height="6"
              patternTransform="rotate(15)"
            >
              <path d="M0 0V6" stroke="var(--bg)" strokeOpacity="0.22" strokeWidth="1" />
            </pattern>
          </defs>
          {posters.map((paths, index) => (
            <g key={index} data-active={chapter === index}>
              {paths.flatMap((d, strand) => [
                <path
                  key={`${strand}-ink`}
                  d={d}
                  fill="var(--fg)"
                  fillOpacity={0.72 + strand * 0.14}
                />,
                <path key={`${strand}-hatch`} d={d} fill={`url(#${id}-hatch)`} />,
              ])}
            </g>
          ))}
        </svg>
        <canvas ref={canvasRef} className="home-hero-canvas" aria-hidden="true" />
        <div ref={portsRef} className="home-hero-ports">
          {["Tools", "Knowledge", "People"].map((label, index) => (
            <div
              key={label}
              className="home-hero-port"
              style={{ left: "21%", top: `${30 + index * 20}%` }}
            >
              {label}
            </div>
          ))}
          <div className="home-hero-port home-hero-port-output" style={{ left: "79%", top: "50%" }}>
            <div className="home-hero-signal">
              {chapters.map((item, index) => (
                <span key={item.label} data-active={chapter === index}>
                  {item.output}
                </span>
              ))}
            </div>
          </div>
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

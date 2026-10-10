"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Point = [number, number, number];

// Art direction: Dominik Fojcik's Kinetic Images / Tower (Codrops, July 2025).
// Adapt its stacked cylindrical image bands, counter-running narrow ribbons and
// fixed low-perspective camera to Accelerate's own type and chevrons. No source
// photographs, models, textures or implementation code are imported.
// https://tympanus.net/codrops/2025/07/09/how-to-create-kinetic-image-animations-with-react-three-fiber/
const vertex = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 model;
uniform vec2 viewport;
uniform float phase;
varying vec3 surface;
varying vec3 point;
varying vec2 printUV;
void main() {
  vec4 p = model * vec4(position, 1.0);
  point = p.xyz;
  surface = mat3(model) * normal;
  printUV = vec2(uv.x + phase, uv.y);
  float camera = 9.0 - p.z;
  float aspect = viewport.x / viewport.y;
  float scale = min(3.45, aspect * 4.5);
  gl_Position = vec4(p.x * scale / aspect, p.y * scale, camera * 1.002 - 0.2002, camera);
}`;
const fragment = `
precision highp float;
uniform sampler2D print;
uniform float dark;
uniform float ribbon;
varying vec3 surface;
varying vec3 point;
varying vec2 printUV;
void main() {
  vec3 n = normalize(surface);
  vec3 eye = normalize(vec3(0.0, 0.0, 9.0) - point);
  float facing = dot(n, eye);
  float light = 0.76 + 0.24 * max(dot(n, normalize(vec3(-0.5, 1.5, 3.0))), 0.0);
  float paper = texture2D(print, printUV).r;
  paper = mix(paper, 1.0 - paper, ribbon);
  // The reverse is unprinted ink. The broad frontal paper stays warm white;
  // side falloff and a narrow cut edge give the printed bands real depth.
  if (facing < 0.0) paper = 0.045;
  float edge = smoothstep(0.0, 0.018, min(printUV.y, 1.0 - printUV.y));
  paper *= mix(0.48, 1.0, edge);
  float color = mix(0.035, light, paper);
  color = mix(color, 1.0 - color, dark);
  gl_FragColor = vec4(vec3(color), 1.0);
}`;

function pose(yaw: number, pitch: number, roll: number, height: number) {
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
    ...rotate([0, height, 0]),
    1,
  ]);
}

// One continuous surface per band. All motion changes its print coordinates;
// there are no per-frame geometry allocations or pointer-dependent poses.
const vertices: number[] = [];
for (let i = 0; i < 128; i++) {
  const segment = (column: number, top: boolean) => {
    const angle = (column / 128) * Math.PI * 2;
    return [
      Math.sin(angle),
      top ? 0.5 : -0.5,
      Math.cos(angle),
      Math.sin(angle),
      0,
      Math.cos(angle),
      column / 128,
      top ? 0 : 1,
    ];
  };
  [
    segment(i, false),
    segment(i + 1, false),
    segment(i + 1, true),
    segment(i, false),
    segment(i + 1, true),
    segment(i, true),
  ].forEach((point) => vertices.push(...point));
}

function createPrint(hero: HTMLElement, ribbon: boolean) {
  const sheet = document.createElement("canvas");
  sheet.width = 2048;
  sheet.height = ribbon ? 128 : 512;
  const ink = sheet.getContext("2d");
  if (!ink) return null;
  ink.fillStyle = "#fff";
  ink.fillRect(0, 0, sheet.width, sheet.height);
  ink.fillStyle = "#080808";
  const family = getComputedStyle(hero).getPropertyValue("--display").trim() || "sans-serif";
  if (ribbon) {
    ink.font = `500 72px ${family}`;
    ink.textBaseline = "middle";
    for (let copy = 0; copy < 2; copy++)
      ink.fillText("STRATEGY  /  SYSTEMS  /  EXECUTION  /", copy * 1024 + 24, 68, 976);
    return sheet;
  }
  ink.font = `600 260px ${family}`;
  ink.textBaseline = "middle";
  for (let arrow = 0; arrow < 3; arrow++) {
    ink.save();
    ink.translate(40 + arrow * 76, 172);
    ink.scale(1.6, 1.6);
    ink.beginPath();
    [
      [0, 0],
      [27, 0],
      [51, 52],
      [27, 104],
      [0, 104],
      [24, 52],
    ].forEach(([x, y], i) => (i ? ink.lineTo(x!, y!) : ink.moveTo(x!, y!)));
    ink.closePath();
    ink.fill();
    ink.restore();
  }
  ink.fillText("ACCELERATE", 360, 270, 1640);
  return sheet;
}

export function HeroArtwork() {
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
        ["uv", 24],
      ] as const) {
        const attribute = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute, name === "uv" ? 2 : 3, gl.FLOAT, false, 32, offset);
      }
      const textures: WebGLTexture[] = [];
      for (const narrow of [false, true]) {
        const sheet = createPrint(hero, narrow);
        const texture = gl.createTexture();
        if (texture) textures.push(texture);
        if (!sheet || !texture) {
          textures.forEach((item) => gl.deleteTexture(item));
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          shaders.forEach((shader) => gl.deleteShader(shader));
          stage.dataset.artworkReady = "false";
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      gl.enable(gl.DEPTH_TEST);
      const model = gl.getUniformLocation(program, "model");
      const viewport = gl.getUniformLocation(program, "viewport");
      const theme = gl.getUniformLocation(program, "dark");
      const phase = gl.getUniformLocation(program, "phase");
      const ribbon = gl.getUniformLocation(program, "ribbon");
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
        gl.uniform1f(theme, Number(document.documentElement.dataset.theme === "dark"));
        const t = reduced.matches ? 0 : elapsed.current;
        for (let i = 0; i < 5; i++) {
          const narrow = i % 2 === 1;
          const height = (2 - i) * 0.66;
          const matrix = pose(-0.22, -0.18, -0.2 + (narrow ? 0.075 : 0), height);
          // Broad image cylinders and slim counter-running banners follow the
          // reference's two interleaved rhythms. Their silhouettes stay composed.
          const radius = narrow ? 2.035 : 2.0;
          const breadth = narrow ? 0.145 : 1.015;
          for (let axis = 0; axis < 3; axis++) {
            matrix[axis]! *= radius;
            matrix[4 + axis]! *= breadth;
            matrix[8 + axis]! *= radius;
          }
          gl.uniformMatrix4fv(model, false, matrix);
          gl.uniform1f(phase, i * 0.19 + t * (narrow ? -0.027 : 0.018));
          gl.uniform1f(ribbon, Number(narrow));
          gl.bindTexture(gl.TEXTURE_2D, textures[Number(narrow)]!);
          gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 8);
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
        textures.forEach((texture) => gl.deleteTexture(texture));
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
    <div
      className="home-hero-artwork"
      data-artwork-design="kinetic-bands"
      data-artwork-ready="false"
      data-motion-state="paused"
    >
      <Image
        className="home-hero-poster"
        src="/images/home/hero-kinetic-poster.png"
        alt=""
        fill
        loading="eager"
        unoptimized
      />
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

"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, FileText, ListChecks, Mail, Send, UserRound } from "lucide-react";

// Reuse the site's monochrome materials and dimensional chevron mark. The
// diagram demonstrates work crossing a shared intelligence layer, rather than
// a rotating identity. Nothing runs until a visitor chooses an input.
const inputs = [
  {
    icon: Mail,
    x: 94,
    y: 180,
    path: "M94 180H155Q175 180 175 200V252Q175 272 193 282L274 326",
    outputs: [0, 1],
    label: "Route a customer inquiry to a reply and customer record",
    result: "Example inquiry routed: reply prepared and customer record updated.",
  },
  {
    icon: CalendarDays,
    x: 66,
    y: 310,
    path: "M66 310H158Q177 310 196 320L274 360",
    outputs: [1, 2],
    label: "Route a meeting to a customer record and follow-up task",
    result: "Example meeting routed: customer record updated and follow-up task created.",
  },
  {
    icon: FileText,
    x: 108,
    y: 448,
    path: "M108 448H155Q175 448 175 428V408Q175 390 192 381L274 340",
    outputs: [0, 2],
    label: "Route an invoice to a reminder and follow-up task",
    result: "Example invoice routed: reminder prepared and follow-up task created.",
  },
] as const;
const outputs = [
  { icon: Send, x: 490, y: 180, path: "M328 326L408 282Q427 272 427 252V200Q427 180 447 180H490" },
  { icon: UserRound, x: 532, y: 310, path: "M328 360L408 320Q427 310 447 310H532" },
  {
    icon: ListChecks,
    x: 492,
    y: 448,
    path: "M328 340L408 381Q427 390 427 408V428Q427 448 447 448H492",
  },
] as const;

export function HeroArtwork() {
  const id = useId().replaceAll(":", "");
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = running ? selected : (preview ?? selected);
  const route = current === null ? undefined : inputs[current];
  const selectedInput = selected === null ? undefined : inputs[selected];
  const completed = selected !== null && current === selected && !running;

  useEffect(() => () => clearTimeout(timer.current), []);

  function activate(index: number) {
    clearTimeout(timer.current);
    setSelected(index);
    setPreview(null);
    setRun((value) => value + 1);
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRunning(animate);
    if (animate) timer.current = setTimeout(() => setRunning(false), 1500);
  }

  return (
    <div
      className="home-hero-artwork home-system-artwork"
      data-artwork-design="intelligence-routing"
      data-artwork-ready="true"
      data-source={selected === null ? "none" : selected}
      data-route-state={running ? "running" : completed ? "complete" : "idle"}
      role="group"
      aria-label="Interactive automation example. Choose an inquiry, meeting, or invoice to see its workflow."
    >
      <div className="home-system-scene">
        <svg className="home-system-diagram" viewBox="0 0 600 600" fill="none" aria-hidden="true">
          <defs>
            <linearGradient
              id={`${id}-metal`}
              x1="200"
              y1="230"
              x2="390"
              y2="430"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="var(--bg)" />
              <stop offset="1" stopColor="var(--fg)" stopOpacity=".15" />
            </linearGradient>
            <linearGradient
              id={`${id}-edge`}
              x1="180"
              y1="370"
              x2="400"
              y2="410"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="var(--fg)" stopOpacity=".07" />
              <stop offset="1" stopColor="var(--fg)" stopOpacity=".3" />
            </linearGradient>
            <radialGradient id={`${id}-light`}>
              <stop stopColor="var(--fg)" stopOpacity=".05" />
              <stop offset="1" stopColor="var(--fg)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="300" cy="378" rx="224" ry="184" fill={`url(#${id}-light)`} />
          <g stroke="var(--fg)" strokeOpacity=".055" strokeWidth="1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((line) => (
              <g key={line}>
                <path d={`M${60 + line * 30} ${270 + line * 15}l240 120`} />
                <path d={`M${60 + line * 30} ${390 - line * 15}l240-120`} />
              </g>
            ))}
          </g>
          <g className="home-system-wires" stroke="var(--fg)" strokeWidth="1.3" strokeOpacity=".17">
            {inputs.map((input) => (
              <path key={input.path} d={input.path} />
            ))}
            {outputs.map((output) => (
              <path key={output.path} d={output.path} />
            ))}
          </g>
          {route && (
            <g
              key={`${current}-${run}`}
              stroke="var(--fg)"
              strokeWidth="2"
              className="home-system-route"
            >
              <path
                d={route.path}
                pathLength="1"
                className={running ? "home-system-trace" : undefined}
              />
              {route.outputs.map((output) => (
                <path
                  key={output}
                  d={outputs[output].path}
                  pathLength="1"
                  className={running ? "home-system-trace home-system-trace-out" : undefined}
                />
              ))}
            </g>
          )}
          <path
            d="m171 371 129-65 129 65-129 65Z"
            fill={`url(#${id}-metal)`}
            stroke="var(--fg)"
            strokeOpacity=".22"
          />
          <path
            d="M171 371v17l129 65 129-65v-17l-129 65Z"
            fill={`url(#${id}-edge)`}
            stroke="var(--fg)"
            strokeOpacity=".12"
          />
          <path d="m187 371 113-56 113 56-113 56Z" stroke="var(--fg)" strokeOpacity=".14" />
          <g className="home-system-core" data-energized={current !== null}>
            {[0, 1, 2].map((layer) => (
              <g
                key={layer}
                className="home-system-layer"
                style={{ "--layer": layer } as CSSProperties}
              >
                <path
                  d="M215 339v17l88 44 36-18v-17l-36 18Z"
                  fill={`url(#${id}-edge)`}
                  stroke="var(--fg)"
                  strokeOpacity=".5"
                />
                <path
                  d="M277 292v17l26 13 16-8v-17l-42 21Z"
                  fill={`url(#${id}-edge)`}
                  stroke="var(--fg)"
                  strokeOpacity=".35"
                />
                <path
                  d="m215 339 88 44 36-18-62-31 42-21-42-21Z"
                  fill={`url(#${id}-metal)`}
                  stroke="var(--fg)"
                  strokeWidth="1.2"
                  strokeOpacity=".75"
                />
                <path
                  d="m223 335 80 40 28-14M283 301l27 13"
                  stroke="var(--fg)"
                  strokeOpacity=".1"
                />
              </g>
            ))}
          </g>
          <g fill="var(--fg)">
            {[0, 1, 2, 3, 4].map((pin) => (
              <path
                key={pin}
                d={`m${272 + pin * 12} ${420 + pin * 6} 4 2 4-2-4-2Z`}
                opacity={current === null ? 0.14 : 0.75}
              />
            ))}
          </g>
          {running && selectedInput && (
            <g key={run} className="home-system-packets" fill="var(--fg)">
              <circle r="4">
                <animateMotion
                  path={selectedInput.path}
                  begin="indefinite"
                  ref={(node) => (node as SVGAnimationElement | null)?.beginElement()}
                  dur=".7s"
                  repeatCount="1"
                  fill="freeze"
                />
              </circle>
              {selectedInput.outputs.map((output) => (
                <circle key={output} r="4" opacity="0">
                  <animate
                    attributeName="opacity"
                    begin="indefinite"
                    ref={(node) => (node as SVGAnimationElement | null)?.beginElement()}
                    values="0;1;1;0"
                    keyTimes="0;.47;.95;1"
                    dur="1.5s"
                    repeatCount="1"
                  />
                  <animateMotion
                    path={outputs[output].path}
                    begin="indefinite"
                    ref={(node) => (node as SVGAnimationElement | null)?.beginElementAt(0.7)}
                    dur=".75s"
                    repeatCount="1"
                    fill="freeze"
                  />
                </circle>
              ))}
            </g>
          )}
        </svg>
        {inputs.map(({ icon: Icon, x, y, label }, index) => (
          <button
            key={label}
            type="button"
            className="home-system-port home-system-input"
            style={{ left: `${x / 6}%`, top: `${y / 6}%` } as CSSProperties}
            aria-label={label}
            aria-pressed={selected === index}
            onClick={() => activate(index)}
            onMouseEnter={() => setPreview(index)}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview(index)}
            onBlur={() => setPreview(null)}
          >
            <Icon aria-hidden="true" strokeWidth={1.4} />
            <span className="home-system-port-dot" aria-hidden="true" />
          </button>
        ))}
        {outputs.map(({ icon: Icon, x, y }, index) => (
          <span
            key={index}
            className="home-system-port home-system-output"
            style={{ left: `${x / 6}%`, top: `${y / 6}%` } as CSSProperties}
            data-connected={route?.outputs.some((output) => output === index) ?? false}
            data-complete={completed && selectedInput?.outputs.some((output) => output === index)}
            aria-hidden="true"
          >
            <Icon strokeWidth={1.4} />
            <span className="home-system-port-dot" />
          </span>
        ))}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {completed
          ? selectedInput?.result
          : running
            ? "Routing example through the intelligence layer."
            : "Choose an input to run an example automation."}
      </span>
    </div>
  );
}

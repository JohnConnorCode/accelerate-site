"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Reveal } from "./reveal";

const ROWS = [
  {
    title: "Sales and pipeline",
    detail:
      "Inquiries waiting overnight, quotes that take days, follow-up that depends on someone remembering.",
    href: "/services#sales",
  },
  {
    title: "Marketing",
    detail:
      "Publishing that happens when someone finds a free afternoon. The pipeline runs hot and cold for the same reason.",
    href: "/services#content",
  },
  {
    title: "Customer service",
    detail:
      "The same routine questions answered by hand, ahead of the cases that need a person.",
    href: "/services#engagement",
  },
  {
    title: "Operations",
    detail:
      "Scheduling, dispatch, and coordination absorbing the first half of every manager's day.",
    href: "/services#automation",
  },
];

export function WherePays() {
  const [active, setActive] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Idle attention-cycle: once the section is in view and no one is
  // hovering, step through the rows on their own so the interactivity
  // (and the fact that each row links somewhere) is discoverable without
  // requiring a hover first.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(!!entries[0]?.isIntersecting),
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced || hovering || !inView) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev === null ? 0 : (prev + 1) % ROWS.length));
    }, 3200);
    return () => clearInterval(interval);
  }, [hovering, inView]);

  return (
    <section className="sect" id="where" ref={sectionRef}>
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Where it pays
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The constraints that
              <br />
              show up in nearly
              <br />
              every business we open.
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Most companies recognize themselves immediately.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="rows">
          {ROWS.map((row, i) => (
            <Link
              key={row.title}
              href={row.href}
              className={`row${active === i ? " on" : ""}`}
              onMouseEnter={() => {
                setHovering(true);
                setActive(i);
              }}
              onMouseLeave={() => {
                setHovering(false);
                setActive(null);
              }}
            >
              <h3 className="h3 row-t">
                {row.title}
                <span className="row-arrow">→</span>
              </h3>
              <p>{row.detail}</p>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

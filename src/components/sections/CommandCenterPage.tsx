"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { BookCallButton } from "@/components/v2/studio/primitives";
import { Reveal, useRv } from "@/components/home/reveal";
import { AmbientField } from "@/components/home/AmbientField";
import { ApprovalQueue } from "@/components/command-center/ApprovalQueue";
import { CapabilityCatalog } from "@/components/command-center/CapabilityCatalog";
import { CommandCenterDemo } from "@/components/command-center/demo/CommandCenterDemo";
import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { commandCenterFaqs } from "@/content/command-center-faq";
import {
  LOOP_STEPS,
  TRUST_LADDER,
  MARQUEE_ITEMS,
  WHO_ITS_FOR,
} from "@/content/command-center";
import type { MouseEvent } from "react";

/* /command-center, built on the homepage editorial system (.sect / .wrap /
   .ink-panel / .steps / .appr / .efaq / .deck) rather than the inner-page
   primitives, because this page needs the ink-panel alternation to have any
   structure at all. The v2 `bg-section-warm|deep` tokens are aliased to the
   page background, so section-level contrast can only come from .ink-panel. */

export function CommandCenterPageContent() {
  return (
    <>
      <Hero />
      <Marquee />
      <Problem />
      <Built />
      <Demo />
      <HowItWorks />
      <TrustLadder />
      <Catalog />
      <Proof />
      <WhoItsFor />
      <Faq />
      <Closing />
      <CommandCenterNav />
    </>
  );
}

/* ── hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  const [loaded, setLoaded] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // One scroll listener drives both layers: content lifts and fades, the
  // instrument grid behind it drifts the other way. Same technique as the
  // homepage hero.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // Removed fade out completely per user request so demo stays visible
  const lift = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const gridDrift = useTransform(scrollYProgress, [0, 1], [0, 120]);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 40);
    const onPageShow = () => setLoaded(true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <section ref={sectionRef} className={`hero cc-hero${loaded ? " loaded" : ""}`} id="top">
      <motion.div className="hero-field" aria-hidden="true" style={reduced ? undefined : { y: gridDrift }}>
        <div className="hero-grid-base" />
        <div className="hero-grid-lit" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </motion.div>

      <motion.div className="wrap" style={reduced ? undefined : { y: lift }}>
        <div className="grid items-center gap-y-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-x-14">
          <div className="min-w-0">
            <p className={`label eyebrow-anim rv${loaded ? " in" : ""}`}>The Command Center</p>
            <h1 className="h1">
              <span className="h1-word-row">
                {["Your", "operation,"].map((w, i) => (
                  <span key={w} className="word">
                    <span style={{ "--d": `${0.06 + i * 0.1}s` } as CSSProperties}>{w}</span>
                  </span>
                ))}
              </span>
              <span className="h1-word-row">
                {["running", "itself."].map((w, i) => (
                  <span key={w} className="word">
                    <span style={{ "--d": `${0.26 + i * 0.1}s` } as CSSProperties}>{w}</span>
                  </span>
                ))}
              </span>
              <span className="h1-word-row">
                {["Just", "approve."].map((w, i) => (
                  <span key={w} className="word">
                    <span className="it" style={{ "--d": `${0.46 + i * 0.08}s` } as CSSProperties}>{w}</span>
                  </span>
                ))}
              </span>
            </h1>
            <div className={`rv${loaded ? " in" : ""} flex flex-col gap-5`} style={{ "--d": ".5s", marginTop: 26 } as CSSProperties}>
              <p className="lede text-balance">
                A custom operational solution that captures your communications, advances your pipeline, drafts your follow-ups, and files your meeting notes — before you&apos;ve opened your laptop.
              </p>
              <p className="lede text-balance hidden sm:block">
                Every action stages in one queue for your final call. Nothing leaves without your approval. We build the exact system your business needs and install it running.
              </p>
            </div>
            <div className={`rv${loaded ? " in" : ""}`} style={{ "--d": ".62s", marginTop: 32 } as CSSProperties}>
              <BookCallButton location="command_center_hero" />
            </div>
          </div>

          <div className={`rv${loaded ? " in" : ""} min-w-0`} style={{ "--d": ".38s" } as CSSProperties}>
            <ApprovalQueue />
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ── capability marquee ───────────────────────────────────────────────── */

function Marquee() {
  const loop = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="ink-panel">
      <div className="mq">
        <div className="mq-track marquee-track" aria-hidden="true">
          {loop.map((item, i) => (
            <span key={i}>
              <b>{item}</b> /
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── the problem ──────────────────────────────────────────────────────── */

function Problem() {
  return (
    <section className="sect">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            The bottleneck
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              When everything relies on you,
              <br />
              you become <span className="it">the ceiling.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              The constraint on scaling is rarely demand—it&apos;s the hours lost to admin, scattered notes, forgotten follow-ups, and manual coordination. A custom operational system captures every detail and does the heavy lifting, giving you back 15+ hours every week without hiring overhead.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── what we actually build ───────────────────────────────────────────── */

function Built() {
  return (
    <section className="sect ink-panel" id="built">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            What we build
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              A custom solution,
              <br />
              built for your
              <br />
              <span className="it">exact business.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Off-the-shelf software forces you to change how you work. We engineer custom operational solutions that fit directly into your existing tools, communication channels, and workflows. From day one, your system knows your clients, speaks your industry language, and executes your specific business rules.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── the demonstration ────────────────────────────────────────────────── */

function Demo() {
  return (
    <section className="sect" id="demo">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Interactive demonstration
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              See how your day
              <br />
              <span className="it">actually changes.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Try the live sandbox below. Approve draft emails, update deal stages, query records, or process meeting notes in seconds. For your business, this runs in the background with your real data, contacts, and workflow.
            </Reveal>
          </div>
        </div>
        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <CommandCenterDemo />
        </Reveal>
      </div>
    </section>
  );
}

/* ── how it works: the loop ───────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section className="sect" id="how">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            The process
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The 4-step loop
              <br />
              that <span className="it">runs your work.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Most tools wait around for you to ask. Your custom system stays ahead: capturing context, staging drafts, and queueing every next action so you can clear a morning of admin in minutes.
            </Reveal>
          </div>
        </div>

        <div className="steps">
          {LOOP_STEPS.map((step, i) => (
            <Reveal
              key={step.n}
              as="div"
              className="step item-rv"
              style={{ "--d": `${0.06 * i}s` } as CSSProperties}
            >
              <p className="step-n">STEP {step.n}</p>
              <div className="step-t">
                <h3 className="h3">{step.title}</h3>
                <span className="tag">{step.tag}</span>
              </div>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  );
}

/* ── the autonomy ladder ──────────────────────────────────────────────── */

function TrustLadder() {
  return (
    <section className="sect ink-panel" id="autonomy">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Control & Autonomy
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Complete oversight on day one.
              <br />
              Automation at <span className="it">your pace.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              You start with 100% control—every outbound message, record change, and follow-up waits for your review. As the system learns your voice and processes, you decide what runs autonomously and what requires your sign-off. You stay in total control at all times.
            </Reveal>
          </div>
        </div>

        <Reveal as="div" className="appr" style={{ marginTop: "clamp(44px,6vw,80px)" }}>
          {TRUST_LADDER.map((rung, i) => (
            <div key={rung.k} className="appr-c" style={{ "--d": `${0.12 * i}s` } as CSSProperties}>
              <span className="k">{rung.k}</span>
              <h3 className="h3">{rung.title}</h3>
              <p>{rung.body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ── the full surface ─────────────────────────────────────────────────── */

function Catalog() {
  return (
    <section className="sect" id="capabilities">
      <AmbientField />
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(30px,4vw,50px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            Capabilities
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              End-to-end automation
              <br />
              for your <span className="it">entire operation.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              A cross-section of what we build into your Command Center. We start by eliminating the biggest friction points in your client intake, sales pipeline, and delivery, then expand capabilities as your operation scales.
            </Reveal>
          </div>
        </div>
        <CapabilityCatalog />
      </div>
    </section>
  );
}

/* ── proof ────────────────────────────────────────────────────────────── */

function Proof() {
  return (
    <section className="sect ink-panel" id="proof">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Real-world tested
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Tested daily in our
              <br />
              <span className="it">own business.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              We run our own agency on this exact system every day—client intake, call notes, pipeline follow-ups, and proposals. On our strategy call, we will screen-share our live production system so you can see how it runs in real time.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── who it's for ─────────────────────────────────────────────────────── */

function WhoItsFor() {
  return (
    <section className="sect" id="who">
      <AmbientField />
      <div className="wrap">
        <div className="shead">
          <Reveal rv as="p" className="label eyebrow-anim">
            Who this fits
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Built for high-output
              <br />
              founders and <span className="it">lean teams.</span>
            </Reveal>
            <ul className="plan-list" style={{ marginTop: 26 }}>
              {WHO_ITS_FOR.map((item, i) => (
                <Reveal
                  key={item}
                  as="li"
                  className="item-rv"
                  style={{ "--d": `${0.06 * i}s` } as CSSProperties}
                >
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  <span>{item}</span>
                </Reveal>
              ))}
            </ul>
            <Reveal rv as="p" className="lede" delay={0.1}>
              A full operations team gets more out of this, not less—the routine work runs itself, so your people spend their time on what actually needs a person.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── faq ──────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="sect" id="faq" style={{ paddingTop: 0 }}>
      <AmbientField />
      <div className="wrap">
        <div className="shead" style={{ marginBottom: "clamp(28px,3.6vw,46px)" }}>
          <Reveal rv as="p" className="label eyebrow-anim">
            Before you book
          </Reveal>
          <Reveal rv as="h2" className="h2" delay={0.06}>
            The questions people
            <br />
            actually <span className="it">ask.</span>
          </Reveal>
        </div>

        <div className="efaq">
          {commandCenterFaqs.map((faq, i) => (
            <Reveal
              key={faq.question}
              as="details"
              className="item-rv"
              style={{ "--d": `${0.06 * i}s` } as CSSProperties}
              open={open === i}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                setOpen(open === i ? -1 : i);
              }}
            >
              <summary>
                {faq.question}
                <span className="pm" />
              </summary>
              <div className="ans">
                <div>
                  <p>{faq.answer}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── closing ──────────────────────────────────────────────────────────── */

function Closing() {
  const headingRef = useRv<HTMLHeadingElement>();

  return (
    <section className="sect ink-panel" id="call">
      <AmbientField />
      <div className="wrap">
        <div className="fcta">
          <Reveal rv as="p" className="label eyebrow-anim">
            Next steps
          </Reveal>
          <h2 ref={headingRef} className="h2 line-h">
            <span className="line">
              <span style={{ "--d": ".05s" } as CSSProperties}>Get your custom</span>
            </span>
            <span className="line">
              <span className="it" style={{ "--d": ".12s" } as CSSProperties}>
                automation roadmap.
              </span>
            </span>
          </h2>
          <Reveal rv as="p" className="lede" delay={0.1}>
            A free 30-minute operational consultation to pinpoint your bottlenecks. You will receive a tailored action plan showing exactly how to automate your core workflows—yours to keep whether we work together or not.
          </Reveal>
          <Reveal rv as="div" delay={0.16}>
            <BookCallButton variant="inverse" location="command_center_closing" />
          </Reveal>
          <Reveal
            rv
            as="div"
            delay={0.22}
            className="cta-cluster"
            style={{ justifyContent: "center", marginTop: 30 }}
          >
            <span className="tag">Free</span>
            <span className="tag">30 minutes</span>
            <span className="tag">Plan is yours to keep</span>
            <span className="tag">Straight to the founder</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

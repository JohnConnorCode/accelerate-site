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
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const gridDrift = useTransform(scrollYProgress, [0, 1], [0, 120]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section ref={sectionRef} className={`hero cc-hero${loaded ? " loaded" : ""}`} id="top">
      <motion.div className="hero-field" aria-hidden="true" style={reduced ? undefined : { y: gridDrift }}>
        <div className="hero-grid-base" />
        <div className="hero-grid-lit" />
        <span className="hero-tick hero-tick-tl" />
        <span className="hero-tick hero-tick-br" />
      </motion.div>

      <motion.div className="wrap" style={reduced ? undefined : { opacity: fade, y: lift }}>
        <div className="grid items-center gap-y-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-x-14">
          <div className="min-w-0">
            <p className={`label eyebrow-anim rv${loaded ? " in" : ""}`}>Command Center</p>
            <h1 className="h1">
              <span className="line">
                <span style={{ "--d": ".06s" } as CSSProperties}>An AI that runs</span>
              </span>
              <span className="line">
                <span style={{ "--d": ".13s" } as CSSProperties}>your business.</span>
              </span>
              <span className="line">
                <span className="it" style={{ "--d": ".2s" } as CSSProperties}>
                  You approve the work.
                </span>
              </span>
            </h1>
            <p className={`lede rv${loaded ? " in" : ""}`} style={{ "--d": ".5s", marginTop: 26 } as CSSProperties}>
              It reads your calls, your email and your calendar, then acts on what it finds: the follow-up written, the deal moved to the right stage, the next call booked, the notes filed. Every one of those waits in a single queue for your approval. We build it around how your business actually runs and hand it over already loaded with your history.
            </p>
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
            What it costs you
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The business knows things
              <br />
              that only <span className="it">you know.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Tuesday&apos;s call produced three commitments, two of them yours, and none of them exist anywhere but your memory. Multiply that across a week of calls and email and the real constraint on the business is not demand or capacity. It is how fast one person can work through what they already know. An operations hire fixes that. So does a system that captures the same things and acts on them, for a good deal less, running inside two weeks.
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
              Built around your
              <br />
              business, not
              <br />
              <span className="it">configured to it.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              There is no generic version of this. The discovery works out how your business actually runs: what a job or a matter or a deal is called in your language, which decisions you would never hand to software, and where the hours currently go. What we build follows that. The categories, the vocabulary, and the stages end up being yours, which is why two installs in the same industry never look alike.
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
            A demonstration
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              What it is like
              <br />
              <span className="it">to work in one.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Below is a working demonstration running on invented data for a company that does not exist. It is not a screenshot and not a recording, so you can clear the queue, open a record, ask it a question and apply a set of meeting notes. Read it as the shape of the thing rather than the thing itself: yours would be built around your work, with your people and your language in it.
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
            How it works
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The loop everything
              <br />
              <span className="it">runs on.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Whatever we end up building for you, the mechanism underneath is the same four steps. Most tools hand you a draft when you go looking for one. This has already written it, attached it to the right record and put it in a queue before you sat down.
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
            Autonomy
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              The approval step is
              <br />
              meant to <span className="it">get smaller.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              An approval queue is easy to sell and easy to get wrong. If you are still clicking approve on the same routine work a year from now, it has quietly become a slower way of doing the job yourself. So the gate moves. Each category of work carries its own setting and graduates once you have approved it unedited often enough that reading it stopped being a decision, a call you make yourself, backed by the approval rate it rests on and reversible in one click.
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
            Scope
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              What we can put
              <br />
              <span className="it">in yours.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              This is the surface we draw from, not a list you receive. Most installs start with the four or five things that pay for the build and grow from there once those are running. Working out which ones those are for you is what the first call is for.
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
            Where this comes from
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              We built it for
              <br />
              <span className="it">ourselves first.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              This was not designed as a product. We had the same problem, built something to solve it, and have been running our own operation on it daily since, the calls, the follow-ups, the pipeline, the notes, so every rough edge you would have hit, we hit first. On the call we will screen-share the real one rather than the demonstration above, mess included.
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
              Businesses where one
              <br />
              person is <span className="it">the constraint.</span>
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
              If you already have an operations manager and a system the team actually follows, you need less than this, and we will say so on the call.
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
            Start
          </Reveal>
          <h2 ref={headingRef} className="h2 line-h">
            <span className="line">
              <span style={{ "--d": ".05s" } as CSSProperties}>Find out what this</span>
            </span>
            <span className="line">
              <span className="it" style={{ "--d": ".12s" } as CSSProperties}>
                would look like for you.
              </span>
            </span>
          </h2>
          <Reveal rv as="p" className="lede" delay={0.1}>
            Thirty minutes on how your operation actually runs, then a written plan you keep either way. If a Command Center is the wrong thing to build for you, that is a perfectly good outcome for the call.
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

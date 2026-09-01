"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useHydratedReducedMotion } from "@/hooks/useHydratedReducedMotion";
import { BookCallButton } from "@/components/v2/studio/primitives";
import { Reveal, useRv } from "@/components/home/reveal";
import { AmbientField } from "@/components/home/AmbientField";
import { ApprovalQueue } from "@/components/command-center/ApprovalQueue";
import { CapabilityCatalog } from "@/components/command-center/CapabilityCatalog";
import { CommandCenterDemo } from "@/components/command-center/demo/CommandCenterDemo";
import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { commandCenterFaqs } from "@/content/command-center-faq";
import { LOOP_STEPS, TRUST_LADDER, MARQUEE_ITEMS, WHO_ITS_FOR } from "@/content/command-center";
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
  const reduced = useHydratedReducedMotion();

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
    // Leave the initial styles in place for two frames before revealing. This
    // makes the word cascade reliable after an App Router navigation instead
    // of depending on a cache-timing-sensitive timeout.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setLoaded(true));
    });
    const onPageShow = () => setLoaded(true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <section ref={sectionRef} className={`hero cc-hero${loaded ? " loaded" : ""}`} id="top">
      <motion.div
        className="hero-field"
        aria-hidden="true"
        style={reduced ? undefined : { y: gridDrift }}
      >
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
                {["More", "every", "month."].map((w, i) => (
                  <span key={w} className="word">
                    <span className="it" style={{ "--d": `${0.46 + i * 0.08}s` } as CSSProperties}>
                      {w}
                    </span>
                  </span>
                ))}
              </span>
            </h1>
            <div
              className={`rv${loaded ? " in" : ""} flex flex-col gap-5`}
              style={{ "--d": ".5s", marginTop: 26 } as CSSProperties}
            >
              <p className="lede text-balance">
                The Command Center is one integrated solution we build for businesses that need
                shared context and connected execution. It is not a required starting point or the
                right answer for every team.
              </p>
              <p className="lede text-balance">
                It captures communications, advances the pipeline, drafts follow-ups, and files
                meeting notes before you have opened the laptop.
              </p>
              <p className="lede text-balance hidden sm:block">
                Smart approvals route the judgment calls to you and let the routine earn the right
                to run itself. We build it around your business and install it running.
              </p>
            </div>
            <div
              className={`rv${loaded ? " in" : ""}`}
              style={{ "--d": ".62s", marginTop: 32 } as CSSProperties}
            >
              <BookCallButton location="command_center_hero" />
            </div>
          </div>

          <div
            className={`rv${loaded ? " in" : ""} min-w-0`}
            style={{ "--d": ".38s" } as CSSProperties}
          >
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
            When it fits
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Use one operating layer
              <br />
              when the work <span className="it">needs one.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              A focused workflow is enough for many teams. The Command Center fits when
              communications, records, approvals, and recurring work need durable context across the
              operation.
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
              Built for how
              <br />
              your business
              <br />
              <span className="it">already runs.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              Off-the-shelf software asks you to change how you work. We put the system into the
              tools, channels, and rules you already have. From day one it knows your clients and
              speaks the trade.
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
              Try the live sandbox below. Approve draft emails, update deal stages, query records,
              or process meeting notes in seconds. For your business, this runs in the background
              with your real data, contacts, and workflow.
            </Reveal>
          </div>
        </div>
        <Reveal rv as="div" delay={0.1} style={{ marginTop: "clamp(32px,4vw,54px)" }}>
          <CommandCenterDemo />
          <div className="mt-4 flex justify-end">
            <Link
              href="/demo/command-center"
              className="inline-flex min-h-12 items-center rounded-xl bg-[var(--fg)] px-5 text-xs font-semibold text-[var(--bg)] transition-[opacity,transform] hover:opacity-80 active:scale-[0.96]"
            >
              Open the full admin demo →
            </Link>
          </div>
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
              Most tools wait around for you to ask. Your custom system stays ahead: capturing
              context, staging drafts, and queueing every next action so you can clear a morning of
              admin in minutes.
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
            Smart approvals
          </Reveal>
          <div>
            <Reveal rv as="h2" className="h2" delay={0.06}>
              Approvals that learn.
              <br />
              Autonomy that <span className="it">compounds.</span>
            </Reveal>
            <Reveal rv as="p" className="lede" delay={0.12} style={{ marginTop: 20 }}>
              The queue starts strict and gets smarter. As the system nails your voice and your
              calls, whole categories of routine work graduate to running on their own, and your
              attention goes only where it is genuinely worth attention.
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
              What we put in first is whatever is trapping the team: intake, the pipeline,
              follow-up. Then we expand as the week actually comes back.
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
              We run our own agency on this system every day: intake, call notes, follow-ups,
              proposals. On the strategy call we will screen-share the live production system so you
              can see how it actually runs.
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
              A full operations team gets more out of this, not less. The routine work runs itself,
              so people spend the week on what actually needs a person.
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
              <span style={{ "--d": ".05s" } as CSSProperties}>Leave the first session</span>
            </span>
            <span className="line">
              <span className="it" style={{ "--d": ".12s" } as CSSProperties}>
                with a written plan.
              </span>
            </span>
          </h2>
          <Reveal rv as="p" className="lede" delay={0.1}>
            A free strategy session, thirty minutes. We map where your team loses the week and write
            the plan for taking that work over. Yours to keep either way.
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
            <span className="tag">30 min</span>
            <span className="tag">Yours to keep</span>
            <span className="tag">Straight to the founder</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

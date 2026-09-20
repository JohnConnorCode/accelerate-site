import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { distributionProfile } from "@/lib/distribution/profile";
import { ArrowRight } from "lucide-react";
import {
  DEMO_SCENARIO_SHELL_NAMES,
  DEMO_SCENARIO_SUMMARIES,
  type DemoScenarioId,
} from "@/lib/admin/demo/scenarios";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { WorkflowShowcase } from "@/components/command-center/WorkflowShowcase";
import { DemoStory } from "@/components/command-center/launcher/DemoStory";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import styles from "@/components/command-center/product.module.css";

export const metadata: Metadata = {
  title: "Explore a Command Center demo",
  description:
    "Explore a real Command Center workflow with fictional business data. See customer context, AI review and the next action in one workspace.",
  robots: { index: false, follow: false },
};

const previews: Record<
  DemoScenarioId,
  { task: string; image: string; screen: string; explore: string[] }
> = {
  "northline-roofing": {
    task: "Keep a customer inquiry connected to the next job.",
    image: "northline-conversations.png",
    screen: "Conversations",
    explore: [
      "Read a homeowner’s request",
      "Open a customer conversation",
      "Inspect an opportunity and its next action",
    ],
  },
  "alder-ridge-law": {
    task: "Follow an inquiry with the client’s context in view.",
    image: "alder-pipeline.png",
    screen: "Pipeline",
    explore: [
      "Explore the firm’s pipeline",
      "Read the history behind an opportunity",
      "Review assigned follow-up",
    ],
  },
  "ledgerstone-advisory": {
    task: "Coordinate client work and the commitments behind it.",
    image: "ledgerstone-onboarding.png",
    screen: "Client onboarding",
    explore: [
      "Review client records",
      "Inspect tasks and upcoming commitments",
      "Create a reviewed onboarding checklist",
    ],
  },
  "hearthline-realty": {
    task: "Keep buyer conversations and business activity connected.",
    image: "hearthline-pipeline.png",
    screen: "Pipeline",
    explore: [
      "Explore the buyer pipeline",
      "Review the next customer action",
      "Check the context behind a buyer’s next step",
    ],
  },
  "common-table-network": {
    task: "Bring community relationships and shared work together.",
    image: "common-table-commitments.png",
    screen: "Meeting commitments",
    explore: [
      "Explore supporter records",
      "Turn meeting commitments into tasks",
      "Review community follow-up tasks",
    ],
  },
  superdebate: {
    task: "Review customer billing alongside the work it supports.",
    image: "superdebate-invoicing.png",
    screen: "Invoicing",
    explore: [
      "Explore community relationships",
      "Review the day’s work",
      "Prepare and review a fictional invoice",
    ],
  },
};

export default function AdminDemoLauncher() {
  return (
    <div className={`${styles.page} ${styles.launcherPage}`}>
      <header className={styles.hero}>
        <div className={styles.heroGridField} aria-hidden="true" />
        <div className="wrap">
          <AnimateOnScroll as="div" stagger className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className="label">Explore Command Center</p>
              <h1 className={styles.title}>
                Your business.
                <br />
                <em>Working together.</em>
              </h1>
              <p className={styles.lede}>
                See the work that needs attention, give AI the context it needs, and keep every
                decision connected to the customer and the result.
              </p>
              <p className={styles.note}>
                Fictional data. No signup. Explore the real workspace in this browser session.
              </p>
              <div className={styles.actions}>
                <a href="#workflows" className={styles.primary}>
                  Try a complete workflow <ArrowRight size={16} aria-hidden="true" />
                </a>
                <Link href="#business-demos" className={styles.secondary}>
                  Find your business <span aria-hidden="true">↓</span>
                </Link>
              </div>
            </div>
            <div className={styles.heroStage}>
              <DemoStory />
            </div>
          </AnimateOnScroll>
        </div>
      </header>

      <section className={styles.section} id="workflows" aria-labelledby="demo-workflows-title">
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro}>
            <div>
              <p className="label">Three ways to try it</p>
              <h2 className={styles.heading} id="demo-workflows-title">
                Follow the work through to its result.
              </h2>
            </div>
            <p className={styles.lede}>
              Pick a real operating moment. See the records, decisions and next action that make
              the workflow useful.
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll className={styles.workflowShell} delay={0.08}>
            <WorkflowShowcase />
          </AnimateOnScroll>
        </div>
      </section>

      <section
        className={styles.section}
        id="business-demos"
        aria-labelledby="business-demos-title"
      >
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro}>
            <div>
              <p className="label">Six fictional workspaces</p>
              <h2 className={styles.heading} id="business-demos-title">
                Start with a job you recognize.
              </h2>
            </div>
            <p className={styles.lede}>
              Each business uses the same platform with its own records and appearance. Open any
              workspace and explore freely.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className={styles.demoGrid} staggerDelay={0.06}>
            {DEMO_SCENARIO_SUMMARIES.map((scenario) => {
              const preview = previews[scenario.id];
              return (
                <article key={scenario.id} className={`${styles.card} ${styles.scenario}`}>
                  <div className={styles.scenarioHeading}>
                    <p className="label">{scenario.category}</p>
                    <DemoScenarioMark scenarioId={scenario.id} className="size-9" />
                  </div>
                  <h3>{DEMO_SCENARIO_SHELL_NAMES[scenario.id]}</h3>
                  <p>{preview.task}</p>
                  {distributionProfile() === "branded" && (
                    <figure className={styles.figure}>
                      <Image
                        src={`/images/demo/${preview.image}`}
                        alt={`${preview.screen} in the fictional ${scenario.name} workspace.`}
                        width={1440}
                        height={1000}
                        sizes="(max-width: 760px) 100vw, 400px"
                      />
                      <figcaption className={styles.note}>
                        {preview.screen} · Fictional demo data
                      </figcaption>
                    </figure>
                  )}
                  <ul aria-label={`Things to try in ${scenario.name}`}>
                    {preview.explore.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                  <div className={styles.actions}>
                    <Link
                      href={`/demo/command-center/${scenario.id}/today`}
                      className={styles.primary}
                      aria-label={`Explore ${scenario.name} demo workspace`}
                    >
                      Open this workspace <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </StaggerContainer>
        </div>
      </section>

      <section className={styles.section}>
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro}>
            <div>
              <p className="label">Keep going</p>
              <h2 className={styles.heading}>Build a system that gets better with use.</h2>
            </div>
            <p className={styles.lede}>
              The demo is a starting point. Learn how the platform fits together, then run it for
              the work your business actually does.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className={styles.grid} staggerDelay={0.1}>
            <article className={styles.card}>
              <p className="label">Make it useful</p>
              <h3>Follow a complete workflow.</h3>
              <p>
                See which features and plugins to combine, what to set up and how to check the
                result for your business.
              </p>
              <Link href="/docs/recipes" className={styles.textLink}>
                Explore workflow recipes <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className={styles.card}>
              <p className="label">Make it yours</p>
              <h3>Build on the open-source platform.</h3>
              <p>
                Run the workspace yourself or extend it with a custom App, connector or plugin using
                the shared business services.
              </p>
              <Link href="/docs/extend" className={styles.textLink}>
                Read the builder guides <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </StaggerContainer>
          <AnimateOnScroll delay={0.12}>
            <Link href="/command-center" className={styles.textLink}>
              Explore the platform’s capabilities <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  );
}

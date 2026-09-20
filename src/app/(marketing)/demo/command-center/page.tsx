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
import styles from "@/components/command-center/product.module.css";

export const metadata: Metadata = {
  title: "Explore a Command Center demo",
  description:
    "Choose a fictional business and try the real workspace. Explore customer context, follow-up and shared work with no signup.",
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
    <main className={`${styles.page} demo-launcher`}>
      <header className={styles.hero}>
        <div className="wrap">
          <div className={styles.intro}>
            <div>
              <p className="label">Explore Command Center</p>
              <h1 className={styles.title}>
                Choose a business.
                <br />
                <em>See the work.</em>
              </h1>
            </div>
            <div>
              <p className={styles.lede}>
                Step into the real workspace with fictional customers, conversations and tasks.
                Choose an example close to your business and follow a piece of work through its
                records.
              </p>
              <p className={styles.note}>
                No signup. Changes stay in this browser session. Messages and other actions are
                simulated.
              </p>
              <div className={styles.actions}>
                <a href="#workflows" className={styles.primary}>
                  Try a complete workflow <ArrowRight size={16} aria-hidden="true" />
                </a>
                <Link href="#business-demos" className={styles.secondary}>
                  Browse all six businesses
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>
      <section className={styles.section} id="workflows" aria-labelledby="demo-workflows-title">
        <div className="wrap">
          <p className="label">Three ways to try it</p>
          <h2 className={styles.heading} id="demo-workflows-title">
            Follow the work through to its result.
          </h2>
          <WorkflowShowcase />
        </div>
      </section>
      <section
        className={styles.section}
        id="business-demos"
        aria-labelledby="business-demos-title"
      >
        <div className="wrap">
          <div className={styles.sectionIntro}>
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
          </div>
          <div className={styles.demoGrid}>
            {DEMO_SCENARIO_SUMMARIES.map((scenario) => {
              const preview = previews[scenario.id];
              return (
                <article
                  key={scenario.id}
                  className={`${styles.card} ${styles.scenario} demo-launcher-card`}
                >
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
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.grid}>
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
          </div>
          <Link href="/command-center" className={styles.textLink}>
            Explore the platform’s capabilities <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

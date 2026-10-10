import "../../../admin-chrome.css";
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
import { ClientLifecycle } from "@/components/command-center/ClientLifecycle";
import { DemoStory } from "@/components/command-center/launcher/DemoStory";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import styles from "@/components/command-center/product.module.css";

export const metadata: Metadata = {
  title: "Try Command Center's business workflows",
  description:
    "Explore customer, sales, delivery, billing, marketing and AI workflows in Command Center with fictional business data.",
  robots: { index: false, follow: false },
};

const previews: Record<
  DemoScenarioId,
  { task: string; image: string; screen: string; explore: string[] }
> = {
  "northline-roofing": {
    task: "“Find unanswered homeowner inquiries and prepare the next reply.”",
    image: "northline-conversations.png",
    screen: "Conversations",
    explore: [
      "Ask what needs attention today",
      "Prepare a reply using the customer’s thread",
      "Create a follow-up task",
    ],
  },
  "alder-ridge-law": {
    task: "“Show me the inquiries waiting on us and prepare a follow-up.”",
    image: "alder-pipeline.png",
    screen: "Pipeline",
    explore: [
      "Ask which inquiries need a response",
      "Get the history behind a client’s next step",
      "Prepare a follow-up for review",
    ],
  },
  "ledgerstone-advisory": {
    task: "“Turn our client commitments into an assigned checklist.”",
    image: "ledgerstone-onboarding.png",
    screen: "Client onboarding",
    explore: [
      "Ask about a client’s commitments",
      "Identify overdue work and its owner",
      "Prepare an onboarding checklist",
    ],
  },
  "hearthline-realty": {
    task: "“Find buyers who need a follow-up and explain the next step.”",
    image: "hearthline-pipeline.png",
    screen: "Pipeline",
    explore: [
      "Ask which buyers need a follow-up",
      "Prepare the next customer action",
      "Explain the evidence behind a recommendation",
    ],
  },
  "common-table-network": {
    task: "“Turn the meeting commitments into follow-up tasks.”",
    image: "common-table-commitments.png",
    screen: "Meeting commitments",
    explore: [
      "Ask about a supporter’s recent activity",
      "Create tasks from meeting commitments",
      "Check who owns each follow-up",
    ],
  },
  superdebate: {
    task: "“Find invoices that need attention and prepare a reminder.”",
    image: "superdebate-invoicing.png",
    screen: "Invoicing",
    explore: [
      "Ask which relationships need attention",
      "Get a brief with the records behind it",
      "Prepare a fictional billing follow-up",
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
                Follow the customer.
                <br />
                <em>See the business work.</em>
              </h1>
              <p className={styles.lede}>
                Explore sales, client delivery, billing, marketing and AI in the same workspace.
                Follow a homeowner from inquiry to an assigned job and invoice, or choose the
                business closest to yours and try a specific task.
              </p>
              <p className={styles.note}>
                Explore a fictional business. Actions are simulated, and no signup is required. If
                the demo agent is unavailable, you can still explore the workspace.
              </p>
              <div className={styles.actions}>
                <Link
                  href="/demo/command-center/northline-roofing/today?workflow=client"
                  className={styles.primary}
                >
                  Follow the client lifecycle <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="#business-demos" className={styles.secondary}>
                  Explore the workspace <span aria-hidden="true">↓</span>
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
              <p className="label">One homeowner across the business</p>
              <h2 className={styles.heading} id="demo-workflows-title">
                Follow the client lifecycle.
              </h2>
            </div>
            <p className={styles.lede}>
              Start with Lena Walsh&apos;s request in Northline Roofing, then inspect the
              opportunity, delivery work and billing records. People and supported AI operations use
              the same workspace throughout.
            </p>
          </AnimateOnScroll>
          <ClientLifecycle demo />
          <Link
            href="/demo/command-center/northline-roofing/today?workflow=client"
            className={styles.primary}
          >
            Open the guided workspace <ArrowRight size={16} aria-hidden="true" />
          </Link>
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
              Choose a business and try its suggested request, or ask your own question. Each
              workspace has fictional customers, conversations and work to explore.
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
                        unoptimized
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
                      href={`/demo/command-center/${scenario.id}/today?agent=priorities`}
                      className={styles.primary}
                      aria-label={`Explore ${scenario.name} demo workspace`}
                    >
                      Ask this business’s agent <ArrowRight size={16} aria-hidden="true" />
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
              <h2 className={styles.heading}>Put your agent to work with your own context.</h2>
            </div>
            <p className={styles.lede}>
              Connect your tools, define what your agent can handle and keep a record of every
              result. Accelerate can help you decide where AI belongs, build the right solution and
              run and improve it with your team. Command Center is one option.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className={styles.grid} staggerDelay={0.1}>
            <article className={styles.card}>
              <p className="label">Make it useful</p>
              <h3>Choose the work you want to delegate.</h3>
              <p>
                Start with customer replies, client handoffs or invoice follow-ups. The recipes
                explain the setup, permissions and results to check.
              </p>
              <Link href="/docs/recipes" className={styles.textLink}>
                Explore workflow recipes <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className={styles.card}>
              <p className="label">Make it yours</p>
              <h3>Build on the open-source platform.</h3>
              <p>
                Run the workspace yourself, connect an agent through MCP or add a custom App. Agents
                and screens use the same business services and permission checks.
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

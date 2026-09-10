import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  GitBranch,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { DEMO_SCENARIO_SHELL_NAMES, DEMO_SCENARIO_SUMMARIES } from "@/lib/admin/demo/scenarios";
import { DemoScenarioMark } from "@/components/admin/DemoScenarioMark";
import { DemoWorkspacePreview } from "@/components/admin/DemoWorkspacePreview";
import { DemoStory } from "@/components/command-center/launcher/DemoStory";
import styles from "@/components/command-center/launcher/launcher.module.css";

export const metadata: Metadata = {
  title: "Try Command Center | Your business, connected",
  description:
    "See how an AI workspace brings customers, conversations and next steps together. Explore six interactive business demos, with no signup required.",
  robots: { index: false, follow: false },
};

const examples = [
  "Turn a customer inquiry into the next booked job.",
  "Keep each client conversation connected to the case.",
  "Stay on top of client work and upcoming deadlines.",
  "Follow every buyer conversation through the pipeline.",
  "Bring donor relationships and community work together.",
  "Coordinate events, members and a growing community.",
];

export default function AdminDemoLauncher() {
  return (
    <main className={`demo-launcher ${styles.page}`}>
      <div className={styles.container}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>
              <span /> MEET YOUR COMMAND CENTER
            </p>
            <h1>
              Your business.
              <br />
              <span>Working together.</span>
            </h1>
            <p className={styles.intro}>
              Customers, conversations and AI in one workspace. See what needs attention, prepare
              the next move, and give your team more time for the work that matters.
            </p>
            <div className={styles.heroActions}>
              <Link href="/demo/command-center/northline-roofing/today" className={styles.primary}>
                Try the demo <ArrowUpRight size={19} />
              </Link>
              <a href="#business-demos" className={styles.secondary}>
                Find your business <ArrowDown size={16} />
              </a>
            </div>
            <p className={styles.reassurance}>
              <Check size={14} /> No signup. Explore with sample data.
            </p>
          </div>
          <DemoStory />
        </header>

        <section className={styles.valueStrip} aria-label="Why Command Center">
          <div>
            <Layers />
            <p>
              <strong>One connected picture</strong>
              <span>Customer history travels with the work.</span>
            </p>
          </div>
          <div>
            <SlidersHorizontal />
            <p>
              <strong>AI with your oversight</strong>
              <span>Review proposed actions before they run.</span>
            </p>
          </div>
          <div>
            <GitBranch />
            <p>
              <strong>Built around your business</strong>
              <span>Own the source. Extend the workspace.</span>
            </p>
          </div>
        </section>

        <section
          id="business-demos"
          className={styles.scenarios}
          aria-labelledby="business-demos-title"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.kicker}>SIX BUSINESSES. ROOM TO EXPLORE.</p>
              <h2 id="business-demos-title">See yourself in the work.</h2>
            </div>
            <p>
              Choose a business and step inside. Explore its customers, try an AI conversation, or
              review the day’s priorities.
            </p>
          </div>
          <div className={styles.scenarioGrid}>
            {DEMO_SCENARIO_SUMMARIES.map((scenario, index) => (
              <Link
                key={scenario.id}
                href={`/demo/command-center/${scenario.id}/today`}
                className={`demo-launcher-card ${styles.scenarioCard}`}
                aria-label={`Explore ${scenario.name} demo workspace`}
              >
                <div className={styles.scenarioIdentity}>
                  <span className={styles.scenarioMark} style={{ background: scenario.accent }}>
                    <DemoScenarioMark scenarioId={scenario.id} className="size-7" />
                  </span>
                  <span>{scenario.category}</span>
                  <ArrowUpRight size={19} />
                </div>
                <h3>{DEMO_SCENARIO_SHELL_NAMES[scenario.id]}</h3>
                <p>{examples[index]}</p>
                <DemoWorkspacePreview scenarioId={scenario.id} />
                <span className={styles.cardAction}>
                  Explore this business <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
          <p className={styles.demoNote}>
            Every business is fictional. Your demo changes stay in this browser session, and
            messages are simulated.
          </p>
        </section>

        <section className={styles.closing} aria-labelledby="make-it-yours">
          <div>
            <p className={styles.kicker}>START WITH WHAT YOUR TEAM NEEDS</p>
            <h2 id="make-it-yours">
              Imagine this.
              <br />
              Built for your business.
            </h2>
            <p>
              We help you find the right use for AI, build around your existing tools, and keep
              improving the work with your team.
            </p>
          </div>
          <div className={styles.closingActions}>
            <Link href="/contact" className={styles.primary}>
              Let’s talk about your business <ArrowUpRight size={18} />
            </Link>
            <Link href="/command-center" className={styles.secondary}>
              Explore Command Center <ArrowRight size={16} />
            </Link>
            <p>From a focused automation to a complete workspace.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

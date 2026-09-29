import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsManifest, docsTracks } from "@/content/docs/manifest";
import { workflowRecipes } from "@/content/workflow-recipes";
import { RecipeCards } from "@/components/command-center/WorkflowRecipes";
import { DocsFigure } from "@/components/docs/DocsFigure";
import { DocsSectionIcon } from "@/components/docs/docs-section-icon";
import { seoMetadata } from "@/lib/og";
import styles from "@/components/docs/docs.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Documentation",
  description:
    "Follow a customer inquiry from context to next action and recorded result. Then connect your own workspace or build on the open-source foundation.",
  path: "/docs",
});

export default function DocsLandingPage() {
  return (
    <div className={styles.landing}>
      <header className={styles.landingHero}>
        <p className="label">Documentation</p>
        <h1 className={styles.landingTitle}>
          From inquiry to <em>recorded result.</em>
        </h1>
        <p className={styles.landingLede}>
          Start with a fictional customer inquiry and follow the record, decision and next action
          through Command Center. Then use these guides to connect your own workspace or build the
          workflow your team needs.
        </p>
      </header>
      <div className={styles.pathGrid}>
        <section className={styles.pathCard} aria-labelledby="run-business">
          <p className="label">Business users</p>
          <h2 id="run-business" className="my-3 font-display text-2xl font-medium">
            Run a customer workflow
          </h2>
          <p>
            See what needs attention, open the customer context, review a proposed action and check
            what happened. The demo works without an account.
          </p>
          <div className={styles.pathActions}>
            <Link className={styles.textLink} href="/docs/start/daily-path">
              Try your first workflow <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={styles.textLink} href="/docs/start/business-owners">
              Plan your first connected workflow
            </Link>
          </div>
        </section>
        <section className={styles.pathCard} aria-labelledby="build-platform">
          <p className="label">Builders and agencies</p>
          <h2 id="build-platform" className="my-3 font-display text-2xl font-medium">
            Build on the same foundation
          </h2>
          <p>
            Start the source locally, connect a database you control and add a workflow that uses
            the existing records, permissions and action history.
          </p>
          <div className={styles.pathActions}>
            <Link className={styles.textLink} href="/docs/extend/first-change">
              Make your first change <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className={styles.textLink} href="/docs/start/agencies">
              Set up a client pilot
            </Link>
          </div>
        </section>
      </div>
      <section className={styles.landingSection} aria-labelledby="recipes-heading">
        <p className="label">A complete example</p>
        <h2 id="recipes-heading" className={styles.sectionTitle}>
          Choose a result, then follow the steps.
        </h2>
        <p className="mb-6 leading-relaxed text-white-secondary">
          Each recipe starts with work a team needs to finish, shows the screens and setup involved,
          and names the result to check. Choose the example closest to your business.
        </p>
        <RecipeCards
          recipes={workflowRecipes.filter((item) =>
            ["roofing-inquiry", "engagement-onboarding"].includes(item.id),
          )}
        />
        <Link href="/docs/recipes" className={styles.textLink}>
          Browse all industry recipes <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <DocsFigure
        src="/images/docs/command-center/today.png"
        width={1440}
        height={1000}
        alt="Today in the fictional Northline Roofing workspace, with priorities and decisions."
        caption="Today brings the work needing attention into one view. Open its source record to understand the context, then inspect the saved result after acting. The example uses fictional demo data."
      />
      <section aria-labelledby="docs-directory" className={styles.landingSection}>
        <h2 id="docs-directory" className={styles.sectionTitle}>
          Find the guide you need.
        </h2>
        <p className="mb-6 leading-relaxed text-white-secondary">
          Use search for a specific task or browse the guides below. Feature references explain
          individual capabilities; recipes show how to combine them.
        </p>
        {docsTracks.map((track) => (
          <section key={track.id} className={styles.track} aria-labelledby={`track-${track.id}`}>
            <h3 id={`track-${track.id}`} className={styles.trackTitle}>
              {track.title}
            </h3>
            <div className={styles.directoryGrid}>
              {docsManifest
                .filter((section) => section.track === track.id)
                .map((section) => (
                  <Link
                    key={section.id}
                    href={`/docs/${section.id}`}
                    className={styles.directoryLink}
                  >
                    <DocsSectionIcon sectionId={section.id} className="mt-1 h-5 w-5 shrink-0" />
                    <span>
                      <strong className="block font-medium">{section.title}</strong>
                      <span className="mt-1 block text-sm leading-relaxed text-white-secondary">
                        {section.description}
                      </span>
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </section>
      <aside className={styles.helpCard}>
        <h2 className="mb-3 font-display text-xl font-medium">Something did not work?</h2>
        <p>
          Start with the symptom, check the connection or saved action result, and follow the
          recovery steps before creating another attempt.
        </p>
        <Link href="/docs/start/troubleshooting" className={styles.textLink}>
          Find the recovery guide <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}

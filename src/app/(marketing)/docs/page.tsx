import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { docsManifest, docsTracks } from "@/content/docs/manifest";
import { workflowRecipes } from "@/content/workflow-recipes";
import { RecipeCards } from "@/components/command-center/WorkflowRecipes";
import { DocsFigure } from "@/components/docs/DocsFigure";
import { DocsSectionIcon } from "@/components/docs/docs-section-icon";
import { seoMetadata } from "@/lib/og";
import styles from "@/components/command-center/product.module.css";

export const metadata: Metadata = seoMetadata({
  title: "Documentation",
  description:
    "Run a useful business workflow or build on Accelerate. Practical setup guides, industry recipes, features, plugins and extension references.",
  path: "/docs",
});

export default function DocsLandingPage() {
  return (
    <>
      <p className="label">Documentation</p>
      <h1 className={styles.heading}>Put your workspace to work.</h1>
      <p className={styles.lede}>
        Choose a task, understand the pieces it needs and follow the result back to the record.
        These guides help business teams run Command Center and builders adapt the platform around
        their work.
      </p>
      <div className={`${styles.grid} mt-8`}>
        <section className={styles.card} aria-labelledby="run-business">
          <p className="label">Business users</p>
          <h2 id="run-business" className="my-3 font-display text-2xl font-medium">
            Run your business
          </h2>
          <p>
            Try a workflow in the fictional demo, then learn how to connect your workspace and
            operate it day to day.
          </p>
          <Link className={styles.textLink} href="/docs/start/daily-path">
            Try your first workflow <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <br />
          <Link className={styles.textLink} href="/docs/start/business-owners">
            Plan your first connected workflow
          </Link>
        </section>
        <section className={styles.card} aria-labelledby="build-platform">
          <p className="label">Builders and agencies</p>
          <h2 id="build-platform" className="my-3 font-display text-2xl font-medium">
            Build on the platform
          </h2>
          <p>
            Run the source, make a small change and reuse business records, permissions and services
            in your own extension.
          </p>
          <Link className={styles.textLink} href="/docs/extend/first-change">
            Make your first change <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <br />
          <Link className={styles.textLink} href="/docs/start/agencies">
            Set up a client pilot
          </Link>
        </section>
      </div>
      <section className="mt-12" aria-labelledby="recipes-heading">
        <p className="label">Features working together</p>
        <h2 id="recipes-heading" className={styles.heading}>
          Start with a complete recipe.
        </h2>
        <p className="mb-6 leading-relaxed text-white-secondary">
          Each recipe names the features and plugins, the setup and the steps, the saved result, and
          a path for adapting it. Choose an industry example close to your work.
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
      <section aria-labelledby="docs-directory" className="mt-12">
        <h2 id="docs-directory" className={styles.heading}>
          Find the guide you need.
        </h2>
        <p className="mb-6 leading-relaxed text-white-secondary">
          Use search for a specific task or browse the guides below. Feature references explain
          individual capabilities; recipes show how to combine them.
        </p>
        {docsTracks.map((track) => (
          <section key={track.id} className="my-10" aria-labelledby={`track-${track.id}`}>
            <h3 id={`track-${track.id}`} className="mb-5 font-display text-xl font-medium">
              {track.title}
            </h3>
            <div className={styles.grid}>
              {docsManifest
                .filter((section) => section.track === track.id)
                .map((section) => (
                  <Link
                    key={section.id}
                    href={`/docs/${section.id}`}
                    className="flex min-w-0 gap-3 border-t border-[var(--rule)] py-5"
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
      <aside className={styles.card}>
        <h2 className="mb-3 font-display text-xl font-medium">Something did not work?</h2>
        <p>
          Start with the symptom, check the connection or saved action result, and follow the
          recovery steps before creating another attempt.
        </p>
        <Link href="/docs/start/troubleshooting" className={styles.textLink}>
          Find the recovery guide <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </aside>
    </>
  );
}

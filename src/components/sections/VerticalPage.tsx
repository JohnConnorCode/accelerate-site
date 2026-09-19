import { distributionProfile } from "@/lib/distribution/profile";
import Link from "next/link";
import type { Vertical } from "@/lib/types";
import { IndustryRecipes } from "@/components/command-center/WorkflowRecipes";
import { BookCallButton } from "@/components/v2/studio/primitives";
import styles from "@/components/command-center/product.module.css";

export function VerticalPage({ vertical }: { vertical: Vertical }) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="wrap">
          <Link className={styles.textLink} href="/industries">
            All industries
          </Link>
          <p className="label mt-8">AI &amp; automation for {vertical.name}</p>
          <div className={styles.intro}>
            <h1 className={styles.title}>
              {vertical.heroHeadlineWhite} <em>{vertical.heroHeadlineGold}</em>
            </h1>
            <div>
              <p className={styles.lede}>{vertical.heroSubheadline}</p>
              <div className={styles.actions}>
                <BookCallButton
                  label="Discuss your workflow"
                  location={`industry_${vertical.slug}_hero`}
                />
                <Link className={styles.secondary} href="#workflow-recipes">
                  Explore the recipes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">A practical starting point</p>
              <h2 className={styles.heading}>Make the next decision easier.</h2>
            </div>
            <p className={styles.lede}>Illustrative workflow: {vertical.workflowExample}</p>
          </div>
          <div className={`${styles.grid} ${vertical.painPoints.length === 3 ? styles.steps : ""}`}>
            {vertical.painPoints.map((point, index) => (
              <article className={styles.card} key={point.title}>
                <p className="label">Step {index + 1}</p>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <IndustryRecipes industry={vertical.slug} />
      <section className={styles.section}>
        <div className="wrap">
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">Choose the right scope</p>
              <h2 className={styles.heading}>Build around the tools and people you have.</h2>
            </div>
            <p className={styles.lede}>
              We start with your business goals, map the work, and agree on one useful improvement.
              Command Center is an option when shared customer context and reviewed work would help
              your team.
            </p>
          </div>
          <div className={`${styles.grid} ${styles.steps}`}>
            <article className={styles.card}>
              <h3>Available in Command Center</h3>
              <p>
                Contacts, pipeline, forms and assigned work provide the shared foundation. Enable
                the plugins in each recipe, review the proposed action, and check its saved result.
              </p>
              <Link className={styles.textLink} href="/command-center">
                Explore platform features
              </Link>
            </article>
            <article className={styles.card}>
              <h3>Scoped for your business</h3>
              <p>{vertical.customBoundary}</p>
              <Link className={styles.textLink} href="/services">
                Custom systems and integrations
              </Link>
            </article>
            <article className={styles.card}>
              <h3>Supported after launch</h3>
              <p>
                Agree on training, operating responsibilities and ongoing support. Measure response
                time, missed follow-ups or handoff completeness against your own starting point.
              </p>
              <Link className={styles.textLink} href="/services#reporting">
                Training and optimization
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <p className="label">Before you begin</p>
          <h2 className={styles.heading}>Common questions</h2>
          <div className={styles.faq}>
            <details>
              <summary>Do we need to replace our existing software?</summary>
              <p>
                No. We review your current tools first. A focused integration, custom workflow or
                training project may be sufficient. A shared workspace is useful when your team
                needs connected context and responsibility across tools.
              </p>
            </details>
            <details>
              <summary>Does an inquiry automatically confirm a booking or order?</summary>
              <p>
                A reviewed inquiry creates a next step. Availability, professional judgment and
                customer agreement still need confirmation. The linked recipes identify the
                decisions and saved results to check.
              </p>
            </details>
            {distributionProfile() !== "neutral" && (
              <details>
                <summary>Can you support a Chicago business?</summary>
                <p>
                  Accelerate is headquartered in downtown Chicago and works with businesses across
                  Chicago and the suburbs.{" "}
                  <Link href="/chicago">See our Chicago services and headquarters.</Link>
                </p>
              </details>
            )}
          </div>
          <div className={styles.actions}>
            <BookCallButton
              label="Talk through your first project"
              location={`industry_${vertical.slug}_closing`}
            />
            <Link className={styles.secondary} href="/demo/command-center">
              Explore the fictional demos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

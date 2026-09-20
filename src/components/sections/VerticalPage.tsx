import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { distributionProfile } from "@/lib/distribution/profile";
import Link from "next/link";
import { IndustryPilot } from "./IndustryPilot";
import type { Vertical } from "@/lib/types";
import { IndustryRecipes } from "@/components/command-center/WorkflowRecipes";
import { BookCallButton } from "@/components/v2/studio/primitives";
import { AnimateOnScroll, StaggerContainer } from "@/components/ui/AnimateOnScroll";
import styles from "@/components/command-center/product.module.css";

export function VerticalPage({ vertical }: { vertical: Vertical }) {
  return (
    <div className={styles.page}>
      <PublicHeroEntrance className={styles.hero}>
        <div className="wrap">
          <Link className={styles.textLink} href="/industries" data-hero-step={1}>
            All industries
          </Link>
          <p className="label mt-8" data-hero-step={2}>
            AI &amp; automation for {vertical.name}
          </p>
          <div className={`${styles.intro} ${styles.directoryIntro}`}>
            <h1 className={styles.title} data-hero-step={3}>
              {vertical.heroHeadlineWhite} <em>{vertical.heroHeadlineGold}</em>
            </h1>
            <div>
              <p className={styles.lede} data-hero-step={4}>
                {vertical.heroSubheadline}
              </p>
              <div data-hero-step={5}>
                <div className={styles.actions}>
                  <BookCallButton
                    label="Discuss your workflow"
                    location={`industry_${vertical.slug}_hero`}
                  />
                  <Link className={styles.secondary} href="#workflow-recipes">
                    Explore the recipes
                  </Link>
                </div>
                <p className={styles.note}>
                  Bring one recent example and the tools your team uses. We will discuss where a
                  focused improvement could help.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PublicHeroEntrance>
      <section className={styles.section}>
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro} stagger>
            <div>
              <p className="label">A workflow to start with</p>
              <h2 className={styles.heading}>See what changes in the day-to-day work.</h2>
            </div>
            <p className={styles.lede}>Illustrative workflow: {vertical.workflowExample}</p>
          </AnimateOnScroll>
          <StaggerContainer
            className={`${styles.grid} ${vertical.painPoints.length === 3 ? styles.steps : ""}`}
            staggerDelay={0.1}
          >
            {vertical.painPoints.map((point, index) => (
              <article className={styles.card} key={point.title}>
                <p className="label">
                  {vertical.painPoints.length === 3 ? "Step" : "Workflow"} {index + 1}
                </p>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </StaggerContainer>
        </div>
      </section>
      <IndustryPilot pilot={vertical.pilot} />
      <IndustryRecipes industry={vertical.slug} />
      <section className={styles.section}>
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro} stagger>
            <div>
              <p className="label">Choose the right scope</p>
              <h2 className={styles.heading}>Build around the tools and people you have.</h2>
            </div>
            <p className={styles.lede}>
              We start with your business goals, map the work, and agree on one useful improvement.
              Command Center is an option when shared customer context and reviewed work would help
              your team.
            </p>
          </AnimateOnScroll>
          <StaggerContainer className={`${styles.grid} ${styles.steps}`} staggerDelay={0.1}>
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
          </StaggerContainer>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <AnimateOnScroll className={styles.sectionIntro} stagger>
            <div>
              <p className="label">Before you begin</p>
              <h2 className={styles.heading}>Common questions</h2>
            </div>
          </AnimateOnScroll>
          <StaggerContainer className={styles.faq} staggerDelay={0.08}>
            <details>
              <summary>Do we need to replace our existing software?</summary>
              <p>
                No. We review your current tools first. A focused integration, custom workflow or
                training project may be sufficient. A shared workspace is useful when your team
                needs connected context and responsibility across tools.
              </p>
            </details>
            <details>
              <summary>What affects the scope and cost?</summary>
              <p>
                The work depends on the systems involved, the quality of the source information, who
                can approve changes and the support your team needs. We agree on those details and a
                useful first deliverable before setting the implementation scope.
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
          </StaggerContainer>
          <AnimateOnScroll className={styles.actions} delay={0.2}>
            <BookCallButton
              label="Talk through your first project"
              location={`industry_${vertical.slug}_closing`}
            />
            <Link className={styles.secondary} href="/demo/command-center">
              Explore the fictional demos
            </Link>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  );
}

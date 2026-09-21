import type { Vertical } from "@/lib/types";
import { AnimateOnScroll } from "@/components/ui/AnimateOnScroll";
import styles from "@/components/command-center/product.module.css";

export function IndustryPilot({ pilot }: { pilot: Vertical["pilot"] }) {
  if (!pilot) return null;
  return (
    <section className={styles.section} aria-labelledby="pilot-title">
      <div className="wrap">
        <AnimateOnScroll className={styles.sectionIntro} stagger>
          <div>
            <p className="label">Make the first project measurable</p>
            <h2 id="pilot-title" className={styles.heading}>
              Decide what better looks like.
            </h2>
          </div>
          <p className={styles.lede}>
            Pick one workflow, one responsible person and a review date. Record how it works today,
            then try the agreed change on a small set of real work before expanding it.
          </p>
        </AnimateOnScroll>
        <dl className={styles.outcomes}>
          <AnimateOnScroll as="div" delay={0.08}>
            <dt>Measure the starting point</dt>
            <dd>{pilot.measure}</dd>
          </AnimateOnScroll>
          <AnimateOnScroll as="div" delay={0.16}>
            <dt>Check the handoff</dt>
            <dd>{pilot.readyWhen}</dd>
          </AnimateOnScroll>
        </dl>
        <AnimateOnScroll className={styles.note} delay={0.24}>
          These are suggested evaluation criteria. Your baseline and pilot determine the result.
        </AnimateOnScroll>
      </div>
    </section>
  );
}

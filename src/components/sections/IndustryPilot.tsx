import type { Vertical } from "@/lib/types";
import styles from "@/components/command-center/product.module.css";

export function IndustryPilot({ pilot }: { pilot: Vertical["pilot"] }) {
  if (!pilot) return null;
  return (
    <section className={styles.section} aria-labelledby="pilot-title">
      <div className="wrap">
        <div className={styles.sectionIntro}>
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
        </div>
        <dl className={styles.outcomes}>
          <div>
            <dt>Measure the starting point</dt>
            <dd>{pilot.measure}</dd>
          </div>
          <div>
            <dt>Check the handoff</dt>
            <dd>{pilot.readyWhen}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          These are suggested evaluation criteria. Your baseline and pilot determine the result.
        </p>
      </div>
    </section>
  );
}

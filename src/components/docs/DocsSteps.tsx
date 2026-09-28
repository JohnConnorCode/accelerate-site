import type { ReactNode } from "react";
import styles from "./docs.module.css";

export function DocsSteps({ children }: { children: ReactNode }) {
  return <ol className={styles.steps}>{children}</ol>;
}

export function DocsStep({
  title,
  children,
}: {
  number?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={styles.step}>
      <h3>{title}</h3>
      <div className={styles.stepBody}>{children}</div>
    </li>
  );
}

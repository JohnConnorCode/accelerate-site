import Link from "next/link";
import styles from "./product.module.css";

export const clientLifecycleSteps = [
  {
    title: "Capture the inquiry",
    detail: "Keep the request and customer together.",
    route: "contacts",
  },
  {
    title: "Win the work",
    detail: "Give the opportunity an owner, next step and proposal.",
    route: "pipeline",
  },
  {
    title: "Start delivery",
    detail: "Turn the agreement into an assigned kickoff checklist.",
    route: "client-onboarding",
  },
  {
    title: "Prepare the invoice",
    detail: "Review the customer, line items and billing terms.",
    route: "invoicing",
  },
  {
    title: "Follow up on payment",
    detail: "Use the invoice balance, promises and customer history.",
    route: "collections",
  },
] as const;

export function ClientLifecycle({ demo = false }: { demo?: boolean }) {
  return (
    <ol className={styles.lifecycle} aria-label="Connected customer workflow">
      {clientLifecycleSteps.map((step, index) => (
        <li key={step.route}>
          <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
          <Link
            href={`/demo/command-center/northline-roofing/${step.route}${demo ? "?workflow=client" : ""}`}
          >
            {demo ? "Open this step" : "Explore this part"}{" "}
            <span className="sr-only">{step.title.toLowerCase()}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

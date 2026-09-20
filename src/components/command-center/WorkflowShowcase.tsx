"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { demoWorkflows } from "@/content/demo-workflows";
import { distributionProfile } from "@/lib/distribution/profile";
import styles from "./product.module.css";

export function WorkflowShowcase() {
  const [selected, setSelected] = useState(demoWorkflows[0]!.id);
  const workflow = demoWorkflows.find((item) => item.id === selected)!;
  const href = `/demo/command-center/${workflow.scenario}/${workflow.steps[0]!.route}`;
  return (
    <div className={styles.showcase}>
      <div className={styles.filters} role="group" aria-label="Choose a workflow">
        {demoWorkflows.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            aria-controls="workflow-example"
            onClick={() => setSelected(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="workflow-example" className={styles.workflow}>
        <div>
          <p className="label">Fictional example · {workflow.business}</p>
          <h3 className={styles.heading}>{workflow.title}</h3>
          <p className={styles.lede}>{workflow.problem}</p>
          <ol>
            {workflow.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p>{step.instruction}</p>
              </li>
            ))}
          </ol>
          <Link className={styles.primary} href={href}>
            Try this workflow <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div>
          {distributionProfile() === "branded" && (
            <figure className={styles.figure}>
              <a
                href={workflow.image}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enlarge ${workflow.business} workflow screenshot`}
              >
                <Image
                  src={workflow.image}
                  alt={`${workflow.business}: ${workflow.result}`}
                  width={1440}
                  height={1000}
                  sizes="(max-width: 760px) 100vw, 650px"
                />
              </a>
              <figcaption className={styles.note}>
                Real interface. Fictional records and simulated actions.
              </figcaption>
            </figure>
          )}
          <div className={styles.result}>
            <p className="label">The result to check</p>
            <p>{workflow.result}</p>
            <Link className={styles.textLink} href={`/docs/recipes/${workflow.recipe}`}>
              Use the setup recipe <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

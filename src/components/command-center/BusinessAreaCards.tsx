import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { businessAreas } from "@/content/command-center-business";
import styles from "./product.module.css";

export function BusinessAreaCards() {
  return (
    <div className={styles.areaGrid}>
      {businessAreas.map((area) => (
        <Link
          key={area.id}
          href={`/command-center/features/${area.id}`}
          className={styles.areaCard}
        >
          <h3>{area.title}</h3>
          <p>{area.description}</p>
          <span>{area.outcome}</span>
          <strong>
            Explore {area.title.toLowerCase()} <ArrowRight size={16} aria-hidden="true" />
          </strong>
        </Link>
      ))}
    </div>
  );
}

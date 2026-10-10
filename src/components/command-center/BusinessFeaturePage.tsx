import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { BusinessArea } from "@/content/command-center-business";
import { capabilities } from "@/content/command-center";
import { distributionProfile } from "@/lib/distribution/profile";
import { docsFigureSource } from "@/lib/docs";
import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import styles from "./product.module.css";

export function BusinessFeaturePage({ area }: { area: BusinessArea }) {
  const showImage = distributionProfile() === "branded";
  const imageSrc = showImage ? docsFigureSource(`/images/docs/${area.image}.png`) : "";
  return (
    <div className={styles.page}>
      <PublicHeroEntrance className={styles.hero}>
        <div className="wrap">
          <Link href="/command-center/features" className={styles.textLink}>
            All Command Center features
          </Link>
          <p className="label mt-8">{area.title}</p>
          <h1 className={styles.title} data-hero-step={1}>
            {area.headline}
          </h1>
          <p className={`${styles.lede} mt-6`} data-hero-step={2}>
            {area.description}
          </p>
          <p className={styles.value}>{area.outcome}</p>
          <div className={styles.actions} data-hero-step={3}>
            <Link href={area.demoHref} className={styles.primary}>
              Try it in the demo <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href={area.guideHref} className={styles.secondary}>
              Read the practical guide
            </Link>
          </div>
          {showImage && (
            <figure className={styles.figure}>
              <a
                href={imageSrc}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enlarge ${area.title} screenshot`}
              >
                <Image
                  loading="eager"
                  src={imageSrc}
                  width={1440}
                  height={1000}
                  sizes="(max-width: 760px) 100vw, 1100px"
                  alt={area.imageAlt}
                />
              </a>
              <figcaption className={styles.note}>
                The actual interface with fictional demo records. Select to enlarge.
              </figcaption>
            </figure>
          )}
        </div>
      </PublicHeroEntrance>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>What you can do</h2>
          <div className={styles.areaGrid}>
            {area.tasks.map((task) => (
              <article key={task.title} className={styles.card}>
                <h3>{task.title}</h3>
                <p>{task.detail}</p>
                <Link href={task.href} className={styles.textLink}>
                  Follow the steps <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <p className="label">Worked example</p>
          <h2 className={styles.heading}>{area.example.title}</h2>
          <div className={styles.workflow}>
            <ol>
              {area.example.steps.map((step) => (
                <li key={step}>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
            <div className={styles.result}>
              <h3>What the team gets</h3>
              <p>{area.example.result}</p>
            </div>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className={`wrap ${styles.grid}`}>
          <article className={styles.card}>
            <h2 className={styles.heading}>Start with the right setup</h2>
            <p>{area.setup}</p>
            <Link href="/docs/workspace/setup" className={styles.textLink}>
              Workspace setup
            </Link>
          </article>
          <article className={styles.card}>
            <h2 className={styles.heading}>Adapt it to your business</h2>
            <p>{area.builder}</p>
            <Link href="/docs/extend/ai-authoring" className={styles.textLink}>
              Build with a coding agent <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>Related capabilities</h2>
          <div className={styles.grid}>
            {capabilities
              .filter((item) => item.businessArea === area.id)
              .map((item) => (
                <details key={item.id} className={styles.referenceItem}>
                  <summary>{item.title}</summary>
                  <p>
                    {item.promise} {item.detail}
                  </p>
                </details>
              ))}
          </div>
          <Link href="/command-center/features" className={styles.textLink}>
            Explore the rest of the platform
          </Link>
        </div>
      </section>
    </div>
  );
}

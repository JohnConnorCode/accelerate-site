import Link from "next/link";
import {
  commandCenterComparisons,
  comparisonReviewedAt,
} from "@/content/command-center-comparisons";
import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { seoMetadata } from "@/lib/og";
import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import styles from "@/components/command-center/product.module.css";

const metadata = seoMetadata({
  title: "Compare Command Center and alternatives",
  description:
    "Choose between Command Center, CRM platforms, business suites and app builders based on the workflows, ownership and implementation your business needs.",
  path: "/command-center/compare",
});
export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/command-center/compare")) ?? metadata;
}
export default async function ComparePage() {
  const published = await publishedWebsiteOverride("/command-center/compare");
  if (published) return published;
  return (
    <div className={styles.page}>
      <PublicHeroEntrance className={styles.hero}>
        <div className="wrap">
          <Link href="/command-center" className={styles.textLink}>
            Command Center
          </Link>
          <p className="label mt-8">Choose the right foundation</p>
          <h1 className={styles.title} data-hero-step={1}>
            Match the platform to the work you need.
          </h1>
          <p className={styles.lede} data-hero-step={2}>
            Start with a complete business workflow, the systems it needs to reach and who will
            operate it. A CRM, an ERP, an automation builder and a custom business platform solve
            overlapping needs with different starting points.
          </p>
          <p className={styles.note}>
            Reviewed {comparisonReviewedAt}. Competitor descriptions come from their official pages.
            Recommendations are our assessment of fit; evaluate current capabilities in your own
            trial.
          </p>
        </div>
      </PublicHeroEntrance>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>Where Command Center fits</h2>
          <p className={styles.lede}>
            Choose it when you want connected customer operations and the ability to adapt the
            application: contacts, sales, delivery, billing and marketing provide a base for your
            own workflows and Apps. The MIT-licensed source lets your team control the deployment
            and implementation.
          </p>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3>Start with working business capabilities</h3>
              <p>
                Combine core records with optional Apps and configured providers. Verify one useful
                workflow, then extend it around your process.
              </p>
              <Link href="/command-center/features" className={styles.textLink}>
                Explore current capabilities
              </Link>
            </article>
            <article className={styles.card}>
              <h3>Plan who will build and operate it</h3>
              <p>
                Self-hosting needs technical ownership of setup, updates, providers and recovery.
                Accelerate can implement and operate an agreed solution. Hosting and provider usage
                remain part of the scope.
              </p>
              <Link href="/docs/self-hosting" className={styles.textLink}>
                Understand implementation requirements
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>Consider the alternatives by their strengths.</h2>
          <div className={styles.grid}>
            {commandCenterComparisons.map((item) => (
              <article key={item.name} className={styles.card}>
                <p className="label">{item.category}</p>
                <h3>{item.name}</h3>
                <p>{item.strength}</p>
                <p className="mt-4">{item.choose}</p>
                <p className="mt-4">{item.fit}</p>
                {item.sources.map((source) => (
                  <a
                    key={source.href}
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.textLink}
                  >
                    {source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>Test the job that matters to your team.</h2>
          <p className={styles.lede}>
            Use the same example with each candidate: capture an inquiry, assign its next step, hand
            over won work and prepare billing. Inspect the saved records, connection requirements
            and effort needed to adapt it. For builders, also implement one useful change and review
            the extension path.
          </p>
          <div className={styles.actions}>
            <Link
              href="/demo/command-center/northline-roofing/today?workflow=client"
              className={styles.primary}
            >
              Try the client lifecycle
            </Link>
            <Link href="/docs/extend/first-change" className={styles.secondary}>
              Adapt the follow-up report
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

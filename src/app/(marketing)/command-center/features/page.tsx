import Link from "next/link";
import { seoMetadata } from "@/lib/og";
import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { BusinessAreaCards } from "@/components/command-center/BusinessAreaCards";
import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import styles from "@/components/command-center/product.module.css";

const metadata = seoMetadata({
  title: "Command Center features",
  description:
    "Customers, sales, delivery, billing, marketing and custom Apps. Explore what Command Center does, the business work it supports and how to adapt it.",
  path: "/command-center/features",
});
export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/command-center/features")) ?? metadata;
}
export default async function FeaturesPage() {
  const published = await publishedWebsiteOverride("/command-center/features");
  if (published) return published;
  return (
    <div className={styles.page}>
      <PublicHeroEntrance className={styles.hero}>
        <div className="wrap">
          <Link href="/command-center" className={styles.textLink}>
            Command Center
          </Link>
          <p className="label mt-8">Features</p>
          <h1 className={styles.title} data-hero-step={1}>
            Customer work, connected across the business.
          </h1>
          <p className={`${styles.lede} mt-6`} data-hero-step={2}>
            Start with the work your team needs to do. Each area combines useful capabilities, a
            practical example and a path to adapt the platform.
          </p>
        </div>
      </PublicHeroEntrance>
      <section className={styles.section}>
        <div className="wrap">
          <BusinessAreaCards />
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <h2 className={styles.heading}>Use the same foundation across the workflow.</h2>
          <p className={styles.lede}>
            A customer can have conversations, opportunities, proposals, delivery tasks and billing
            records. The shared identity and services let people, AI and custom Apps work with those
            records instead of maintaining separate copies.
          </p>
          <div className={styles.actions}>
            <Link href="/demo/command-center#workflows" className={styles.primary}>
              Try a connected workflow
            </Link>
            <Link href="/command-center/compare" className={styles.secondary}>
              Compare your options
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

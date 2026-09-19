import Link from "next/link";
import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { verticals } from "@/content/verticals";
import { workflowRecipes } from "@/content/workflow-recipes";
import { BookCallButton } from "@/components/v2/studio/primitives";
import styles from "@/components/command-center/product.module.css";

const bundledMetadata = seoMetadata({ title: "AI & Business Automation by Industry", description: "Explore practical AI and automation workflows for small businesses, with industry-specific recipes, reviewed decisions and clear implementation boundaries.", path: "/industries" });
const groups = [...new Set(verticals.map(vertical => vertical.group))];
export default async function IndustriesPage() {
  const published = await publishedWebsiteOverride("/industries");
  if (published) return published;
  return <div className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbJsonLd([{ name: "Home", url: "/" }, { name: "Industries", url: "/industries" }])) }} />
    <section className={styles.hero}><div className="wrap"><p className="label">{verticals.length} industries · {workflowRecipes.length} practical recipes</p><div className={styles.intro}><h1 className={styles.title}>Start with the work <em>your business does.</em></h1><div><p className={styles.lede}>Find a workflow your team recognizes. We help choose the right AI project, build and connect the tools, and support the people doing the work.</p><div className={styles.actions}><BookCallButton label="Discuss your business" location="industries_hero" /><Link className={styles.secondary} href="/docs/recipes">Browse the recipes</Link></div></div></div>
      <nav aria-label="Industry categories" className={styles.actions}>{groups.map((group, index) => <a className={styles.secondary} key={group} href={`#industry-group-${index}`}>{group}</a>)}</nav>
    </div></section>
    {groups.map((group, index) => <section id={`industry-group-${index}`} key={group} className={styles.section}><div className="wrap"><h2 className={styles.heading}>{group}</h2><div className={styles.grid}>{verticals.filter(vertical => vertical.group === group).map(vertical => <article className={styles.card} key={vertical.slug}><h3><Link href={`/industries/${vertical.slug}`}>{vertical.name}</Link></h3><p>{vertical.heroHeadlineWhite} {vertical.heroHeadlineGold}</p><Link className={styles.textLink} href={`/industries/${vertical.slug}`}>Explore {vertical.name.toLowerCase()} workflows</Link></article>)}</div></div></section>)}
    <section className={styles.section}><div className="wrap"><h2 className={styles.heading}>Your workflow can be different.</h2><p className={styles.lede}>These examples show possible starting points. We can scope a focused integration, custom tool, training or managed execution around your business. Command Center is available when a shared workspace helps.</p><div className={styles.actions}><BookCallButton label="Talk through your workflow" location="industries_closing" /><Link className={styles.secondary} href="/chicago">Based in Chicago, serving small businesses</Link></div></div></section>
  </div>;
}
export async function generateMetadata() { return (await publishedWebsiteMetadata("/industries")) ?? bundledMetadata; }

import Link from "next/link";
import { publishedWebsiteOverride, publishedWebsiteMetadata } from "@/lib/site-studio/website-page";
import { seoMetadata } from "@/lib/og";
import { generateBreadcrumbJsonLd } from "@/lib/seo";
import { tenant } from "@/config/tenant";
import { verticals } from "@/content/verticals";
import { workflowRecipes } from "@/content/workflow-recipes";
import { ChicagoHeadquarters } from "@/components/sections/ChicagoHeadquarters";
import { BookCallButton } from "@/components/v2/studio/primitives";
import { PageEngagementTracker } from "@/components/layout/PageEngagementTracker";
import styles from "@/components/command-center/product.module.css";

const description = "Chicago AI consulting and business automation for small businesses. Strategy, custom integrations, managed execution and training, based at Ferris in downtown Chicago.";
const bundledMetadata = seoMetadata({ title: "Chicago AI Consulting & Small Business Automation", description, path: "/chicago" });
const projects = [
  { title: "Catering inquiries", text: "Capture guest count, delivery needs and dietary requirements, then give the quote review an owner.", slug: "restaurants-catering" },
  { title: "Property engagements", text: "Keep owner inquiries and property context together, then assign the agreed onboarding work.", slug: "property-management" },
  { title: "Professional follow-up", text: "Prepare for client conversations and make agreed commitments visible to the people responsible.", slug: "professional-services" },
  { title: "Recurring field work", text: "Review cleaning scope and site access before handing a recurring engagement to operations.", slug: "cleaning-companies" },
];

export default async function ChicagoPage() {
  const published = await publishedWebsiteOverride("/chicago");
  if (published) return published;
  const schema = {
    "@context": "https://schema.org", "@type": "Service",
    name: "Chicago AI consulting and business automation", description,
    url: `${tenant.brand.siteUrl.replace(/\/$/, "")}/chicago`,
    provider: { "@id": `${tenant.brand.siteUrl.replace(/\/$/, "")}/#organization` },
    areaServed: [{ "@type": "City", name: "Chicago" }, "Chicago suburbs"],
    serviceType: ["AI consulting", "Business automation", "Custom integrations", "AI training"],
  };
  return <div className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateBreadcrumbJsonLd([{ name: "Home", url: "/" }, { name: "Chicago", url: "/chicago" }])) }} />
    <section className={styles.hero}><div className="wrap">
      <p className="label">Chicago &amp; the suburbs</p>
      <div className={styles.intro}><h1 className={styles.title}>AI that helps your business <em>get the work done.</em></h1><div>
        <p className={styles.lede}>AI consulting and business automation for Chicago small businesses. We help you choose the right project, build around your existing tools, and support the team using it.</p>
        <div className={styles.actions}><BookCallButton label="Discuss your Chicago business" location="chicago_hero" /><Link className={styles.secondary} href="#projects">Explore practical projects</Link></div>
        <p className={styles.note}>Headquartered at Ferris, 1 W Monroe Street, in downtown Chicago.</p>
      </div></div>
    </div></section>
    <section className={styles.section}><div className="wrap">
      <div className={styles.sectionIntro}><div><p className="label">Start with the operation</p><h2 className={styles.heading}>Give people time back. Make follow-through easier.</h2></div><p className={styles.lede}>Bring us one process that takes too much attention: reviewing requests, chasing missing details, preparing customer work or keeping commitments visible. We map what happens today and agree on a useful first improvement.</p></div>
      <div className={styles.grid}>{[
        ["Strategy & consulting", "Identify a specific business problem, the information it needs and how to measure an improvement."],
        ["Custom systems & integrations", "Build a workflow, AI agent, internal tool or connection that fits the systems you already rely on."],
        ["Managed execution", "Agree on the sales, service, content or administrative work we will operate with your team."],
        ["Training & improvement", "Document responsibilities, teach the workflow and review performance against your starting point."],
      ].map(([title, text]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{text}</p></article>)}</div>
      <Link className={styles.textLink} href="/services">Explore the services</Link>
    </div></section>
    <section id="projects" className={styles.section}><div className="wrap">
      <div className={styles.sectionIntro}><div><p className="label">Useful first projects</p><h2 className={styles.heading}>Choose a workflow your team recognizes.</h2></div><p className={styles.lede}>These are illustrative starting points. Each industry guide explains the decisions, setup and result to check, including the integrations that need separate development.</p></div>
      <div className={styles.grid}>{projects.map(project => <article key={project.slug} className={styles.card}><h3>{project.title}</h3><p>{project.text}</p><Link className={styles.textLink} href={`/industries/${project.slug}`}>Explore the workflow</Link></article>)}</div>
      <div className={styles.actions}><Link className={styles.secondary} href="/industries">Explore {verticals.length} industries</Link><Link className={styles.secondary} href="/docs/recipes">Browse {workflowRecipes.length} workflow recipes</Link></div>
    </div></section>
    <section className={styles.section}><div className="wrap">
      <div className={styles.sectionIntro}><div><p className="label">When a shared workspace helps</p><h2 className={styles.heading}>Connect the context behind the work.</h2></div><p className={styles.lede}>Command Center brings contacts, pipeline, tasks and reviewed plugin actions together. It is one option for your business. A focused workflow or training project may be the better first step.</p></div>
      <div className={styles.actions}><Link className={styles.primary} href="/command-center">Explore Command Center</Link><Link className={styles.secondary} href="/demo/command-center">Try six fictional business demos</Link></div>
    </div></section>
    <section className={styles.section}><div className="wrap">
      <h2 className={styles.heading}>Planning your first project</h2><div className={styles.faq}>
        <details><summary>Do you work with businesses outside downtown?</summary><p>Yes. We work with small businesses across Chicago and the suburbs. Tell us where your team operates and what the work requires so we can agree on a practical delivery arrangement.</p></details>
        <details><summary>What should we bring to the first conversation?</summary><p>A recent example of the process, the tools involved, the person responsible and what happens when it goes wrong. Remove sensitive customer information from examples shared before access is agreed.</p></details>
        <details><summary>How do you scope cost and success?</summary><p>We agree on the workflow, integrations, permissions, implementation and ongoing responsibilities before setting scope. Establish a starting measure such as response time or incomplete handoffs, then compare actual results after a pilot.</p></details>
        <details><summary>Will AI act without our review?</summary><p>Decisions and permissions depend on the workflow. The platform recipes preserve the approval required by each action policy. Custom work needs explicit boundaries, failure handling and a way to verify completion.</p></details>
      </div>
      <div className={styles.actions}><BookCallButton label="Plan your first improvement" location="chicago_closing" /><Link className={styles.textLink} href="/learn/chicago-small-businesses-ai-2026">Read the Chicago small-business AI guide</Link></div>
    </div></section>
    <ChicagoHeadquarters /><PageEngagementTracker />
  </div>;
}
export async function generateMetadata() {
  return (await publishedWebsiteMetadata("/chicago")) ?? bundledMetadata;
}

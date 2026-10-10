import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { CapabilityCatalog } from "@/components/command-center/CapabilityCatalog";
import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { BusinessAreaCards } from "@/components/command-center/BusinessAreaCards";
import { ClientLifecycle } from "@/components/command-center/ClientLifecycle";
import { WorkflowShowcase } from "@/components/command-center/WorkflowShowcase";
import { RecipeCards } from "@/components/command-center/WorkflowRecipes";
import { ProductSlider } from "@/components/media/ProductSlider";
import { PRODUCT_SCREENSHOTS } from "@/content/product-screenshots";
import { commandCenterPositioning } from "@/content/command-center-business";
import { workflowRecipes } from "@/content/workflow-recipes";
import { productFaqs } from "@/content/command-center-faq";
import styles from "@/components/command-center/product.module.css";

export function CommandCenterPageContent() {
  return (
    <div className={styles.page}>
      <PublicHeroEntrance className={styles.hero} id="top">
        <div className="wrap">
          <p className="label">Command Center · {commandCenterPositioning.category}</p>
          <div className={styles.intro}>
            <h1 className={styles.title} data-hero-step={1}>
              Run your business.
              <br />
              <em>Build what it needs.</em>
            </h1>
            <div>
              <p className={styles.lede} data-hero-step={2}>
                {commandCenterPositioning.description}
              </p>
              <div className={styles.audienceActions} data-hero-step={3}>
                <Link
                  href="/demo/command-center/northline-roofing/today?workflow=client"
                  className={styles.secondary}
                >
                  Run a business workflow <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/open-source" className={styles.secondary}>
                  Build on the platform <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <p className={styles.note}>
                Explore fictional records without an account. Self-host the MIT-licensed source, or
                have Accelerate implement it with your team.
              </p>
            </div>
          </div>
          <div className={styles.figure} id="demo">
            <ProductSlider slides={PRODUCT_SCREENSHOTS} groupLabel="Command Center screens" />
            <p className={styles.note}>
              The actual interface with fictional business data. Enlarge a screen to inspect it.
            </p>
            <Link href="/demo/command-center" className={styles.textLink}>
              Explore all six demo businesses <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </PublicHeroEntrance>
      <section className={styles.section} id="how">
        <div className="wrap">
          <p className="label">One connected client lifecycle</p>
          <h2 className={styles.heading}>From the first inquiry to delivery and billing.</h2>
          <p className={styles.lede}>
            A roofing customer asks for an inspection. The office qualifies the request, prepares
            the offer, hands the won job to the crew and invoices the customer. Command Center keeps
            the records and next steps available across that work.
          </p>
          <ClientLifecycle />
          <p className={styles.note}>
            People and configured workflows perform these steps. The demo simulates business
            effects; each connection has its own setup.
          </p>
          <Link href="/docs/recipes/customer-kickoff" className={styles.textLink}>
            See a practical handoff recipe <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className={styles.section} id="surface">
        <div className="wrap">
          <p className="label">Business capabilities</p>
          <h2 className={styles.heading}>Find the tools for the work your team does.</h2>
          <BusinessAreaCards />
        </div>
      </section>
      <section className={styles.section} id="built">
        <div className="wrap">
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">A foundation for your own Apps</p>
              <h2 className={styles.heading}>
                Build the process that makes your business different.
              </h2>
            </div>
            <p className={styles.lede}>
              A coding agent can add a report, workflow or dedicated App using the customer records
              and business services already here. Your team defines the job; the extension supplies
              the fields, rules and interface it needs.
            </p>
          </div>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3>Reuse the common business infrastructure</h3>
              <p>
                Customer identity, workspace access, conversations, tasks, AI tools and action
                history give each new App a useful starting point. People and connected assistants
                use the same supported services.
              </p>
              <Link href="/docs/extend/apps" className={styles.textLink}>
                Understand App design
              </Link>
            </article>
            <article className={styles.card}>
              <h3>Make a useful first change</h3>
              <p>
                Adapt Pipeline follow-up to flag opportunities after three quiet days. Run the
                report against fixed fictional records and see the difference before connecting
                customer data.
              </p>
              <Link href="/docs/extend/first-change" className={styles.textLink}>
                Build your first adaptation <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
          <p className={styles.note}>
            Custom Apps use the source repository and an external coding agent today.
            General-purpose App creation inside Command Center remains planned.
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <div className="wrap">
          <p className="label">AI in the business workflow</p>
          <h2 className={styles.heading}>
            Give the assistant a useful job and the context to do it.
          </h2>
          <p className={styles.lede}>
            Ask about a customer, prepare a reply and follow-up task, turn a won engagement into
            onboarding work, or investigate an outstanding invoice. AI uses the available records
            and registered business operations. Exact proposals, source links and results remain
            accessible where the work happens.
          </p>
          <WorkflowShowcase />
          <Link href="/docs/intelligence/workspace" className={styles.textLink}>
            Learn how to work with AI
          </Link>
        </div>
      </section>
      <section className={styles.section} id="recipes">
        <div className="wrap">
          <p className="label">Adapt to your industry</p>
          <h2 className={styles.heading}>Start with a workflow close to your own.</h2>
          <RecipeCards
            recipes={workflowRecipes.filter((recipe) =>
              ["roofing-inquiry", "engagement-onboarding", "invoice-follow-up"].includes(recipe.id),
            )}
          />
          <Link href="/docs/recipes" className={styles.textLink}>
            Browse the workflow recipes
          </Link>
        </div>
      </section>
      <section className={styles.section} id="capabilities">
        <div className="wrap">
          <h2 className={styles.heading}>Find a specific capability.</h2>
          <details className={styles.referenceItem}>
            <summary>Open the searchable reference</summary>
            <CapabilityCatalog />
          </details>
        </div>
      </section>
      <section className={styles.section} id="who">
        <div className="wrap">
          <h2 className={styles.heading}>Choose your starting path.</h2>
          <div className={styles.grid}>
            <article className={styles.card}>
              <p className="label">For business teams</p>
              <h3>Run an operation your team can follow.</h3>
              <p>
                Start with a useful workflow and the connections it needs. Accelerate can configure,
                extend and implement the platform, train your team and support the agreed operation.
              </p>
              <p>Scope, costs, responsibilities and handoff are agreed before implementation.</p>
              <Link href="/docs/start/business-owners" className={styles.textLink}>
                Plan your first workflow
              </Link>
              <Link href="/contact" className={styles.textLink}>
                Discuss an implementation <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className={styles.card}>
              <p className="label">For builders and agencies</p>
              <h3>Build business software from a working base.</h3>
              <p>
                Run the source, adapt existing capabilities and create client Apps using shared
                records and services. You control your deployment and can keep building around the
                business.
              </p>
              <p>Start locally with fictional data, then connect a workspace you control.</p>
              <Link href="/docs/extend/first-change" className={styles.textLink}>
                Make your first useful change
              </Link>
              <Link href="/open-source" className={styles.textLink}>
                Explore the open-source foundation <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
          <Link href="/command-center/compare" className={styles.textLink}>
            When to choose Command Center, and when another product fits
          </Link>
        </div>
      </section>
      <section className={styles.section} id="faq">
        <div className="wrap">
          <h2 className={styles.heading}>Questions about the platform.</h2>
          {productFaqs.map((faq) => (
            <details className={styles.faq} key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <CommandCenterNav />
    </div>
  );
}

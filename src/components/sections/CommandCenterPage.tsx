import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { CapabilityCatalog } from "@/components/command-center/CapabilityCatalog";
import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { RecipeCards } from "@/components/command-center/WorkflowRecipes";
import { ProductSlider } from "@/components/media/ProductSlider";
import { PRODUCT_SCREENSHOTS } from "@/content/product-screenshots";
import { workflowRecipes } from "@/content/workflow-recipes";
import { productFaqs } from "@/content/command-center-faq";
import { WorkflowShowcase } from "@/components/command-center/WorkflowShowcase";
import { workProjects } from "@/content/work";
import styles from "@/components/command-center/product.module.css";

const jobs = [
  {
    title: "Know the customer before you reply",
    text: "Bring contacts, conversations and notes into shared context. Your team can pick up a relationship with the history in front of them, and AI can use the available records to prepare a useful response.",
    parts: ["Contacts", "Conversations", "AI workspace"],
    image: "conversations/overview",
    href: "/docs/conversations",
    action: "Connect the customer conversation",
  },
  {
    title: "Give every opportunity a next step",
    text: "Keep the owner, stage and next action visible. Combine Pipeline with the Pipeline follow-up plugin to find quiet opportunities, then inspect the customer context and decide how to follow up.",
    parts: ["Pipeline", "Pipeline follow-up", "Proposals"],
    image: "pipeline/overview",
    href: "/docs/recipes/roofing-inquiry",
    action: "Follow an inquiry through the workflow",
  },
  {
    title: "Carry commitments into delivery",
    text: "Turn won work or an agreed meeting checklist into assigned tasks. The source stays attached, so the person doing the work can see why it exists and the team can check its progress.",
    parts: ["Client onboarding", "Meeting commitments", "Work"],
    image: "plugins/client-onboarding",
    href: "/docs/recipes/engagement-onboarding",
    action: "Build a client kickoff checklist",
  },
  {
    title: "Follow the money with the evidence",
    text: "Review revenue records, prepare invoices through Stripe and manage collection decisions against invoice evidence. Keep a payment promise, an invoice and a collected payment distinct so you know what to do next.",
    parts: ["Revenue", "Stripe invoicing", "Receivables Collections"],
    image: "plugins/collections",
    href: "/docs/recipes/invoice-follow-up",
    action: "Review an outstanding invoice",
  },
];

export function CommandCenterPageContent() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} id="top">
        <div className="wrap">
          <div className={styles.intro}>
            <div>
              <p className="label">Command Center · Open-source business platform</p>
              <h1 className={styles.title}>
                Your customer work.
                <br />
                <em>Connected.</em>
              </h1>
            </div>
            <div>
              <p className={styles.lede}>
                Keep customer conversations, follow-up and delivery in one workspace your team and
                AI can use. Adapt the open-source platform to your process, with Accelerate’s help
                or your own builders.
              </p>
              <div className={styles.actions}>
                <Link href="/demo/command-center#workflows" className={styles.primary}>
                  Try a business workflow <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/docs/extend" className={styles.secondary}>
                  Build on the platform <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <p className={styles.note}>
                Try fictional business data without an account. Own the source and build around the
                way your team works.
              </p>
            </div>
          </div>
          <div className={styles.figure} id="demo">
            <ProductSlider slides={PRODUCT_SCREENSHOTS} groupLabel="Command Center screens" />
            <p className={styles.note}>
              The real interface with fictional business data. Enlarge a screen to inspect it, or
              choose a business in the demo.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} id="how">
        <div className="wrap">
          <p className="label">See a complete piece of work</p>
          <h2 className={styles.heading}>Start with a result your team needs.</h2>
          <WorkflowShowcase />
        </div>
      </section>

      <section className={styles.section} id="surface">
        <div className="wrap">
          <p className="label">Features with a job to do</p>
          <h2 className={styles.heading}>Keep the context. Move the work forward.</h2>
          <div className={styles.featureGrid}>
            {jobs.map((job, index) => (
              <article key={job.title} className={styles.feature}>
                <div>
                  <p className="label">0{index + 1}</p>
                  <h3>{job.title}</h3>
                  <p>{job.text}</p>
                  <ul className={styles.parts}>
                    {job.parts.map((part) => (
                      <li key={part}>{part}</li>
                    ))}
                  </ul>
                  <Link href={job.href} className={styles.textLink}>
                    {job.action} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
                <figure className={styles.figure}>
                  <a
                    href={`/images/docs/${job.image}.png`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open full-size screenshot: ${job.title}`}
                  >
                    <Image
                      src={`/images/docs/${job.image}.png`}
                      width={1440}
                      height={1000}
                      sizes="(max-width: 760px) 100vw, 600px"
                      alt={`${job.parts[0]} in the real workspace with fictional demo records.`}
                    />
                  </a>
                  <figcaption className={styles.note}>
                    Fictional demo data. Select to enlarge.
                  </figcaption>
                </figure>
              </article>
            ))}
          </div>
          <article className={styles.card} id="built">
            <p className="label">05 · Build around your business</p>
            <h3>Combine what exists. Extend what your process needs.</h3>
            <p>
              Use settings for supported configuration, plugins for business capabilities and
              connectors for external systems. Build a custom App when you need your own records,
              process or interface. The shared platform supplies identity, permissions, customer
              context and action history.
            </p>
            <div className={styles.actions}>
              <Link href="/docs/plugins" className={styles.secondary}>
                Explore the plugin library
              </Link>
              <Link href="/docs/extend/apps" className={styles.textLink}>
                Build a custom App <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <p className={styles.note}>
              Custom Apps use the source repository today. General-purpose App creation inside
              Command Center is planned.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section} id="recipes">
        <div className="wrap">
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">Built from the same foundation</p>
              <h2 className={styles.heading}>A practical starting point for your industry.</h2>
            </div>
            <p className={styles.lede}>
              See which features and plugins work together, what to configure and how to check the
              result. Each recipe includes an adaptation path for builders.
            </p>
          </div>
          <RecipeCards
            recipes={workflowRecipes.filter((item) =>
              ["roofing-inquiry", "engagement-onboarding"].includes(item.id),
            )}
          />
          <Link href="/docs/recipes" className={styles.textLink}>
            Explore all twenty recipes across ten industries{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.section} id="autonomy">
        <div className="wrap">
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">AI with a clear role</p>
              <h2 className={styles.heading}>Prepare, review, then act.</h2>
            </div>
            <div>
              <p className={styles.lede}>
                AI reads the connected context and prepares supported actions. Review the exact
                change before approval, then follow its recorded result. Eligible internal actions
                can use approved standing permissions; restricted actions keep human review.
              </p>
              <Link href="/docs/command-center/approvals" className={styles.textLink}>
                Understand approvals and autonomy <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="capabilities">
        <div className="wrap">
          <p className="label">The full feature reference</p>
          <h2 className={styles.heading}>Find the capability you need.</h2>
          <p className={styles.lede}>
            Read the purpose at a glance. Expand a capability for details, or search for the work
            you want to do.
          </p>
          <details className={styles.reference}>
            <summary>Browse and search the complete capability reference</summary>
            <div className="mt-6">
              <CapabilityCatalog />
            </div>
          </details>
          <Link href="/docs/command-center/capabilities" className={styles.textLink}>
            Open the detailed reference <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.section} id="who">
        <div className="wrap">
          <span id="proof" />
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">Choose how you start</p>
              <h2 className={styles.heading}>Build it with us. Or make it your own.</h2>
            </div>
            <p className={styles.lede}>
              A shared workspace is useful when several people and tools need the same customer
              context. We can also recommend a focused integration when that solves the job.
            </p>
          </div>
          <div className={styles.grid}>
            <article className={styles.card}>
              <p className="label">For business teams</p>
              <h3>Have Accelerate implement it.</h3>
              <p>
                We map one workflow, agree on its success check, configure the required connections
                and build the pieces your team needs.
              </p>
              <ul className={styles.checklist}>
                <li>A written scope, price and responsibilities before implementation</li>
                <li>A tested workflow, team training and operating documentation</li>
                <li>An agreed handoff, with optional managed execution and ongoing improvement</li>
              </ul>
              <p className={styles.note}>
                Implementation is scoped to your business. Hosting, provider usage and ongoing
                support are agreed separately.
              </p>
              <Link href="/contact" className={styles.primary}>
                Discuss your workflow <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className={styles.card}>
              <p className="label">For builders and agencies</p>
              <h3>Run and extend the source.</h3>
              <p>
                Build your own operating screen or client solution using the existing customer
                records, permissions, AI tools and action history.
              </p>
              <ul className={styles.checklist}>
                <li>Explore locally with fictional data and no provider credentials</li>
                <li>Use your infrastructure and connect the accounts you control</li>
                <li>Add modules, plugins and adapters through the documented source interfaces</li>
              </ul>
              <p className={styles.note}>
                Your team owns installation, backups, updates and provider costs. Custom Apps
                require source development today.
              </p>
              <Link href="/docs/extend/first-change" className={styles.secondary}>
                Start building <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          </div>
          <div className={styles.portfolio} id="implementation-experience">
            <p className="label">Implementation experience</p>
            <h3>See the work behind Accelerate.</h3>
            <p>
              These published projects show our experience building around real operations. Each
              case study identifies our role and delivered scope.
            </p>
            <div className={styles.grid}>
              {workProjects
                .filter((project) => ["work-shelter", "superdebate"].includes(project.slug))
                .map((project) => (
                  <Link
                    key={project.slug}
                    href={`/work/${project.slug}`}
                    className={styles.proofLink}
                  >
                    <span className="label">{project.relationship}</span>
                    <strong>{project.name}</strong>
                    <span>{project.description}</span>
                    <span className={styles.textLink}>
                      Read the case study <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className="wrap">
          <p className="label">Questions, answered</p>
          <h2 className={styles.heading}>Understand what you can build on.</h2>
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

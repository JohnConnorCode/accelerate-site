import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { CapabilityCatalog } from "@/components/command-center/CapabilityCatalog";
import { CommandCenterNav } from "@/components/command-center/CommandCenterNav";
import { RecipeCards } from "@/components/command-center/WorkflowRecipes";
import { ProductSlider } from "@/components/media/ProductSlider";
import { PRODUCT_SCREENSHOTS } from "@/content/product-screenshots";
import { workflowRecipes } from "@/content/workflow-recipes";
import { commandCenterFaqs } from "@/content/command-center-faq";
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
                Connect your business.
                <br />
                <em>Put AI to work.</em>
              </h1>
            </div>
            <div>
              <p className={styles.lede}>
                Bring customer history, conversations and the work ahead into one workspace. Give
                your team and AI the context to follow up, prepare decisions and carry work through
                to a result.
              </p>
              <div className={styles.actions}>
                <Link href="/demo/command-center" className={styles.primary}>
                  Explore the workspace <ArrowRight size={16} aria-hidden="true" />
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
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">One connected workflow</p>
              <h2 className={styles.heading}>From a customer question to work someone owns.</h2>
            </div>
            <p className={styles.lede}>
              A useful system carries context between steps. Here is how a roofing team can combine
              intake, customer records and follow-up without rebuilding that foundation.
            </p>
          </div>
          <div className={styles.workflow}>
            <ol>
              <li>
                <strong>Review the inquiry</strong>
                <p>
                  Form builder collects the request. The office reviews the response and accepts it
                  into the pipeline.
                </p>
              </li>
              <li>
                <strong>Use the customer context</strong>
                <p>
                  Open the customer and conversation. Ask AI for help using the records available in
                  the workspace.
                </p>
              </li>
              <li>
                <strong>Assign the next action</strong>
                <p>
                  Record the owner and follow-up. Pipeline follow-up helps the team find
                  opportunities that need another look.
                </p>
              </li>
              <li>
                <strong>Carry won work into delivery</strong>
                <p>
                  Client onboarding prepares an assigned checklist from the opportunity, with a
                  result the team can inspect.
                </p>
              </li>
            </ol>
            <div className={styles.card}>
              <p className="label">Make it useful this week</p>
              <h3>Start with one customer workflow.</h3>
              <p>
                Choose a real handoff your team repeats. Connect the required records, run an
                example and check the result before adding another process.
              </p>
              <ul className={styles.parts}>
                <li>Form builder</li>
                <li>Contacts</li>
                <li>Pipeline follow-up</li>
                <li>Client onboarding</li>
              </ul>
              <Link href="/docs/recipes/roofing-inquiry" className={styles.textLink}>
                Follow the roofing recipe <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <br />
              <Link href="/docs/start/first-value" className={styles.textLink}>
                Plan your first connected workflow <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} id="surface">
        <div className="wrap">
          <p className="label">Features with a job to do</p>
          <h2 className={styles.heading}>Keep the context. Move the work forward.</h2>
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
                  Real product interface, fictional demo data. Select to view full size.
                </figcaption>
              </figure>
            </article>
          ))}
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
              [
                "roofing-inquiry",
                "engagement-onboarding",
                "appointment-follow-through",
                "program-commitments",
              ].includes(item.id),
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
              <p className="label">Useful automation, visible decisions</p>
              <h2 className={styles.heading}>Set the responsibility AI can take on.</h2>
            </div>
            <p className={styles.lede}>
              AI uses the tools and records available to the workspace. Policies define which
              actions need a decision and which may run under an approved standing permission.
            </p>
          </div>
          <div className={styles.grid}>
            <article className={styles.card}>
              <h3>Review the work that matters</h3>
              <p>
                Inspect the exact change, recipient or task list before approving it. Read the
                recorded result to understand what completed and what needs attention.
              </p>
              <Link href="/docs/command-center/approvals" className={styles.textLink}>
                Understand approvals and autonomy <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
            <article className={styles.card}>
              <h3>Increase autonomy deliberately</h3>
              <p>
                Eligible actions can be proposed for a higher trust level as approval history
                develops. A person confirms the change, and safety floors keep restricted actions
                under human control.
              </p>
              <Link href="/docs/start/receipts" className={styles.textLink}>
                Learn how to check an action result <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
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
          <div className="mt-8">
            <CapabilityCatalog />
          </div>
        </div>
      </section>

      <section className={styles.section} id="who">
        <div className="wrap">
          <span id="proof" />
          <div className={styles.sectionIntro}>
            <div>
              <p className="label">Your next step</p>
              <h2 className={styles.heading}>Run a workflow or build your own.</h2>
            </div>
            <p className={styles.lede}>
              The platform is open source. You can explore the interface, operate a connected
              workspace or adapt the code to your business. Accelerate also helps teams decide what
              to build, implement it and keep it working.
            </p>
          </div>
          <div className={styles.grid}>
            <article className={styles.card}>
              <p className="label">For business users</p>
              <h3>See how it fits your day.</h3>
              <p>
                Try a fictional business, choose a useful recipe and learn what a connected
                workspace needs to run it.
              </p>
              <Link href="/demo/command-center" className={styles.textLink}>
                Choose a demo <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <br />
              <Link href="/docs/start/business-owners" className={styles.textLink}>
                Plan a first workflow
              </Link>
            </article>
            <article className={styles.card}>
              <p className="label">For builders and agencies</p>
              <h3>Build on shared business infrastructure.</h3>
              <p>
                Run the source, inspect a plugin and extend the same records and services your
                client’s team uses.
              </p>
              <Link href="/docs/extend/first-change" className={styles.textLink}>
                Make your first change <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <br />
              <Link href="/docs/start/agencies" className={styles.textLink}>
                Plan a client pilot
              </Link>
            </article>
          </div>
          <Link href="/contact" className={styles.textLink}>
            Talk through a custom solution with Accelerate{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className="wrap">
          <p className="label">Questions, answered</p>
          <h2 className={styles.heading}>Understand what you can build on.</h2>
          {commandCenterFaqs.map((faq) => (
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

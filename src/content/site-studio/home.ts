import { homePlanDeckContent } from "./plan-deck";
import { PRODUCT_SCREENSHOTS } from "../product-screenshots";
import { INDUSTRY_VISUALS } from "../industry-visuals";
import { marketingPositioning } from "../marketing-positioning";
import { homeFaqs } from "../home-faq";

/** Bundled editable content. Forks start with these local defaults, then keep
 * their own saved revisions. These values contain no installation credentials. */
export const homeStatementContent = {
  eyebrow: "Built around your business",
  heading: "We start with the work your team does every day.",
  body: "We identify where work is slow or revenue is missed, then build and improve the smallest useful system. That can include CRM connections, voice-to-text workflows, or better inquiry capture.",
  systemsLabel: "How we help",
  systemsHref: "#systems",
  workLabel: "See our work",
  workHref: "#selected-work",
  productLabel: "Explore Command Center",
  productHref: "#command-center",
};
export const homeWhoContent = {
  eyebrow: "The firm",
  headingStart: "Engineered by",
  headingMiddle: "veteran founders",
  headingEnd: "and operators.",
  years: "15",
  yearsLabel: "Years deploying machine learning at scale",
  body: "We put AI into production long before the hype cycle. Knowing exactly where to deploy automation, and what will break when you do, is the difference between a system that runs and one that needs babysitting.",
  detail:
    "We are deliberately selective. You interface directly with the engineers architecting your system, never an account manager. The practice is led by John Connor.",
  linkLabel: "Read more about the team",
  linkHref: "/about",
};
export const homeFaqContent = {
  eyebrow: "Common questions",
  title: "Answered plainly.",
  questions: homeFaqs.map((item) => item.question),
  answers: homeFaqs.map((item) => item.answer),
};

export const homeHeroContent = {
  eyebrow: "AI systems, built and run for operators",
  prefix: "We architect and deploy",
  highlighted: "intelligent automation",
  suffix: "to scale your",
  replacedWord: "productivity",
  finalWord: "PROFIT",
  ctaLabel: "Book a free strategy session",
  ctaHref: "/contact",
};
export const homeMarqueeContent = {
  items: [
    "Revenue systems",
    "Workflow automation",
    "Custom integrations",
    "AI agents",
    "Forecasting and analytics",
    "Internal tools",
    "Team enablement",
  ],
};

const homeProcessSteps = [
  {
    n: "01",
    title: "The session",
    tag: "30 min · free",
    body: "We learn how the business works, what the team wants to change, and where time or revenue is being lost.",
  },
  {
    n: "02",
    title: "The plan",
    tag: "yours to keep",
    body: "A written recommendation: where AI fits, the right type of solution, what should happen first, and why.",
  },
  {
    n: "03",
    title: "The delivery",
    tag: "fixed scope",
    body: "We provide the agreed consulting, custom build, integrations, training, or managed execution against a clear scope.",
  },
  {
    n: "04",
    title: "The improvement",
    tag: "ongoing support",
    body: "When ongoing help makes sense, we run the work, support the team, measure what changes, and keep improving it.",
  },
];
export const homeProcessContent = {
  eyebrow: "How we work",
  headingStart: "From understanding",
  headingMiddle: "the business to",
  headingEnd: "making it better.",
  body: "The shape of the engagement follows the problem. The solution may be advice, a focused build, training, ongoing execution, or a combination.",
  steps: homeProcessSteps,
};

export const homeFinalCtaContent = {
  eyebrow: "Start here",
  headingStart: "Book the session.",
  headingEnd: "Keep the plan.",
  body: "Thirty minutes with the people who would advise, build, or run the work. You leave with the recommendation in writing. Yours to keep either way.",
  ctaLabel: "Book a free strategy session",
  ctaHref: "/contact",
};
export const homeSystemsContent = {
  eyebrow: "How we help",
  headingStart: "Start with the business.",
  headingMiddle: "Build",
  headingEnd: "what it needs.",
  body: "We learn how your team works, find the useful opportunities for AI and automation, and shape the engagement around the result you need.",
  listLabel: "Ways to work with Accelerate",
  modes: marketingPositioning.engagementModes.map((mode) => ({ ...mode })),
  note: "Choose the support your team needs. We agree the scope together.",
};

const homeTrades = [
  {
    href: "/industries/home-services",
    name: "Home services",
    visual: INDUSTRY_VISUALS["home-services"],
  },
  { href: "/industries/law-firms", name: "Law firms", visual: INDUSTRY_VISUALS["law-firms"] },
  {
    href: "/industries/professional-services",
    name: "Professional services",
    visual: INDUSTRY_VISUALS["professional-services"],
  },
  { href: "/industries/real-estate", name: "Real estate", visual: INDUSTRY_VISUALS["real-estate"] },
  { href: "/industries/nonprofits", name: "Nonprofits", visual: INDUSTRY_VISUALS.nonprofits },
];

export const homeTradesContent = {
  eyebrow: "Where it lands",
  headingStart: "Built around the work",
  headingMiddle: "your team",
  headingEnd: "actually does.",
  trades: homeTrades.map(({ href, name, visual }) => ({
    href,
    name,
    promise: visual.promise,
    image: visual.hero.src,
    alt: visual.hero.alt,
  })),
};

const homePlanItems = [
  "Where AI or automation is genuinely useful",
  "Whether the answer is advice, a workflow, an agent, an integration, training, or execution",
  "What should happen first and why",
  "The tools, access, people, and approvals the work needs",
  "A clear scope, ownership model, and way to measure progress",
];

export const homePlanContent = {
  eyebrow: "The plan",
  heading: "You leave the first session with a written plan.",
  body: "Thirty minutes. You describe how the business runs and what you want to change. We identify where AI or automation fits, recommend the right kind of solution, and put the next steps in writing. Yours to keep either way.",
  items: homePlanItems,
  deck: homePlanDeckContent,
  ctaLabel: "Book a free strategy session",
  ctaHref: "/contact",
};

export const homeWorkContent = {
  eyebrow: "Selected work",
  heading: "Systems that had to work in production.",
  body: "These projects show the operating experience behind Accelerate: finding the constraint, designing the right system, building it, and improving the work around it.",
  ctaLabel: "See all work",
  ctaHref: "/work",
};
export const homeCommandCenterContent = {
  eyebrow: marketingPositioning.commandCenter.label,
  headingStart: "When the work needs",
  headingEnd: "one place to run.",
  body: marketingPositioning.commandCenter.description,
  introduction:
    "Browse real product screens with fictional business data. Open the demo to explore the same workspace, records, and workflows yourself.",
  groupLabel: "Command Center screens",
  slides: PRODUCT_SCREENSHOTS.map((slide) => ({ ...slide })),
  links: [
    { label: "Explore the Command Center", href: "/command-center" },
    { label: "Explore the demo", href: "/demo/command-center" },
    { label: "Read the docs", href: "/docs" },
  ],
};

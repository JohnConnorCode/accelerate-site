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

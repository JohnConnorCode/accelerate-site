import type { ServicePackage, FAQ } from "@/lib/types";

export const packages: ServicePackage[] = [
  {
    id: "launch",
    name: "Launch",
    slug: "launch",
    tagline: "Get found, get leads",
    description:
      "Everything you need to establish a professional digital presence that actually generates leads. Perfect for businesses starting from scratch or replacing an outdated website.",
    priceOneTime: 2500,
    priceMonthly: 0,
    features: [
      { name: "AI-powered website", included: true, detail: "5-page responsive site" },
      { name: "Local SEO setup", included: true, detail: "Google Business Profile optimization" },
      { name: "Contact forms with routing", included: true },
      { name: "Mobile-first design", included: true },
      { name: "Google Analytics setup", included: true },
      { name: "SSL and security", included: true },
      { name: "90-day support", included: true },
      { name: "AI chat widget", included: false },
      { name: "Automated follow-ups", included: false },
      { name: "AI phone agent", included: false },
      { name: "CRM integration", included: false },
      { name: "Monthly reporting", included: false },
    ],
    highlighted: false,
    ctaText: "Get Started",
    ctaLink: "/contact?package=launch",
  },
  {
    id: "grow",
    name: "Grow",
    slug: "grow",
    tagline: "Automate and convert",
    description:
      "Your website plus the automation backbone to never miss a lead. Instant follow-ups, AI chat, and CRM integration that turns your site into a lead machine.",
    priceOneTime: 4500,
    priceMonthly: 300,
    features: [
      { name: "AI-powered website", included: true, detail: "Up to 10 pages" },
      { name: "Local SEO setup", included: true, detail: "Full local SEO strategy" },
      { name: "Contact forms with routing", included: true },
      { name: "Mobile-first design", included: true },
      { name: "Google Analytics setup", included: true },
      { name: "SSL and security", included: true },
      { name: "Ongoing support", included: true, detail: "Priority email and chat" },
      { name: "AI chat widget", included: true, detail: "Trained on your business" },
      { name: "Automated follow-ups", included: true, detail: "Email and SMS sequences" },
      { name: "AI phone agent", included: false },
      { name: "CRM integration", included: true, detail: "HubSpot, Salesforce, etc." },
      { name: "Monthly reporting", included: true },
    ],
    highlighted: true,
    ctaText: "Most Popular",
    ctaLink: "/contact?package=grow",
  },
  {
    id: "accelerate",
    name: "Accelerate",
    slug: "accelerate",
    tagline: "Full AI-powered growth",
    description:
      "The complete system. Website, automations, AI agents, and ongoing optimization. For businesses ready to dominate their market with technology their competitors don't have.",
    priceOneTime: 7500,
    priceMonthly: 600,
    features: [
      { name: "AI-powered website", included: true, detail: "Unlimited pages" },
      { name: "Local SEO setup", included: true, detail: "Aggressive SEO campaign" },
      { name: "Contact forms with routing", included: true },
      { name: "Mobile-first design", included: true },
      { name: "Google Analytics setup", included: true, detail: "Advanced event tracking" },
      { name: "SSL and security", included: true },
      { name: "Ongoing support", included: true, detail: "Dedicated account manager" },
      { name: "AI chat widget", included: true, detail: "Advanced multi-turn conversations" },
      { name: "Automated follow-ups", included: true, detail: "Full nurture sequences" },
      { name: "AI phone agent", included: true, detail: "24/7 inbound call handling" },
      { name: "CRM integration", included: true, detail: "Deep bi-directional sync" },
      { name: "Monthly reporting", included: true, detail: "ROI tracking and optimization" },
    ],
    highlighted: false,
    ctaText: "Go All In",
    ctaLink: "/contact?package=accelerate",
  },
];

export const packageFaqs: FAQ[] = [
  {
    question: "Can I upgrade my package later?",
    answer:
      "Absolutely. Most of our clients start with Launch or Grow and upgrade as they see results. When you upgrade, we credit what you have already paid toward the new package so you never pay twice for the same work.",
    category: "packages",
  },
  {
    question: "What's included in the monthly fee?",
    answer:
      "The monthly fee covers hosting, ongoing AI agent management, automation monitoring, support, and monthly performance reporting. For the Grow package, that includes CRM integration maintenance and email/SMS sequence optimization. For Accelerate, it adds dedicated account management and AI phone agent operation.",
    category: "packages",
  },
  {
    question: "Is there a contract or commitment?",
    answer:
      "The one-time setup fee is paid upfront (we offer payment plans for larger packages). Monthly services are billed month-to-month with no long-term contract. You can pause or cancel monthly services anytime with 30 days notice.",
    category: "packages",
  },
  {
    question: "Do you offer payment plans?",
    answer:
      "Yes. For the Grow and Accelerate packages, we offer 2-3 month payment plans on the setup fee. Monthly service fees are billed at the start of each month. We are happy to work with you to find a payment structure that fits your cash flow.",
    category: "packages",
  },
  {
    question: "What if I only need one specific service?",
    answer:
      "Packages offer the best value, but we are happy to discuss individual services. Head over to our services page or use the solution generator to get a custom recommendation based on your specific needs.",
    category: "packages",
  },
  {
    question: "How long does each package take to launch?",
    answer:
      "Launch typically goes live within 2-3 weeks. Grow takes 3-4 weeks since it includes automation setup. Accelerate takes 4-6 weeks to fully deploy including AI agent training and phone system configuration. We keep you updated at every stage.",
    category: "packages",
  },
];

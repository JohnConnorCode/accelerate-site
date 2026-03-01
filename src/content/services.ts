import type { Service } from "@/lib/types";

export const services: Service[] = [
  {
    id: "ai-websites",
    name: "AI-Powered Websites",
    description:
      "Your website should do more than look good. It should bring in clients while you sleep. We build fast, conversion-focused websites with built-in AI chat, smart forms, and SEO that actually ranks. Every site is designed around your specific industry and the way your customers search for services like yours.",
    shortDescription:
      "Conversion-focused websites with built-in AI chat, smart forms, and SEO that brings in clients around the clock.",
    icon: "Globe",
    deliverables: [
      "Custom responsive design tailored to your industry",
      "AI-powered chat widget trained on your services",
      "SEO foundation with local search optimization",
      "Conversion-optimized landing pages",
      "Contact forms with smart routing",
      "Google Analytics and conversion tracking",
      "Mobile-first performance optimization",
      "CMS for easy content updates",
      "SSL certificate and security hardening",
      "90 days of post-launch support",
    ],
    pricingOneTime: "$2,500",
    pricingDisplay: "from $2,500",
    href: "/services#websites",
    problemStatement:
      "Your website looks like a brochure from 2019. Visitors bounce, potential clients slip away, and you have no idea who's even looking.",
    keyMetrics: [
      { value: "+340%", label: "Avg. inquiry increase" },
      { value: "< 2s", label: "Page load time" },
      { value: "24/7", label: "Client capture" },
    ],
    illustration: "DashboardMockup",
    process: [
      { step: "Audit & Strategy", description: "We analyze your current site, competitors, and market to build a conversion-focused blueprint." },
      { step: "Design & Build", description: "Custom design and development with AI integrations, SEO, and conversion tracking baked in." },
      { step: "Launch & Optimize", description: "Go live with monitoring, A/B testing, and ongoing performance tuning." },
    ],
  },
  {
    id: "automations",
    name: "Automations & Workflows",
    description:
      "Every minute you spend on repetitive tasks is a minute you're not spending on billable work. We build automations that handle follow-ups, appointment scheduling, invoicing reminders, and prospect follow-up so nothing falls through the cracks. Your systems talk to each other, and your team focuses on what they do best.",
    shortDescription:
      "Automated follow-ups, scheduling, invoicing, and prospect nurturing that keep your pipeline moving without manual work.",
    icon: "Zap",
    deliverables: [
      "Workflow audit and automation roadmap",
      "CRM integration and pipeline setup",
      "Automated prospect follow-up sequences",
      "Appointment scheduling automation",
      "Invoice and payment reminders",
      "Review request automation",
      "Custom Zapier/Make.com integrations",
      "Email and SMS notification workflows",
      "Monthly performance reporting",
      "Ongoing optimization and support",
    ],
    pricingOneTime: "$1,500",
    pricingMonthly: "$300/mo",
    pricingDisplay: "from $1,500 + $300/mo",
    href: "/services#automations",
    problemStatement:
      "You're spending 10+ hours a week on follow-ups, reminders, and data entry that a machine could handle in seconds.",
    keyMetrics: [
      { value: "10+", label: "Hours saved / week" },
      { value: "< 60s", label: "First response time" },
      { value: "0", label: "Missed follow-ups" },
    ],
    illustration: "AutomationFlowIllustration",
    process: [
      { step: "Workflow Audit", description: "We map every manual process and identify the highest-impact automation opportunities." },
      { step: "Build & Connect", description: "Custom integrations between your CRM, calendar, email, and payment systems." },
      { step: "Monitor & Iterate", description: "Ongoing monitoring, optimization, and new workflow builds as your business grows." },
    ],
  },
  {
    id: "ai-agents",
    name: "AI Agents",
    description:
      "An AI agent that knows your business, answers questions accurately, books appointments, and qualifies leads 24/7. Unlike generic chatbots, our agents are trained on your specific services, pricing, and processes. They handle the conversations you don't have time for and route the ones that need a human touch.",
    shortDescription:
      "Custom AI agents trained on your business that answer questions, book appointments, and qualify leads 24/7.",
    icon: "Bot",
    deliverables: [
      "Custom AI agent trained on your business data",
      "Natural language conversation handling",
      "Appointment booking integration",
      "Lead qualification and scoring",
      "Handoff to human when needed",
      "Multi-channel deployment (web, SMS, email)",
      "Knowledge base creation and maintenance",
      "Conversation analytics dashboard",
      "Monthly training updates and refinement",
      "Dedicated support and optimization",
    ],
    pricingOneTime: "$1,500",
    pricingMonthly: "$300/mo",
    pricingDisplay: "from $1,500 + $300/mo",
    href: "/services#agents",
    problemStatement:
      "Leads call at 9 PM. They text on weekends. You can't be everywhere — but your competitor's chatbot can.",
    keyMetrics: [
      { value: "60%", label: "Inquiries handled by AI" },
      { value: "185%", label: "More consultations booked" },
      { value: "$0", label: "Additional labor cost" },
    ],
    illustration: "ChatAgentIllustration",
    process: [
      { step: "Knowledge Training", description: "We train the agent on your services, pricing, FAQs, and conversation style." },
      { step: "Deploy Everywhere", description: "Launch on your website, SMS, email, and social channels simultaneously." },
      { step: "Learn & Improve", description: "Monthly refinement based on real conversations and conversion data." },
    ],
  },
];

import type { Service } from "@/lib/types";

export const services: Service[] = [
  {
    id: "ai-websites",
    name: "AI-Powered Websites",
    description:
      "Your website should do more than look good. It should bring in leads while you sleep. We build fast, conversion-focused websites with built-in AI chat, smart forms, and SEO that actually ranks. Every site is designed around your specific industry and the way your customers search for services like yours.",
    shortDescription:
      "Conversion-focused websites with built-in AI chat, smart forms, and SEO that brings in leads around the clock.",
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
  },
  {
    id: "automations",
    name: "Automations & Workflows",
    description:
      "Every minute you spend on repetitive tasks is a minute you're not spending on billable work. We build automations that handle follow-ups, appointment scheduling, invoicing reminders, and lead nurturing so nothing falls through the cracks. Your systems talk to each other, and your team focuses on what they do best.",
    shortDescription:
      "Automated follow-ups, scheduling, invoicing, and lead nurturing that keep your pipeline moving without manual work.",
    icon: "Zap",
    deliverables: [
      "Workflow audit and automation roadmap",
      "CRM integration and pipeline setup",
      "Automated lead follow-up sequences",
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
  },
];

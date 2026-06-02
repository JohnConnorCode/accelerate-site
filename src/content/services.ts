import type { Service } from "@/lib/types";

export const services: Service[] = [
  {
    id: "strategy",
    name: "AI Strategy & Roadmap",
    description:
      "We audit how your business runs and show you exactly where AI creates the most value. You get a prioritized plan with tool recommendations, ROI projections, and a clear build sequence. No guesswork. No wasted spend.",
    shortDescription:
      "A full audit of your operations with a prioritized AI roadmap, tool recommendations, and ROI projections.",
    icon: "Compass",
    deliverables: [
      "Full business process audit",
      "AI opportunity assessment",
      "Tool and platform recommendations",
      "ROI projections per initiative",
      "Prioritized implementation roadmap",
      "Risk assessment and mitigation plan",
    ],
    pricingOneTime: "$1,500",
    pricingDisplay: "from $1,500",
    href: "/services#strategy",
    problemStatement:
      "You know AI could help your business, but you don't know where to start or what's worth the investment.",
    keyMetrics: [
      { value: "Day one", label: "Clarity before you build" },
      { value: "Custom", label: "Tailored to you" },
      { value: "Clear", label: "ROI before you spend" },
    ],
    process: [
      { step: "Discovery", description: "We learn your business, tools, team, and goals in a deep-dive session." },
      { step: "Audit", description: "We map every process and identify the highest-impact AI opportunities." },
      { step: "Deliver", description: "You receive a detailed roadmap with priorities, tools, timelines, and projected ROI." },
    ],
  },
  {
    id: "automation",
    name: "Workflow Automation",
    description:
      "Connect your tools and eliminate the manual handoffs slowing your team down. CRM updates, scheduling, invoicing, onboarding, internal approvals. Every repetitive process handled automatically.",
    shortDescription:
      "Automated follow-ups, scheduling, invoicing, and internal workflows that keep your business moving.",
    icon: "Workflow",
    deliverables: [
      "Workflow audit and automation roadmap",
      "CRM integration and pipeline setup",
      "Automated follow-up sequences",
      "Appointment scheduling automation",
      "Invoice and payment reminders",
      "Review request automation",
      "Custom Zapier/Make integrations",
      "Email and SMS notification workflows",
      "Monthly performance reporting",
      "Ongoing optimization and support",
    ],
    pricingOneTime: "$2,500",
    pricingMonthly: "$300/mo",
    pricingDisplay: "from $2,500 + $300/mo",
    href: "/services#automation",
    problemStatement:
      "You're spending 10+ hours a week on follow-ups, reminders, and data entry that a machine could handle in seconds.",
    keyMetrics: [
      { value: "10+", label: "Hours saved / week" },
      { value: "< 60s", label: "First response time" },
      { value: "0", label: "Missed follow-ups" },
    ],
    process: [
      { step: "Workflow Audit", description: "We map every manual process and identify the highest-impact automation opportunities." },
      { step: "Build & Connect", description: "Custom integrations between your CRM, calendar, email, and payment systems." },
      { step: "Monitor & Iterate", description: "Ongoing monitoring, optimization, and new workflow builds as your business grows." },
    ],
  },
  {
    id: "sales",
    name: "Sales & Marketing Automation",
    description:
      "Inquiries scored and routed the moment they come in. Follow-up sequences that run without you. Email campaigns, social scheduling, and pipeline management that keep your revenue engine moving while you focus on closing.",
    shortDescription:
      "Automated pipeline management, email campaigns, social scheduling, and follow-up sequences.",
    icon: "TrendingUp",
    deliverables: [
      "Pipeline automation and CRM setup",
      "Email campaign design and automation",
      "Social media scheduling system",
      "Inquiry scoring and routing",
      "Multi-step follow-up sequences",
      "Conversion tracking and attribution",
      "A/B testing for campaigns",
      "Monthly performance reporting",
    ],
    pricingOneTime: "$2,500",
    pricingMonthly: "$300/mo",
    pricingDisplay: "from $2,500 + $300/mo",
    href: "/services#sales",
    problemStatement:
      "Your pipeline leaks. Inquiries go cold because follow-up is manual, inconsistent, and always the first thing to slip.",
    keyMetrics: [
      { value: "+38%", label: "More jobs booked" },
      { value: "24/7", label: "Follow-up coverage" },
      { value: "< 5 min", label: "Response time" },
    ],
    process: [
      { step: "Pipeline Audit", description: "We map your current sales process and identify where opportunities are falling through." },
      { step: "Build & Launch", description: "Automated sequences, scoring rules, and campaign infrastructure tailored to your business." },
      { step: "Optimize", description: "A/B testing, conversion tracking, and monthly reporting to continuously improve results." },
    ],
  },
  {
    id: "engagement",
    name: "Customer Engagement",
    description:
      "Instant responses to inquiries. Automated appointment booking, review requests, and re-engagement campaigns. Every customer touchpoint covered so nothing falls through.",
    shortDescription:
      "AI-powered chat, automated booking, review management, and re-engagement campaigns.",
    icon: "MessageCircle",
    deliverables: [
      "Custom AI agent trained on your business",
      "Natural language conversation handling",
      "Appointment booking integration",
      "Inquiry qualification and scoring",
      "Human handoff when needed",
      "Multi-channel deployment (web, SMS, email)",
      "Review request automation",
      "Re-engagement campaigns",
      "Conversation analytics dashboard",
      "Monthly training updates",
    ],
    pricingOneTime: "$1,500",
    pricingMonthly: "$300/mo",
    pricingDisplay: "from $1,500 + $300/mo",
    href: "/services#engagement",
    problemStatement:
      "Customers reach out at 9 PM. They message on weekends. You can't be everywhere, and you're losing business every hour you're not available.",
    keyMetrics: [
      { value: "60%", label: "Inquiries handled by AI" },
      { value: "+40%", label: "More bookings" },
      { value: "$0", label: "Additional labor cost" },
    ],
    process: [
      { step: "Knowledge Training", description: "We train the agent on your services, pricing, FAQs, and conversation style." },
      { step: "Deploy Everywhere", description: "Launch on your website, SMS, email, and social channels simultaneously." },
      { step: "Learn & Improve", description: "Monthly refinement based on real conversations and conversion data." },
    ],
  },
  {
    id: "content",
    name: "Content Creation",
    description:
      "Systematic content in your voice across every channel. Blog posts, social media, email newsletters. Consistent output on a real schedule, without a marketing hire.",
    shortDescription:
      "Blog posts, social media, and email newsletters, created in your voice on a consistent schedule.",
    icon: "PenTool",
    deliverables: [
      "Content strategy and editorial calendar",
      "Blog posts (SEO-optimized)",
      "Social media content and scheduling",
      "Email newsletter design and automation",
      "Brand voice development",
      "Performance tracking and reporting",
    ],
    pricingMonthly: "$1,500/mo",
    pricingDisplay: "from $1,500/mo",
    href: "/services#content",
    problemStatement:
      "Content happens when you find time. A post here, an email there. No rhythm. No consistency. No results.",
    keyMetrics: [
      { value: "4x", label: "Content output" },
      { value: "Weekly", label: "Consistent schedule" },
      { value: "Your", label: "Voice, not ours" },
    ],
    process: [
      { step: "Voice & Strategy", description: "We learn your tone, audience, and goals to build an editorial calendar." },
      { step: "Create & Schedule", description: "Ongoing content creation across all channels, published on a consistent schedule." },
      { step: "Measure & Adjust", description: "Performance reporting and continuous refinement based on what resonates." },
    ],
  },
  {
    id: "reporting",
    name: "Data & Reporting",
    description:
      "One place to see what matters. Custom dashboards, weekly performance digests, pipeline tracking, and trend analysis. Clear answers without logging into six different tools.",
    shortDescription:
      "Custom dashboards, weekly digests, pipeline tracking, and trend analysis in one place.",
    icon: "BarChart3",
    deliverables: [
      "Custom analytics dashboard",
      "Weekly performance digests",
      "Pipeline and revenue tracking",
      "Trend analysis and forecasting",
      "ROI reporting per initiative",
      "Competitive benchmarking",
    ],
    pricingMonthly: "$500/mo",
    pricingDisplay: "from $500/mo",
    href: "/services#reporting",
    problemStatement:
      "You check five tools to understand how your business is doing. Half the data is stale. You make decisions on gut feel instead of evidence.",
    keyMetrics: [
      { value: "1", label: "Dashboard" },
      { value: "Weekly", label: "Insights delivered" },
      { value: "Clear", label: "ROI visibility" },
    ],
    process: [
      { step: "Audit & Connect", description: "We map your data sources and connect everything into a unified view." },
      { step: "Build & Configure", description: "Custom dashboards and automated reports tailored to your KPIs." },
      { step: "Deliver & Refine", description: "Weekly digests and ongoing refinement as your priorities evolve." },
    ],
  },
];

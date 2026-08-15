import type { Service } from "@/lib/types";

export const services: Service[] = [
  {
    id: "strategy",
    name: "AI Strategy & Roadmap",
    description:
      "A comprehensive operational audit that maps your existing workflows against automation potential. You receive an engineered blueprint detailing exact toolchain integrations, ROI models, and a phased deployment sequence. No guesswork, just precision execution.",
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
      "You recognize the imperative to automate, but lack the technical architecture and financial models to deploy capital effectively.",
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
      "Total integration of your operational tech stack. We engineer autonomous workflows that completely absorb manual data entry, handoffs, and routine processes—from intake and scheduling to complex internal approvals.",
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
      "Your most valuable personnel are burning hours executing repetitive digital tasks that software should handle instantaneously.",
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
      "Autonomous lead qualification, dynamic routing, and relentless follow-up sequences. We construct an autonomous pipeline engine that sustains engagement and advances deals while your team focuses exclusively on closing.",
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
      "Your pipeline suffers from velocity leaks because follow-up is manual, inconsistent, and reliant on human memory.",
    keyMetrics: [
      { value: "+38%", label: "More jobs booked" },
      { value: "0", label: "Follow-ups missed" },
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
      "Intelligent, zero-latency response architecture. We deploy custom language models across your channels to handle inquiries, orchestrate bookings, and execute retention campaigns 24/7.",
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
      "Inbound volume outpaces your capacity to respond instantly, resulting in abandoned leads and degraded customer experience.",
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
      "Automated content engines calibrated to your exact brand voice. From strategic scheduling to generation and distribution, we deploy systems that maintain a relentless cadence without requiring a marketing hire.",
    shortDescription:
      "Blog posts, social media, and email newsletters, published on a calendar you approve monthly.",
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
      "Your market presence is erratic because content creation is relegated to whatever time remains after operational duties.",
    keyMetrics: [
      { value: "4x", label: "Content output" },
      { value: "Weekly", label: "Consistent schedule" },
      { value: "12", label: "Pieces per month" },
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
      "Unified operational intelligence. We aggregate your fragmented data sources into real-time, deterministic dashboards that deliver unvarnished truth about your pipeline, revenue, and system performance.",
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
      "You are navigating complex operational decisions based on delayed, fragmented data rather than real-time telemetry.",
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

import type { CaseStudyFull } from "@/lib/types";

export const caseStudies: CaseStudyFull[] = [
  {
    id: "farrell-roofing",
    slug: "farrell-roofing",
    businessName: "Farrell Roofing",
    industry: "home_services",
    location: "",
    challenge:
      "Farrell Roofing was running a solid operation but leaving money on the table. Their website hadn't been updated in years, they were missing calls during jobs, and follow-up on estimates was entirely manual. The owner estimated he was losing several customers a week just from slow response times and a website that didn't convert.",
    solution:
      "We rebuilt their website with local SEO targeting every service area in the region. Added an AI chat agent trained on their services and pricing that books roof inspections 24/7. Set up automated follow-up sequences for every estimate request, so no inquiry sits unanswered for more than a few minutes. Integrated everything with their existing CRM so the team has full visibility.",
    results:
      "Within the first quarter, Farrell Roofing saw a dramatic increase in inbound inquiries, cut their average response time to under two minutes, and booked significant additional monthly revenue directly attributable to the new system. The AI agent now handles the majority of initial inquiries without any human involvement, freeing up the office staff to focus on scheduling and customer service.",
    testimonialQuote:
      "We went from missing half our calls to never missing a single inquiry. The AI agent books inspections while we are up on a roof. Best investment we have made in the business.",
    testimonialAuthor: "Robert Farrell",
    testimonialTitle: "Owner, Farrell Roofing",
    metrics: [
      {
        label: "Online Inquiries",
        before: "~10/month",
        after: "50+/month",
        improvement: "+4x",
      },
      {
        label: "Response Time",
        before: "Hours",
        after: "Under 2 min",
        improvement: "-98%",
      },
      {
        label: "Monthly Revenue",
        before: "Baseline",
        after: "+75%",
        improvement: "+75%",
      },
      {
        label: "After-Hours Capture",
        before: "None",
        after: "Active 24/7",
        improvement: "New",
      },
    ],
    services: ["AI-Powered Website", "AI Chat Agent", "Automated Follow-Up"],
    timeline: "4 weeks",
    featured: true,
    publishedAt: "2025-11-15",
  },
  {
    id: "sparkblox",
    slug: "sparkblox",
    businessName: "SparkBlox",
    industry: "professional_services",
    location: "",
    challenge:
      "SparkBlox was growing fast but drowning in manual onboarding. Every new client meant hours of back-and-forth emails, document collection, and account setup. The co-founders were spending more time on admin than on the product, and the onboarding bottleneck was capping how many clients they could take on each month.",
    solution:
      "We rebuilt their entire client onboarding pipeline with AI-driven automation. Prospects now go through a guided intake flow that collects requirements, generates custom proposals, and triggers account provisioning automatically. Automated follow-up sequences handle check-ins and feedback collection. Their website was rebuilt to convert visitors into qualified inquiries with clear CTAs and an AI chat agent.",
    results:
      "Onboarding time dropped dramatically — from hours per client to just minutes. The team scaled their client base significantly within the first quarter without adding headcount. Revenue grew while the founders redirected substantial hours every week from admin back into product and strategy.",
    testimonialQuote:
      "Accelerate rebuilt our site and automated our entire client onboarding pipeline. What used to take our team two hours per client now happens in minutes. We scaled without adding headcount.",
    testimonialAuthor: "Jordan Ellis",
    testimonialTitle: "Co-Founder, SparkBlox",
    metrics: [
      {
        label: "Onboarding Time",
        before: "Hours/client",
        after: "Under 10 min",
        improvement: "-90%+",
      },
      {
        label: "Client Growth (Q1)",
        before: "Baseline",
        after: "+70%",
        improvement: "+70%",
      },
      {
        label: "Admin Hours (weekly)",
        before: "20+",
        after: "~5",
        improvement: "-75%",
      },
      {
        label: "Response Time",
        before: "Hours",
        after: "Under 3 min",
        improvement: "-98%",
      },
    ],
    services: ["AI-Powered Website", "Workflow Automation", "AI Chat Agent"],
    timeline: "4 weeks",
    featured: true,
    publishedAt: "2026-01-10",
  },
  {
    id: "montoya-capital",
    slug: "montoya-capital",
    businessName: "Montoya Capital",
    industry: "professional_services",
    location: "",
    challenge:
      "Montoya Capital was losing prospective clients to competitors who responded faster. In wealth management, a delayed follow-up often means a lost deal. Their team was manually fielding inquiries during business hours only, and prospects who reached out in the evening or on weekends never heard back until Monday. They had no digital acquisition strategy beyond referrals.",
    solution:
      "Built an AI-powered response system that engages prospects within minutes of any inquiry — web form, email, or chat — and nurtures them with personalized follow-up sequences until they book a consultation. Redesigned their website with trust-building content, clear service breakdowns, and an AI chat agent trained on their services and fee structures. Automated meeting scheduling, reminders, and post-consultation follow-ups.",
    results:
      "Consultation bookings jumped significantly in the first quarter. The AI response system captures every after-hours inquiry, adding new qualified prospects each month that were previously lost. The firm signed multiple new clients in Q1 representing meaningful new assets under management, with zero additional marketing spend.",
    testimonialQuote:
      "In wealth management, slow follow-up kills deals. Accelerate built an AI response system that engages prospects within minutes and nurtures them until they book. Our consultation rate jumped significantly in the first quarter.",
    testimonialAuthor: "Mike Montoya",
    testimonialTitle: "Managing Partner, Montoya Capital",
    metrics: [
      {
        label: "Consultation Rate",
        before: "Baseline",
        after: "+40%",
        improvement: "+40%",
      },
      {
        label: "Response Time",
        before: "Next business day",
        after: "Under 3 min",
        improvement: "-95%",
      },
      {
        label: "After-Hours Capture",
        before: "None",
        after: "Active 24/7",
        improvement: "New",
      },
      {
        label: "New Clients (Q1)",
        before: "Referral only",
        after: "2.5x",
        improvement: "+150%",
      },
    ],
    services: ["AI-Powered Website", "AI Chat Agent", "Automated Follow-Up"],
    timeline: "4 weeks",
    featured: false,
    publishedAt: "2026-02-01",
  },
];

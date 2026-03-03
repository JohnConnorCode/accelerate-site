import type { CaseStudyFull } from "@/lib/types";

export const caseStudies: CaseStudyFull[] = [
  {
    id: "farrell-roofing",
    slug: "farrell-roofing",
    businessName: "Farrell Roofing",
    industry: "home_services",
    location: "Denver, CO",
    challenge:
      "Farrell Roofing was running a solid operation but leaving money on the table. Their website hadn't been updated in years, they were missing calls during jobs, and follow-up on estimates was entirely manual. The owner, Mike Farrell, estimated he was losing 3-5 customers per week just from slow response times and a website that didn't convert.",
    solution:
      "We rebuilt their website with local SEO targeting every service area within 30 miles of Denver. Added an AI chat agent trained on their services and pricing that books roof inspections 24/7. Set up automated follow-up sequences for every estimate request, so no inquiry sits unanswered for more than 2 minutes. Integrated everything with their existing CRM so the team has full visibility.",
    results:
      "Within 90 days, Farrell Roofing saw a 340% increase in inbound inquiries, cut their average response time from 4 hours to under 2 minutes, and booked an additional $47,000 in revenue directly attributable to the new system. The AI agent handles 60% of initial inquiries without any human involvement, freeing up the office staff to focus on scheduling and customer service.",
    testimonialQuote:
      "We went from missing half our calls to never missing a single inquiry. The AI agent books inspections while we are up on a roof. Best investment we have made in the business.",
    testimonialAuthor: "Mike Farrell",
    testimonialTitle: "Owner, Farrell Roofing",
    metrics: [
      {
        label: "Online Inquiries",
        before: "12/month",
        after: "53/month",
        improvement: "+340%",
      },
      {
        label: "Response Time",
        before: "4 hours avg",
        after: "Under 2 min",
        improvement: "-98%",
      },
      {
        label: "Monthly Revenue",
        before: "$62,000",
        after: "$109,000",
        improvement: "+76%",
      },
      {
        label: "After-Hours Capture",
        before: "0 inquiries",
        after: "18/month",
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
    location: "Remote",
    challenge:
      "SparkBlox was growing fast but drowning in manual onboarding. Every new client meant hours of back-and-forth emails, document collection, and account setup. The co-founders were spending more time on admin than on the product, and the onboarding bottleneck was capping how many clients they could take on each month.",
    solution:
      "We rebuilt their entire client onboarding pipeline with AI-driven automation. Prospects now go through a guided intake flow that collects requirements, generates custom proposals, and triggers account provisioning automatically. Automated follow-up sequences handle check-ins and feedback collection. Their website was rebuilt to convert visitors into qualified inquiries with clear CTAs and an AI chat agent.",
    results:
      "Onboarding time dropped from 2 hours per client to under 10 minutes. The team scaled their client base by 70% in 90 days without adding headcount. Revenue grew while the founders redirected 15+ hours per week from admin back into product and strategy.",
    testimonialQuote:
      "Accelerate rebuilt our site and automated our entire client onboarding pipeline. What used to take our team two hours per client now happens in minutes. We scaled without adding headcount.",
    testimonialAuthor: "Jordan Ellis",
    testimonialTitle: "Co-Founder, SparkBlox",
    metrics: [
      {
        label: "Onboarding Time",
        before: "2 hours/client",
        after: "Under 10 min",
        improvement: "-92%",
      },
      {
        label: "Clients Onboarded (Q1)",
        before: "30",
        after: "51",
        improvement: "+70%",
      },
      {
        label: "Admin Hours (weekly)",
        before: "20+ hours",
        after: "5 hours",
        improvement: "-75%",
      },
      {
        label: "Inquiry Response Time",
        before: "6+ hours",
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
    location: "Miami, FL",
    challenge:
      "Montoya Capital was losing prospective clients to competitors who responded faster. In wealth management, a delayed follow-up often means a lost deal. Their team was manually fielding inquiries during business hours only, and prospects who reached out in the evening or on weekends never heard back until Monday. They had no digital acquisition strategy beyond referrals.",
    solution:
      "Built an AI-powered response system that engages prospects within minutes of any inquiry — web form, email, or chat — and nurtures them with personalized follow-up sequences until they book a consultation. Redesigned their website with trust-building content, clear service breakdowns, and an AI chat agent trained on their services and fee structures. Automated meeting scheduling, reminders, and post-consultation follow-ups.",
    results:
      "Consultation bookings jumped 40% in the first quarter. The AI response system captures every after-hours inquiry, adding 14 new qualified prospects per month that were previously lost. The firm signed 6 new clients in Q1 representing significant new assets under management, with zero additional marketing spend.",
    testimonialQuote:
      "In wealth management, slow follow-up kills deals. Accelerate built an AI response system that engages prospects within minutes and nurtures them until they book. Our consultation rate jumped 40% the first quarter.",
    testimonialAuthor: "Carlos Montoya",
    testimonialTitle: "Managing Partner, Montoya Capital",
    metrics: [
      {
        label: "Consultation Rate",
        before: "Baseline",
        after: "+40%",
        improvement: "+40%",
      },
      {
        label: "Prospect Response Time",
        before: "Next business day",
        after: "Under 3 min",
        improvement: "-95%",
      },
      {
        label: "After-Hours Inquiries",
        before: "0 captured",
        after: "14/month",
        improvement: "New",
      },
      {
        label: "New Clients (Q1)",
        before: "4 (referral only)",
        after: "10 total",
        improvement: "+150%",
      },
    ],
    services: ["AI-Powered Website", "AI Chat Agent", "Automated Follow-Up"],
    timeline: "4 weeks",
    featured: false,
    publishedAt: "2026-02-01",
  },
];

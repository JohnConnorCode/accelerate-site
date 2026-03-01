import type { CaseStudyFull } from "@/lib/types";

export const caseStudies: CaseStudyFull[] = [
  {
    id: "farrell-roofing",
    slug: "farrell-roofing",
    businessName: "Farrell Roofing",
    industry: "home_services",
    location: "Denver, CO",
    challenge:
      "Farrell Roofing was running a solid operation but leaving money on the table. Their website hadn't been updated in years, they were missing calls during jobs, and follow-up on estimates was entirely manual. The owner, Mike Farrell, estimated he was losing 3-5 leads per week just from slow response times and a website that didn't convert.",
    solution:
      "We rebuilt their website with local SEO targeting every service area within 30 miles of Denver. Added an AI chat agent trained on their services and pricing that books roof inspections 24/7. Set up automated follow-up sequences for every estimate request, so no lead sits unanswered for more than 2 minutes. Integrated everything with their existing CRM so the team has full visibility.",
    results:
      "Within 90 days, Farrell Roofing saw a 340% increase in online leads, cut their average response time from 4 hours to under 2 minutes, and booked an additional $47,000 in revenue directly attributable to the new system. The AI agent handles 60% of initial inquiries without any human involvement, freeing up the office staff to focus on scheduling and customer service.",
    testimonialQuote:
      "We went from missing half our calls to never missing a single lead. The AI agent books inspections while we are up on a roof. Best investment we have made in the business.",
    testimonialAuthor: "Mike Farrell",
    testimonialTitle: "Owner, Farrell Roofing",
    metrics: [
      {
        label: "Online Leads",
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
        before: "0 leads",
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
    id: "mitchell-law-group",
    slug: "mitchell-law-group",
    businessName: "Mitchell Law Group",
    industry: "law_firm",
    location: "Austin, TX",
    challenge:
      "Mitchell Law Group was spending heavily on Google Ads but converting less than 8% of ad clicks into consultations. Their intake process was manual, potential clients were waiting days for callbacks, and they had no way to capture leads outside business hours. For a personal injury firm where speed matters, they were losing cases to faster competitors.",
    solution:
      "Deployed a full AI intake system that qualifies potential clients instantly, asks the right screening questions, and books consultations directly on the attorneys' calendars. Built a new conversion-optimized website with dedicated landing pages for each practice area. Set up automated drip campaigns for leads that aren't ready to commit immediately.",
    results:
      "Consultation bookings increased by 185% within the first 60 days. Their cost per acquisition dropped from $340 to $125 because the AI agent pre-qualifies leads before they ever speak with an attorney. The firm signed 12 additional cases in the first quarter worth an estimated $180,000 in fees.",
    testimonialQuote:
      "The AI intake system is like having a paralegal that works 24/7. Our consultation-to-client conversion rate doubled because every lead that reaches an attorney is already qualified.",
    testimonialAuthor: "Sarah Mitchell",
    testimonialTitle: "Managing Partner, Mitchell Law Group",
    metrics: [
      {
        label: "Consultation Bookings",
        before: "20/month",
        after: "57/month",
        improvement: "+185%",
      },
      {
        label: "Cost Per Acquisition",
        before: "$340",
        after: "$125",
        improvement: "-63%",
      },
      {
        label: "Signed Cases (Q1)",
        before: "18",
        after: "30",
        improvement: "+67%",
      },
      {
        label: "After-Hours Intakes",
        before: "0",
        after: "22/month",
        improvement: "New",
      },
    ],
    services: ["AI Intake System", "Website Redesign", "Automated Follow-Up"],
    timeline: "5 weeks",
    featured: true,
    publishedAt: "2026-01-10",
  },
  {
    id: "compass-financial",
    slug: "compass-financial",
    businessName: "Compass Financial Advisors",
    industry: "professional_services",
    location: "Charlotte, NC",
    challenge:
      "Compass Financial was relying entirely on referrals and had zero digital lead generation. Their website was a basic template with no SEO, no lead capture, and no way for prospects to schedule consultations online. The two partners were spending 10+ hours per week on administrative tasks that could be automated.",
    solution:
      "Built a content-rich website optimized for high-intent financial planning keywords in the Charlotte area. Implemented an AI chat agent that answers common questions about services, fees, and process, then books discovery calls. Automated their onboarding paperwork, meeting reminders, and client communication workflows.",
    results:
      "Compass went from zero online leads to 28 qualified prospects per month within 90 days. The automated onboarding process saved each partner 6 hours per week. They brought on 8 new clients in the first quarter, representing approximately $2.4M in assets under management.",
    testimonialQuote:
      "We went from being invisible online to getting more qualified leads than we can handle. The automation saved us enough time to actually service all the new clients properly.",
    testimonialAuthor: "David Chen",
    testimonialTitle: "Partner, Compass Financial Advisors",
    metrics: [
      {
        label: "Online Leads",
        before: "0/month",
        after: "28/month",
        improvement: "From zero",
      },
      {
        label: "Admin Time (weekly)",
        before: "10+ hours each",
        after: "4 hours each",
        improvement: "-60%",
      },
      {
        label: "New Clients (Q1)",
        before: "3 (referral only)",
        after: "11 total",
        improvement: "+267%",
      },
      {
        label: "AUM Added (Q1)",
        before: "$800K",
        after: "$2.4M",
        improvement: "+200%",
      },
    ],
    services: ["AI-Powered Website", "AI Chat Agent", "Workflow Automation"],
    timeline: "4 weeks",
    featured: false,
    publishedAt: "2026-02-01",
  },
];

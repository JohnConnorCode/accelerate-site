import type { IntakeOption, IntakeQuestion, Industry } from "@/lib/types";

// ========================================
// DIGITAL TOOLS OPTIONS (Step 3)
// ========================================

export const digitalToolOptions: IntakeOption[] = [
  { value: "google_workspace", label: "Google Workspace", icon: "Mail" },
  { value: "microsoft_365", label: "Microsoft 365", icon: "Mail" },
  { value: "quickbooks", label: "QuickBooks / Xero", icon: "DollarSign" },
  { value: "crm_generic", label: "CRM (Salesforce, HubSpot, etc.)", icon: "Users" },
  { value: "email_marketing", label: "Email Marketing (Mailchimp, etc.)", icon: "Send" },
  { value: "social_media_tools", label: "Social Media Management", icon: "Share2" },
  { value: "scheduling_tool", label: "Scheduling Tool (Calendly, Acuity)", icon: "Calendar" },
  { value: "project_management", label: "Project Management (Asana, Trello)", icon: "CheckSquare" },
  { value: "payment_processing", label: "Payment Processing (Stripe, Square)", icon: "CreditCard" },
  { value: "none", label: "None of the above", icon: "X" },
];

// ========================================
// INDUSTRY-SPECIFIC QUESTIONS (Step 3)
// ========================================

export const industrySpecificQuestions: IntakeQuestion[] = [
  // Home Services
  {
    id: "hs_service_types",
    question: "What types of services do you offer?",
    type: "multi",
    options: [
      { value: "roofing", label: "Roofing" },
      { value: "plumbing", label: "Plumbing" },
      { value: "hvac", label: "HVAC" },
      { value: "electrical", label: "Electrical" },
      { value: "landscaping", label: "Landscaping" },
      { value: "general_contracting", label: "General Contracting" },
      { value: "painting", label: "Painting" },
      { value: "cleaning", label: "Cleaning Services" },
      { value: "pest_control", label: "Pest Control" },
      { value: "other_hs", label: "Other" },
    ],
    required: true,
    industries: ["home_services"],
  },
  {
    id: "hs_lead_sources",
    question: "Where do most of your inquiries come from today?",
    type: "multi",
    options: [
      { value: "word_of_mouth", label: "Word of mouth / referrals" },
      { value: "google_search", label: "Google search" },
      { value: "google_lsa", label: "Google Local Service Ads" },
      { value: "homeadvisor_angi", label: "HomeAdvisor / Angi" },
      { value: "nextdoor", label: "Nextdoor" },
      { value: "facebook", label: "Facebook / Instagram" },
      { value: "yard_signs", label: "Yard signs / truck wraps" },
      { value: "other_hs_leads", label: "Other" },
    ],
    required: true,
    industries: ["home_services"],
  },
  {
    id: "hs_estimates_per_week",
    question: "How many estimates or quotes do you send per week?",
    type: "single",
    options: [
      { value: "0_5", label: "0 to 5" },
      { value: "5_15", label: "5 to 15" },
      { value: "15_30", label: "15 to 30" },
      { value: "30_plus", label: "30+" },
    ],
    required: true,
    industries: ["home_services"],
  },

  // Law Firms
  {
    id: "lf_practice_areas",
    question: "What are your primary practice areas?",
    type: "multi",
    options: [
      { value: "personal_injury", label: "Personal Injury" },
      { value: "family_law", label: "Family Law" },
      { value: "criminal_defense", label: "Criminal Defense" },
      { value: "estate_planning", label: "Estate Planning" },
      { value: "business_law", label: "Business / Corporate Law" },
      { value: "immigration", label: "Immigration" },
      { value: "real_estate_law", label: "Real Estate Law" },
      { value: "employment_law", label: "Employment Law" },
      { value: "other_lf", label: "Other" },
    ],
    required: true,
    industries: ["law_firm"],
  },
  {
    id: "lf_intake_method",
    question: "How do you currently handle new client intake?",
    type: "single",
    options: [
      { value: "phone_only", label: "Phone calls only" },
      { value: "phone_email", label: "Phone and email" },
      { value: "web_form", label: "Website contact form" },
      { value: "intake_software", label: "Intake software (Clio Grow, Lawmatics, etc.)" },
      { value: "mixed_manual", label: "Mix of methods, mostly manual" },
    ],
    required: true,
    industries: ["law_firm"],
  },
  {
    id: "lf_cases_per_month",
    question: "How many new cases do you sign per month on average?",
    type: "single",
    options: [
      { value: "1_5", label: "1 to 5" },
      { value: "5_15", label: "5 to 15" },
      { value: "15_30", label: "15 to 30" },
      { value: "30_plus", label: "30+" },
    ],
    required: true,
    industries: ["law_firm"],
  },

  // Professional Services
  {
    id: "ps_service_type",
    question: "What type of professional service do you provide?",
    type: "single",
    options: [
      { value: "accounting_tax", label: "Accounting / Tax Preparation" },
      { value: "financial_advising", label: "Financial Advising / Wealth Management" },
      { value: "consulting", label: "Business Consulting" },
      { value: "insurance", label: "Insurance" },
      { value: "marketing_agency", label: "Marketing Agency" },
      { value: "it_services", label: "IT Services / MSP" },
      { value: "other_ps", label: "Other" },
    ],
    required: true,
    industries: ["professional_services"],
  },
  {
    id: "ps_client_acquisition",
    question: "How do you currently acquire new clients?",
    type: "multi",
    options: [
      { value: "referrals_only", label: "Referrals only" },
      { value: "networking", label: "Networking events" },
      { value: "organic_search", label: "Organic search / SEO" },
      { value: "paid_ads", label: "Paid advertising" },
      { value: "content_marketing", label: "Content marketing / thought leadership" },
      { value: "cold_outreach", label: "Cold outreach" },
      { value: "other_ps_acq", label: "Other" },
    ],
    required: true,
    industries: ["professional_services"],
  },
  {
    id: "ps_avg_client_value",
    question: "What is your average annual client value?",
    type: "single",
    options: [
      { value: "under_1k", label: "Under $1,000" },
      { value: "1k_5k", label: "$1,000 to $5,000" },
      { value: "5k_25k", label: "$5,000 to $25,000" },
      { value: "25k_plus", label: "$25,000+" },
    ],
    required: true,
    industries: ["professional_services"],
  },

  // Real Estate
  {
    id: "re_role",
    question: "What best describes your real estate role?",
    type: "single",
    options: [
      { value: "solo_agent", label: "Solo Agent" },
      { value: "team_lead", label: "Team Lead" },
      { value: "brokerage_owner", label: "Brokerage Owner" },
      { value: "property_management", label: "Property Management" },
      { value: "investor", label: "Investor" },
    ],
    required: true,
    industries: ["real_estate"],
  },
  {
    id: "re_lead_sources",
    question: "Where do most of your inquiries come from?",
    type: "multi",
    options: [
      { value: "zillow", label: "Zillow / Realtor.com" },
      { value: "sphere", label: "Sphere of influence / referrals" },
      { value: "facebook_ads", label: "Facebook / Instagram ads" },
      { value: "google_ads", label: "Google Ads" },
      { value: "open_houses", label: "Open houses" },
      { value: "farming", label: "Geographic farming / direct mail" },
      { value: "brokerage_leads", label: "Brokerage-provided referrals" },
      { value: "other_re_leads", label: "Other" },
    ],
    required: true,
    industries: ["real_estate"],
  },
  {
    id: "re_transactions_per_year",
    question: "How many transactions did you close in the last 12 months?",
    type: "single",
    options: [
      { value: "0_5", label: "0 to 5" },
      { value: "6_15", label: "6 to 15" },
      { value: "16_30", label: "16 to 30" },
      { value: "30_plus", label: "30+" },
    ],
    required: true,
    industries: ["real_estate"],
  },
  {
    id: "re_crm",
    question: "What CRM do you currently use?",
    type: "single",
    options: [
      { value: "follow_up_boss", label: "Follow Up Boss" },
      { value: "kvcore", label: "kvCORE" },
      { value: "lofty", label: "Lofty (formerly Chime)" },
      { value: "wise_agent", label: "Wise Agent" },
      { value: "other_crm", label: "Other CRM" },
      { value: "no_crm", label: "No CRM" },
    ],
    required: true,
    industries: ["real_estate"],
  },
];

// ========================================
// PAIN POINTS (Step 4)
// ========================================

export const basePainPoints: IntakeOption[] = [
  {
    value: "not_enough_leads",
    label: "Not enough inquiries coming in",
    description: "Your pipeline is inconsistent and you need more inbound opportunities.",
    icon: "TrendingDown",
  },
  {
    value: "slow_response",
    label: "Slow response time to new inquiries",
    description: "Inquiries sit for hours or days before someone follows up.",
    icon: "Clock",
  },
  {
    value: "manual_processes",
    label: "Too many manual processes",
    description: "Your team spends too much time on tasks that should be automated.",
    icon: "Repeat",
  },
  {
    value: "no_follow_up",
    label: "No consistent follow-up system",
    description: "Prospects and past clients fall through the cracks because follow-up is ad hoc.",
    icon: "UserX",
  },
  {
    value: "website_not_working",
    label: "Website doesn't generate business",
    description: "Your site exists but doesn't bring in inquiries, calls, or bookings.",
    icon: "Monitor",
  },
  {
    value: "poor_online_presence",
    label: "Weak online presence",
    description: "Hard to find on Google, few reviews, inconsistent social media.",
    icon: "Search",
  },
  {
    value: "no_tracking",
    label: "Can't track what's working",
    description: "No visibility into which marketing efforts actually produce results.",
    icon: "BarChart3",
  },
  {
    value: "scaling_difficulty",
    label: "Struggling to scale without adding headcount",
    description: "Growth means hiring more people, and you need a more efficient path.",
    icon: "TrendingUp",
  },
];

export const industryPainPoints: Record<Industry, IntakeOption[]> = {
  home_services: [
    {
      value: "missed_calls",
      label: "Missing calls while on the job",
      description: "You can't answer the phone when you're on a roof or under a sink.",
      icon: "PhoneMissed",
    },
    {
      value: "slow_estimates",
      label: "Estimates take too long to send",
      description: "By the time you send the quote, the homeowner already hired someone else.",
      icon: "FileText",
    },
    {
      value: "seasonal_slowdowns",
      label: "Seasonal revenue swings",
      description: "Feast or famine depending on the time of year.",
      icon: "Calendar",
    },
  ],
  law_firm: [
    {
      value: "intake_bottleneck",
      label: "Intake process is a bottleneck",
      description: "Potential clients wait too long to hear back after initial contact.",
      icon: "Clock",
    },
    {
      value: "after_hours_leads",
      label: "Losing after-hours inquiries",
      description: "Cases happen at all hours, but your office closes at 5.",
      icon: "Moon",
    },
    {
      value: "case_management_chaos",
      label: "Case management is disorganized",
      description: "Documents, deadlines, and client communication are scattered.",
      icon: "FolderOpen",
    },
  ],
  professional_services: [
    {
      value: "referral_dependent",
      label: "Too dependent on referrals",
      description: "Growth stalls when referrals slow down and you have no other pipeline.",
      icon: "Users",
    },
    {
      value: "scheduling_friction",
      label: "Scheduling is a back-and-forth nightmare",
      description: "It takes three emails to book one consultation.",
      icon: "CalendarX",
    },
    {
      value: "no_thought_leadership",
      label: "No thought leadership presence",
      description: "Your expertise isn't visible online to the people searching for it.",
      icon: "Award",
    },
  ],
  real_estate: [
    {
      value: "cold_leads",
      label: "Prospects go cold before follow-up",
      description: "By the time you reach out, they're already working with another agent.",
      icon: "Thermometer",
    },
    {
      value: "low_conversion",
      label: "Low inquiry-to-closing conversion",
      description: "Spending money on marketing but not converting enough inquiries to closings.",
      icon: "Target",
    },
    {
      value: "database_neglected",
      label: "Past client database is neglected",
      description: "People who should be sending referrals haven't heard from you in years.",
      icon: "Database",
    },
  ],
  other: [],
};

// ========================================
// GOALS (Step 5)
// ========================================

export const goalOptions: IntakeOption[] = [
  {
    value: "more_leads",
    label: "Generate more inquiries",
    description: "Increase the volume of inbound opportunities and calls.",
    icon: "TrendingUp",
  },
  {
    value: "faster_response",
    label: "Respond to inquiries faster",
    description: "Get back to prospects in minutes, not hours or days.",
    icon: "Zap",
  },
  {
    value: "automate_tasks",
    label: "Automate repetitive tasks",
    description: "Free up time by automating follow-ups, scheduling, and admin work.",
    icon: "Repeat",
  },
  {
    value: "improve_website",
    label: "Get a website that actually works",
    description: "Build or rebuild a site that ranks, converts, and represents your brand.",
    icon: "Globe",
  },
  {
    value: "better_follow_up",
    label: "Build a consistent follow-up system",
    description: "Stay in touch with prospects and clients without doing it all manually.",
    icon: "RefreshCw",
  },
  {
    value: "increase_revenue",
    label: "Increase revenue per client",
    description: "Upsell, cross-sell, and maximize the value of each relationship.",
    icon: "DollarSign",
  },
  {
    value: "track_roi",
    label: "Track marketing ROI",
    description: "Know exactly what's working and where your money is going.",
    icon: "BarChart3",
  },
  {
    value: "reduce_overhead",
    label: "Reduce admin overhead",
    description: "Handle more business without hiring more support staff.",
    icon: "Scissors",
  },
];

// ========================================
// TIMELINE OPTIONS (Step 6)
// ========================================

export const timelineOptions: IntakeOption[] = [
  {
    value: "asap",
    label: "As soon as possible",
    description: "I'm ready to move now. Let's get started this week.",
    icon: "Zap",
  },
  {
    value: "within_30",
    label: "Within 30 days",
    description: "I want to start soon but need a little time to plan.",
    icon: "Calendar",
  },
  {
    value: "within_90",
    label: "Within 90 days",
    description: "I'm planning ahead and want to have things in place this quarter.",
    icon: "CalendarDays",
  },
  {
    value: "exploring",
    label: "Just exploring options",
    description: "I'm researching solutions and not committed to a timeline yet.",
    icon: "Search",
  },
];

// ========================================
// BUDGET OPTIONS (Step 6)
// ========================================

export const budgetOptions: IntakeOption[] = [
  {
    value: "under_2500",
    label: "Under $2,500",
    description: "Looking for a focused solution with a tight budget.",
    priceHint: "Good for a single automation or basic website update.",
  },
  {
    value: "2500_5000",
    label: "$2,500 to $5,000",
    description: "Ready to invest in a solid foundation.",
    priceHint: "Covers a custom website or automation + AI agent setup.",
  },
  {
    value: "5000_10000",
    label: "$5,000 to $10,000",
    description: "Serious about growth and ready to invest.",
    priceHint: "Full website build plus automations and AI agents.",
  },
  {
    value: "10000_25000",
    label: "$10,000 to $25,000",
    description: "Building a comprehensive digital growth system.",
    priceHint: "Complete digital transformation with all services.",
  },
  {
    value: "25000_plus",
    label: "$25,000+",
    description: "Enterprise-level investment in digital infrastructure.",
    priceHint: "Custom enterprise solutions with dedicated support.",
  },
];

// ========================================
// WEBSITE STATUS OPTIONS (Step 3)
// ========================================

export const websiteStatusOptions: IntakeOption[] = [
  {
    value: "works_well",
    label: "I have a website and it works well",
    description: "My site is modern, fast, and brings in some business.",
    icon: "CheckCircle",
  },
  {
    value: "outdated",
    label: "I have a website but it's outdated",
    description: "It exists but hasn't been updated in years and looks dated.",
    icon: "AlertCircle",
  },
  {
    value: "no_leads",
    label: "I have a website but it doesn't generate business",
    description: "It looks decent but nobody fills out forms or calls from it.",
    icon: "XCircle",
  },
  {
    value: "no_website",
    label: "I don't have a website",
    description: "I need to build one from scratch.",
    icon: "PlusCircle",
  },
];

// ========================================
// INDUSTRY OPTIONS (Step 1)
// ========================================

export const industryOptions: IntakeOption[] = [
  {
    value: "home_services",
    label: "Home Services",
    description: "Contractors, plumbers, roofers, HVAC, electricians, landscapers.",
    icon: "Wrench",
  },
  {
    value: "law_firm",
    label: "Law Firm",
    description: "Personal injury, family law, criminal defense, estate planning.",
    icon: "Scale",
  },
  {
    value: "professional_services",
    label: "Professional Services",
    description: "Accountants, financial advisors, consultants, insurance agents.",
    icon: "Briefcase",
  },
  {
    value: "real_estate",
    label: "Real Estate",
    description: "Agents, brokerages, property management, investors.",
    icon: "Building2",
  },
  {
    value: "other",
    label: "Other",
    description: "My industry isn't listed here.",
    icon: "HelpCircle",
  },
];

// ========================================
// BUSINESS AGE OPTIONS (Step 2)
// ========================================

export const businessAgeOptions: IntakeOption[] = [
  { value: "less_than_1", label: "Less than 1 year" },
  { value: "1_to_3", label: "1 to 3 years" },
  { value: "3_to_10", label: "3 to 10 years" },
  { value: "10_plus", label: "10+ years" },
];

// ========================================
// TEAM SIZE OPTIONS (Step 2)
// ========================================

export const teamSizeOptions: IntakeOption[] = [
  { value: "just_me", label: "Just me" },
  { value: "2_to_5", label: "2 to 5 people" },
  { value: "6_to_15", label: "6 to 15 people" },
  { value: "16_to_50", label: "16 to 50 people" },
  { value: "50_plus", label: "50+ people" },
];

// ========================================
// REVENUE RANGE OPTIONS (Step 2)
// ========================================

export const revenueRangeOptions: IntakeOption[] = [
  { value: "under_100k", label: "Under $100K" },
  { value: "100k_500k", label: "$100K to $500K" },
  { value: "500k_1m", label: "$500K to $1M" },
  { value: "1m_5m", label: "$1M to $5M" },
  { value: "5m_plus", label: "$5M+" },
];

// ========================================
// CONTACT METHOD OPTIONS (Step 7)
// ========================================

export const contactMethodOptions: IntakeOption[] = [
  { value: "email", label: "Email", icon: "Mail" },
  { value: "text", label: "Text message", icon: "MessageSquare" },
];

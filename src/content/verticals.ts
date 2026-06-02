import type { Vertical } from "@/lib/types";

export const verticals: Vertical[] = [
  {
    id: "home_services",
    slug: "home-services",
    name: "Home Services",
    icon: "Wrench",
    shortDescription:
      "AI systems built for contractors, plumbers, roofers, HVAC techs, and home service pros who are tired of losing jobs to whoever responds first.",
    heroHeadlineWhite: "Stop losing jobs to whoever",
    heroHeadlineGold: "moves first.",
    heroSubheadline:
      "Home service businesses lose up to 40% of customers before anyone gets back to them. We capture every inquiry across every channel, send estimates instantly, and follow up on autopilot, so you book more jobs without hiring more office staff.",
    painPoints: [
      {
        icon: "DollarSign",
        title: "Slow response is killing your revenue",
        description:
          "You're on a roof or under a sink when a new job comes in. By the time you get back to them, that homeowner already hired someone else. Every inquiry that sits is $500 to $5,000 walking out the door.",
      },
      {
        icon: "Clock",
        title: "Estimates take too long to send",
        description:
          "You get home at 7 PM, still have five estimates to write up, and half of them go stale before you send them. Speed wins in home services, and manual quoting is slowing you down.",
      },
      {
        icon: "UserX",
        title: "No follow-up means no repeat business",
        description:
          "That customer you did great work for last year? They just hired someone else because they forgot your name. Without automated follow-up, you're leaving repeat revenue on the table.",
      },
      {
        icon: "Monitor",
        title: "Your website doesn't bring in business",
        description:
          "Your site looks like it was built in 2015 because it was. It doesn't rank on Google, it's slow on mobile, and it has no way to capture customers after hours. Meanwhile, your competitor's site is booking jobs at midnight.",
      },
    ],
    solutions: [
      {
        title: "Always-On Intake",
        description:
          "Capture every opportunity. AI responds the moment an inquiry lands, across web, text, chat, and phone, captures the job details, and books estimates on your calendar. It works nights, weekends, and holidays.",
        features: [
          "24/7 instant response across web, text, chat, and phone",
          "Automatic job detail capture",
          "Calendar integration for estimate scheduling",
          "Inquiry qualification before it hits your inbox",
          "Conversation logging and transcription",
        ],
      },
      {
        title: "Online Estimate Tool",
        description:
          "Let homeowners get a ballpark estimate right on your website. They answer a few questions, upload photos, and get a range in minutes. You get a pre-qualified customer with all the details.",
        features: [
          "Photo upload and job description intake",
          "Instant ballpark pricing based on your rates",
          "Automatic follow-up with detailed quote",
          "Integration with your estimating software",
          "Inquiry scoring based on job size and urgency",
        ],
      },
      {
        title: "Follow-Up Automation",
        description:
          "Automated email and text sequences that keep you top of mind. Seasonal reminders, review requests, referral asks, and maintenance nudges that run on autopilot.",
        features: [
          "Post-job review request sequences",
          "Seasonal maintenance reminders",
          "Referral reward automation",
          "Estimate follow-up until they say yes or no",
          "Re-engagement campaigns for past customers",
        ],
      },
      {
        title: "SEO-Optimized Website",
        description:
          "A fast, mobile-first website built to rank for the searches your customers actually make. 'Emergency plumber near me' or 'roof repair [your city]' level targeting.",
        features: [
          "Local SEO with Google Business optimization",
          "Service area pages for every city you cover",
          "Before-and-after project galleries",
          "One-click call and text buttons",
          "Real-time availability and booking",
        ],
      },
    ],
    caseStudy: {
      title: "How a Roofing Company Grew Online Inquiries 5x",
      description:
        "A roofing company was losing customers to competitors with faster response times. We deployed an AI intake system that responds across every channel, rebuilt their website with local SEO, and set up automated follow-up sequences. Within 90 days, their online inquiries grew from 10 to 50+ a month, average response time dropped to under 2 minutes, and revenue rose 75%.",
      metrics: [
        { label: "Increase in inquiries", value: "5x" },
        { label: "Response time", value: "Under 2 min" },
        { label: "After-hours inquiries", value: "35%" },
        { label: "Revenue, 90 days", value: "+75%" },
      ],
    },
    ctaText: "Get your free growth plan",
    ctaLink: "/contact",
  },
  {
    id: "law_firm",
    slug: "law-firms",
    name: "Law Firms",
    icon: "Scale",
    shortDescription:
      "AI-powered intake, follow-up, and client communication systems built for law firms that want to sign more clients without adding more admin staff.",
    heroHeadlineWhite: "Your next client reached out.",
    heroHeadlineGold: "Someone else replied first.",
    heroSubheadline:
      "Clients reach out after hours and hire the first firm to respond. Our AI intake responds instantly across every channel, qualifies the case, and gets retainers signed faster, so you sign more clients without adding admin staff.",
    painPoints: [
      {
        icon: "Clock",
        title: "Slow intake is costing you cases",
        description:
          "The average potential client contacts three firms. The first one to respond signs the case 78% of the time. If your intake process takes hours instead of minutes, you're handing cases to your competition.",
      },
      {
        icon: "Moon",
        title: "Silence after 5 PM costs you clients",
        description:
          "Accidents don't happen during business hours. DUIs happen at 2 AM. Divorces blow up on weekends. If every inquiry after 5 PM goes unanswered until morning, you're invisible when people need a lawyer most.",
      },
      {
        icon: "FileText",
        title: "Manual follow-up drops prospects",
        description:
          "Your paralegals are juggling case work and intake calls. Follow-up emails go unsent. Consultation reminders don't go out. Potential clients ghost because nobody stayed in touch.",
      },
      {
        icon: "Monitor",
        title: "Your website doesn't build trust",
        description:
          "A generic website with stock photos of gavels doesn't convince anyone to trust you with their case. Potential clients want to see results, read reviews, and start their intake before they ever reach out.",
      },
    ],
    solutions: [
      {
        title: "AI Intake System",
        description:
          "An intelligent intake system that qualifies cases 24/7. Potential clients answer practice-area-specific questions, upload documents, and get a same-day response. Your team gets a case summary before the first call.",
        features: [
          "Practice-area-specific intake questionnaires",
          "Document upload and organization",
          "Conflict check automation",
          "Case value pre-qualification",
          "Instant confirmation and next-step messaging",
        ],
      },
      {
        title: "Client Onboarding Automation",
        description:
          "From signed retainer to first meeting, every step is automated. Welcome packets, document requests, calendar links, and portal access go out automatically. Clients feel taken care of from day one.",
        features: [
          "Automated retainer and engagement letter delivery",
          "Document request sequences by case type",
          "Client portal setup and access",
          "Calendar scheduling for initial consultation",
          "Status update automation throughout the case",
        ],
      },
      {
        title: "Follow-Up Engine",
        description:
          "Automated sequences that nurture prospects who aren't ready to retain yet. Consultation reminders, check-ins after free consults, and re-engagement for stale prospects that might convert down the road.",
        features: [
          "Consultation reminder sequences (email, text, call)",
          "Post-consultation follow-up automation",
          "Stale prospect re-engagement campaigns",
          "Review and referral request automation",
          "Nurture sequences for undecided prospects",
        ],
      },
      {
        title: "Professional Legal Website",
        description:
          "A credibility-first website designed for your practice areas. Case results, attorney bios, client testimonials, and intake forms that make it easy for the right clients to find you and take action.",
        features: [
          "Practice area landing pages optimized for search",
          "Case results and verdict showcase",
          "Attorney bio pages with credentials and media",
          "Integrated intake forms by practice area",
          "Live chat with AI pre-qualification",
        ],
      },
    ],
    caseStudy: {
      title: "Personal Injury Firm Cuts Intake Time by 60%",
      description:
        "A three-attorney personal injury firm was losing cases to larger firms with faster intake. We deployed an AI intake system with after-hours coverage and automated follow-up. Their average intake time dropped from 48 hours to under 4 hours, and they signed 35% more cases in the first quarter.",
      metrics: [
        { label: "Intake time reduction", value: "60%" },
        { label: "More cases signed", value: "35%" },
        { label: "After-hours inquiries captured", value: "42%" },
        { label: "Client satisfaction score", value: "4.9/5" },
      ],
    },
    ctaText: "Get your free growth plan",
    ctaLink: "/contact",
  },
  {
    id: "professional_services",
    slug: "professional-services",
    name: "Professional Services",
    icon: "Briefcase",
    shortDescription:
      "Digital growth systems for accountants, consultants, financial advisors, and professional service firms that want to stop relying solely on referrals.",
    heroHeadlineWhite: "A pipeline you can",
    heroHeadlineGold: "predict.",
    heroSubheadline:
      "Referrals built your practice, but they're a ceiling. We turn your expertise into a steady, predictable client pipeline, so growth stops depending on who happens to mention your name.",
    painPoints: [
      {
        icon: "Users",
        title: "Referrals are unpredictable",
        description:
          "Referrals are great until they dry up. One slow quarter and you're scrambling. A real growth strategy means having a steady pipeline of inbound inquiries, not just waiting for the next referral to land.",
      },
      {
        icon: "CalendarX",
        title: "Scheduling is still manual",
        description:
          "The back-and-forth of scheduling consultations wastes hours every week. Prospects lose interest when it takes three emails just to find a time that works. Your calendar should fill itself.",
      },
      {
        icon: "UserX",
        title: "No client self-service",
        description:
          "Your clients call or email for every document request, status update, and invoice question. A client portal would save your team hours per week and make your clients happier at the same time.",
      },
      {
        icon: "SearchX",
        title: "No digital client acquisition",
        description:
          "Your competitors are running Google Ads, publishing content, and ranking for searches like 'CPA near me' or 'financial advisor [city].' If you're not showing up online, you're not in the consideration set.",
      },
    ],
    solutions: [
      {
        title: "Authority Website",
        description:
          "A professional website that positions you as the expert you are. Thought leadership content, service pages that rank, and a frictionless path from visitor to booked consultation.",
        features: [
          "Service pages optimized for local search",
          "Thought leadership blog with SEO strategy",
          "Team credential and certification showcases",
          "Online scheduling with calendar integration",
          "Downloadable resources (guides, checklists, assessments)",
        ],
      },
      {
        title: "Self-Service Scheduling",
        description:
          "Let prospects book consultations directly from your website, email signature, or social profiles. Automatic reminders reduce no-shows. Your calendar stays full without the back-and-forth.",
        features: [
          "Online booking with service-type selection",
          "Automatic email and SMS reminders",
          "Calendar sync (Google, Outlook, iCal)",
          "Buffer time and availability rules",
          "Intake form collection before the meeting",
        ],
      },
      {
        title: "Client Communication Automation",
        description:
          "Automated touchpoints that keep clients informed and engaged. Onboarding sequences, project updates, deadline reminders, and satisfaction surveys that run without manual effort.",
        features: [
          "New client onboarding sequences",
          "Project milestone notifications",
          "Deadline and renewal reminders",
          "NPS and satisfaction surveys",
          "Referral request automation",
        ],
      },
      {
        title: "Digital Client Pipeline",
        description:
          "A complete inbound marketing system. Content strategy, Google Ads management, email nurture sequences, and conversion tracking that turns online visitors into qualified consultations.",
        features: [
          "Google Ads setup and management",
          "Content marketing strategy and execution",
          "Email nurture sequences for warm prospects",
          "Conversion tracking and ROI reporting",
          "Monthly pipeline analytics and optimization",
        ],
      },
    ],
    caseStudy: {
      title: "Accounting Firm Doubles Online Inquiries in 6 Months",
      description:
        "A mid-size accounting firm relied entirely on referrals and hadn't updated their website in five years. We rebuilt their digital presence with service-specific landing pages, launched a Google Ads campaign, and automated their consultation booking. Within six months, online inquiries accounted for 45% of new clients.",
      metrics: [
        { label: "Online inquiries increase", value: "2x" },
        { label: "New clients from digital", value: "45%" },
        { label: "Scheduling time saved", value: "8 hrs/week" },
        { label: "Cost per inquiry", value: "$32" },
      ],
    },
    ctaText: "Get your free growth plan",
    ctaLink: "/contact",
  },
  {
    id: "real_estate",
    slug: "real-estate",
    name: "Real Estate",
    icon: "Building2",
    shortDescription:
      "Client capture, nurture, and conversion systems for real estate agents and brokerages who are tired of paying for inquiries that never convert.",
    heroHeadlineWhite: "Every slow reply is a",
    heroHeadlineGold: "lost commission.",
    heroSubheadline:
      "You spend thousands on Zillow, Realtor.com, and Facebook ads, then lose those inquiries to slow follow-up. We capture, qualify, and convert prospects before they go cold, so less chasing means more closings.",
    painPoints: [
      {
        icon: "Thermometer",
        title: "Prospects go cold in hours",
        description:
          "A new inquiry from Zillow has a 5-minute window before they move on. If your response is a generic email that arrives 3 hours later, that prospect is already talking to another agent.",
      },
      {
        icon: "DollarSign",
        title: "Ad spend with no ROI tracking",
        description:
          "You're spending $2,000 a month on Facebook ads but have no idea which campaigns actually generate closings. Without end-to-end tracking, you're guessing with your marketing budget.",
      },
      {
        icon: "RefreshCw",
        title: "No long-term nurture system",
        description:
          "The average home buyer takes 6 to 12 months to transact. If you're only following up for a week, you're losing deals to agents who stay in touch for the full journey.",
      },
      {
        icon: "Database",
        title: "Your database is a mess",
        description:
          "Contacts in your phone, some in a spreadsheet, a few in your CRM. Past clients who should be sending you referrals haven't heard from you in two years. Your database should be your biggest asset, not your biggest liability.",
      },
    ],
    solutions: [
      {
        title: "Instant Response System",
        description:
          "AI-powered response that reaches new prospects within 60 seconds via text and email. Pre-qualifying questions, property matches, and appointment booking happen automatically before you even see the notification.",
        features: [
          "Sub-60-second text and email response",
          "AI pre-qualification conversation",
          "Automatic property matching from MLS",
          "Appointment scheduling integration",
          "Source tracking and attribution",
        ],
      },
      {
        title: "Long-Term Nurture Sequences",
        description:
          "12-month email and text campaigns that keep you in front of prospects until they're ready to move. Market updates, property alerts, and value-added content that positions you as their agent.",
        features: [
          "Buyer journey drip campaigns (12+ months)",
          "Automated market update emails",
          "Property alert integration",
          "Anniversary and home-iversary touchpoints",
          "Re-engagement sequences for stale prospects",
        ],
      },
      {
        title: "Listing Marketing Automation",
        description:
          "From the moment a listing goes live, your marketing engine kicks in. Social media posts, just-listed emails, open house invites, and neighborhood targeting all run automatically.",
        features: [
          "Automated just-listed/just-sold campaigns",
          "Social media post generation",
          "Open house promotion and registration",
          "Neighborhood farming automation",
          "Seller reporting with showing and engagement data",
        ],
      },
      {
        title: "Agent Website with IDX",
        description:
          "A modern agent website with IDX property search, neighborhood guides, and client capture that turns visitors into registered contacts. Designed to rank for hyperlocal searches in your market.",
        features: [
          "IDX property search integration",
          "Neighborhood and community guide pages",
          "Seller home valuation landing pages",
          "Forced registration with smart triggers",
          "Hyperlocal SEO for your target neighborhoods",
        ],
      },
    ],
    caseStudy: {
      title: "Solo Agent Increases Closings by 25% with AI Automation",
      description:
        "A solo agent in a competitive metro market was spending $3,000/month on ads but only converting 2%. We implemented instant response, a 12-month nurture sequence, and end-to-end ROI tracking. Within a year, their conversion rate hit 5% and they closed 25% more deals with the same ad spend.",
      metrics: [
        { label: "More closings", value: "25%" },
        { label: "Inquiry conversion rate", value: "5% (was 2%)" },
        { label: "Average response time", value: "45 seconds" },
        { label: "ROI on ad spend", value: "4.2x" },
      ],
    },
    ctaText: "Get your free growth plan",
    ctaLink: "/contact",
  },
];

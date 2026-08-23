import type { Vertical } from "@/lib/types";

export const verticals: Vertical[] = [
  {
    id: "home_services",
    slug: "home-services",
    name: "Home Services",
    icon: "Wrench",
    shortDescription:
      "AI systems built for contractors, plumbers, roofers, HVAC techs, and home service pros who want the office running at the crew's standard.",
    heroHeadlineWhite: "Your best estimator",
    heroHeadlineGold: "is in a truck right now.",
    heroSubheadline:
      "A trade business runs on judgment that lives in two or three heads: how to price the job, which inquiry is worth the drive, when to chase the estimate. We encode that judgment into systems that run around the clock, so the office holds your standard while the crew builds.",
    painPoints: [
      {
        icon: "DollarSign",
        title: "Slow response is killing your revenue",
        description:
          "You're on a roof or under a sink when a new job comes in, and everything about it waits for you: the callback, the price, the schedule. The business moves at the speed of your free hands.",
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
        title: "Answered in 40 Seconds",
        description:
          "Capture every opportunity. AI responds the moment an inquiry lands, across web, text, chat, and phone, captures the job details, and books estimates on your calendar. It works nights, weekends, and holidays.",
        features: [
          "Under 60 seconds on web, text, chat, and phone. Nights, weekends, holidays.",
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
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "law_firm",
    slug: "law-firms",
    name: "Law Firms",
    icon: "Scale",
    shortDescription:
      "AI-powered intake, follow-up, and client communication systems built for law firms that want to sign more clients without adding more admin staff.",
    heroHeadlineWhite: "You bill for judgment.",
    heroHeadlineGold: "The week goes to process.",
    heroSubheadline:
      "Intake, conflict checks, engagement letters, status calls: process fills a firm's week, and lawyers end up running it at lawyer rates. We build systems around how your firm actually practices, run them for you, and return the hours to the work that bills.",
    painPoints: [
      {
        icon: "Clock",
        title: "Slow intake is costing you cases",
        description:
          "A potential client calls three firms. The one that picks up gets the case. If your intake runs on business hours, you are the second call. If your intake process takes hours instead of minutes, you're handing cases to your competition.",
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
          "Intake that qualifies the case before you read it. 2 AM DUI, Saturday divorce, same response. Potential clients answer practice-area-specific questions, upload documents, and get a same-day response. Your team gets a case summary before the first call.",
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
          "Case results and verdicts, by practice area",
          "Attorney bio pages with credentials and media",
          "Integrated intake forms by practice area",
          "Live chat with AI pre-qualification",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "professional_services",
    slug: "professional-services",
    name: "Professional Services",
    icon: "Briefcase",
    shortDescription:
      "AI intake, scheduling, and follow-up for accountants, consultants, and financial advisors who want a pipeline that does not depend on referrals.",
    heroHeadlineWhite: "Your method is the firm.",
    heroHeadlineGold: "It lives in three calendars.",
    heroSubheadline:
      "How your best people scope, price, and deliver is the firm's real asset, and it usually exists nowhere but their heads and inboxes. We turn that method into systems: intake that qualifies the way they would, follow-through that never waits on a busy partner, records that stay current on their own.",
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
          "Credentials and certifications, per person",
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
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "real_estate",
    slug: "real-estate",
    name: "Real Estate",
    icon: "Building2",
    shortDescription:
      "Client capture, nurture, and long-memory pipeline systems for agents and brokerages that want every relationship worked, not just the hot ones.",
    heroHeadlineWhite: "The deal you close in June",
    heroHeadlineGold: "was built in February.",
    heroSubheadline:
      "A real estate business is a long memory: who is about to list, which buyer went quiet, whose lease ends in the spring. We build systems that keep that memory working, so every relationship stays warm and every showing is followed all the way through while you are in the rooms where deals happen.",
    painPoints: [
      {
        icon: "Thermometer",
        title: "Prospects go cold in hours",
        description:
          "A portal inquiry goes to four agents at once. Reply while they are still looking, or read about the closing. If your response is a generic email that arrives 3 hours later, that prospect is already talking to another agent.",
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
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "manufacturing",
    slug: "manufacturing",
    name: "Manufacturing",
    icon: "Factory",
    opsLabel: "a manufacturer",
    shortDescription:
      "AI systems for manufacturers and industrial shops that want the estimator's knowledge in every quote and every open order visible to the whole floor.",
    heroHeadlineWhite: "Your quotes carry",
    heroHeadlineGold: "thirty years of scar tissue.",
    heroSubheadline:
      "Estimating draws on everything the shop has learned: material quirks, machine capacity, the tolerances that bite. We encode that knowledge into quoting and order tracking, so every RFQ gets the shop's full intelligence and every open order lives where the whole floor can see it.",
    painPoints: [
      {
        icon: "DollarSign",
        title: "Quotes go out too slow to win the order",
        description:
          "An RFQ lands by email or through a portal and sits until someone has time to price it. By the time your quote goes out, the buyer already has three others on the desk and picked the fastest one.",
      },
      {
        icon: "Clock",
        title: "Purchase orders and change orders live in someone's inbox",
        description:
          "A PO comes in, a spec changes, a ship date moves. If that only exists in an email thread, the shop floor finds out when it is already a problem.",
      },
      {
        icon: "UserX",
        title: "Supplier follow-up is whoever remembers to call",
        description:
          "A late shipment from a supplier can shut down a line. Chasing that down usually depends on one person noticing and picking up the phone, not a system that flags it automatically.",
      },
      {
        icon: "Monitor",
        title: "Your website doesn't help a buyer qualify you",
        description:
          "An engineer or buyer searching for a shop that can run their part finds a site with no capabilities list, no tolerances, no way to submit a drawing. They move to the next search result.",
      },
    ],
    solutions: [
      {
        title: "Instant RFQ Capture and Routing",
        description:
          "Every inquiry, whether it lands by email, through a portal, or as a dropped-in drawing, is logged, routed to the right estimator, and acknowledged automatically so the buyer knows it was received.",
        features: [
          "RFQ intake from email, web form, and file upload",
          "Automatic routing to the right estimator by part type",
          "Instant acknowledgment sent to the buyer",
          "Drawing and spec attachment logged against the job",
          "Response-time tracking so nothing goes stale",
        ],
      },
      {
        title: "Quote and Order Tracking",
        description:
          "Every open quote, PO, and change order in one place, so a purchasing agent's question about status gets answered in a minute instead of a search through email.",
        features: [
          "Quote status visible from submitted to won or lost",
          "Automatic follow-up on quotes going cold",
          "PO and change-order log tied to the job number",
          "Ship-date tracking with automatic alerts on slippage",
          "Win-rate reporting by customer and part type",
        ],
      },
      {
        title: "Supplier and Vendor Follow-Up",
        description:
          "Automated check-ins on outstanding purchase orders to suppliers, so a late shipment gets caught before it stops the line, not after.",
        features: [
          "Automated status requests on open supplier POs",
          "Escalation alerts when a ship date is at risk",
          "Vendor performance history by on-time rate",
          "Material shortage flagged against affected jobs",
          "Reorder reminders on recurring materials",
        ],
      },
      {
        title: "A Website That Helps a Buyer Qualify You",
        description:
          "A fast, technical site built for the engineer or buyer doing the search: capabilities, tolerances, certifications, and a way to submit a drawing without a phone call.",
        features: [
          "Capabilities and equipment list built for search",
          "Certifications and quality documentation up front",
          "Drawing upload for instant quote requests",
          "Case examples by part type and industry",
          "Mobile-first for a buyer searching from the floor",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "startups",
    slug: "startups",
    name: "Startups",
    icon: "Rocket",
    shortDescription:
      "AI systems for early-stage teams that need investor updates, user onboarding, and support running without a full ops team to run them.",
    heroHeadlineWhite: "Ops debt compounds",
    heroHeadlineGold: "faster than tech debt.",
    heroSubheadline:
      "Every early company runs on a heroic spreadsheet and three people's memories, and it works right up until the moment it matters most. We build the operating layer underneath: investor updates, onboarding, support, the systems of record, so founder hours go to product and customers while the company stays coherent as it grows.",
    painPoints: [
      {
        icon: "Clock",
        title: "Investor updates get written the night before they're late",
        description:
          "A monthly update is easy to write when the metrics are already pulled together. It is a scramble when someone has to go find them across four tools first.",
      },
      {
        icon: "UserX",
        title: "New users get a generic email, then silence",
        description:
          "Onboarding a new signup, a new customer, or a new hire usually means one templated email and no follow-through. The people who needed a nudge on day three never got one.",
      },
      {
        icon: "Database",
        title: "The business runs on a spreadsheet somebody built once",
        description:
          "Customer status, pipeline, and open tasks live in a doc that one person maintains from memory. When that person is heads-down or leaves, the business loses its own state.",
      },
      {
        icon: "SearchX",
        title: "Support and product feedback go nowhere",
        description:
          "A user reports a bug or asks a question in Slack, Intercom, or an email, and it either gets answered once and forgotten or never routed to whoever should see it.",
      },
    ],
    solutions: [
      {
        title: "Investor and Stakeholder Updates",
        description:
          "Metrics pulled automatically from the tools you already use, drafted into an update you edit instead of build from scratch.",
        features: [
          "Metrics pulled from your existing tools automatically",
          "Update drafted on a schedule, ready to review and send",
          "Historical trend included, not just the current number",
          "One version for investors, one for the internal team",
          "Sent on the day you pick, not the day you remembered",
        ],
      },
      {
        title: "Onboarding and Lifecycle Automation",
        description:
          "A new signup, customer, or teammate gets the right sequence automatically: the welcome, the follow-up, the check-in at the moment they are most likely to need one.",
        features: [
          "Automated onboarding sequences by user type",
          "Follow-up triggered by behavior, not just a fixed schedule",
          "Internal alerts when a new customer goes quiet",
          "New-hire onboarding checklist that runs itself",
          "Every touch logged against the person, not lost in an inbox",
        ],
      },
      {
        title: "One Operating System Instead of Six Tools",
        description:
          "Customers, tasks, pipeline, and notes in one place your whole team can see, replacing the spreadsheet one person maintains from memory.",
        features: [
          "Contacts, deals, and tasks in a single system",
          "Custom fields for whatever your business actually tracks",
          "Full history per customer, searchable a year later",
          "Role-based access as the team grows past three people",
          "Exportable, so it is always yours",
        ],
      },
      {
        title: "Support and Feedback Routing",
        description:
          "Every support message and piece of product feedback captured, tagged, and routed to whoever should see it, so nothing said by a user disappears into a channel nobody reads later.",
        features: [
          "Support intake from email, chat, or a form",
          "Automatic tagging by issue type and urgency",
          "Feedback routed to product, not lost in a chat channel",
          "Response-time tracking on open tickets",
          "Weekly digest of what users are actually saying",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "medical_dental",
    slug: "medical-dental",
    name: "Medical & Dental Practices",
    icon: "Stethoscope",
    shortDescription:
      "AI intake, scheduling, and recall systems for medical and dental practices that want the appointment book solid and the front desk out of the paperwork.",
    heroHeadlineWhite: "Your entire P&L",
    heroHeadlineGold: "is the appointment book.",
    heroSubheadline:
      "Chair time, recalls, and insurance friction decide a practice's year more than anything clinical. We build the systems that keep the book solid: verification and intake handled before the visit, recalls that actually land, reminders tuned to the patients who miss, and records the front desk no longer has to carry.",
    painPoints: [
      {
        icon: "PhoneMissed",
        title: "A slow response is a patient calling the next practice",
        description:
          "Your front desk is with a patient, on hold with insurance, or gone for lunch, and the person calling to book does not leave a voicemail. They call the next name on their list instead.",
      },
      {
        icon: "CalendarX",
        title: "No-shows leave chairs empty and revenue on the table",
        description:
          "A patient books, forgets, and does not show. A single unfilled slot on a hygienist's or provider's schedule is revenue that is gone for good, not just delayed.",
      },
      {
        icon: "FileText",
        title: "Intake and insurance verification eat staff hours",
        description:
          "New-patient paperwork, insurance verification, and history forms handled by phone or in the waiting room slow down the front desk and the first visit both.",
      },
      {
        icon: "RefreshCw",
        title: "Recall and hygiene reminders don't go out consistently",
        description:
          "The patient due for a six-month cleaning or an annual visit should get a reminder on schedule. When that depends on someone remembering to run a report, it happens inconsistently, and the chair sits empty instead.",
      },
    ],
    solutions: [
      {
        title: "Instant Patient Response",
        description:
          "Every call, text, and web inquiry gets an immediate reply and a path to book, so a new patient never gets far enough to call the next practice.",
        features: [
          "Sub-60-second response on calls, text, and web",
          "After-hours and weekend coverage",
          "Symptom and urgency triage before it hits your schedule",
          "Direct booking into open appointment slots",
          "New-patient intake started before the first visit",
        ],
      },
      {
        title: "No-Show Reduction",
        description:
          "Automated reminders across text, email, and call that actually cut no-shows, with easy rebooking when a patient needs to move their appointment instead of skipping it.",
        features: [
          "Multi-channel appointment reminders on a set schedule",
          "One-tap confirm or reschedule from the reminder itself",
          "Waitlist automatically offered an opening when one appears",
          "No-show pattern flagged so you can address it directly",
          "Day-before and morning-of reminder sequencing",
        ],
      },
      {
        title: "Intake and Insurance Automation",
        description:
          "New-patient forms, history, and insurance verification handled before the visit, so the first appointment starts with the exam instead of the paperwork.",
        features: [
          "Digital intake forms sent and completed before arrival",
          "Insurance verification run automatically ahead of the visit",
          "History and consent forms stored and searchable",
          "Front-desk time freed from repetitive data entry",
          "Referral and prior-provider records requested automatically",
        ],
      },
      {
        title: "Recall and Retention",
        description:
          "Recall and hygiene reminders that go out on schedule every time, plus review requests after a good visit, so the practice fills its own calendar instead of relying on new-patient marketing alone.",
        features: [
          "Recall reminders triggered automatically by visit history",
          "Review requests sent after a completed appointment",
          "Reactivation outreach to patients who have gone quiet",
          "Family and household reminders grouped together",
          "Reporting on recall and retention rates over time",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "insurance_agencies",
    slug: "insurance-agencies",
    name: "Insurance Agencies",
    icon: "ShieldCheck",
    opsLabel: "an insurance agency",
    shortDescription:
      "AI quoting, renewal, and follow-up systems for independent agencies that want the whole book worked on time instead of from memory.",
    heroHeadlineWhite: "The book pays you",
    heroHeadlineGold: "for remembering.",
    heroSubheadline:
      "An agency's product is attention: the renewal worked sixty days out, the life event that changes a policy, the coverage gap nobody asked about. We build systems that hold the whole book in working memory, so every renewal is early, every quote is followed through, and every client hears from you before they have a reason to shop.",
    painPoints: [
      {
        icon: "Clock",
        title: "Quote requests go stale before anyone replies",
        description:
          "A form fill or a call about a new policy sits in a queue until someone has a free hour. By then the prospect has already gotten a quote from an agency that answered faster.",
      },
      {
        icon: "RefreshCw",
        title: "Renewals get missed, and a client finds out at the worst time",
        description:
          "A renewal date passing unnoticed means a client discovers a lapse when they need coverage, not before. That is the kind of mistake that ends a relationship, not just a policy.",
      },
      {
        icon: "FileText",
        title: "Policy changes and claims follow-up are manual",
        description:
          "An address change, a new driver, a claim in progress. Each one is a phone call and a note somewhere, easy to lose track of when an agent is juggling two hundred active clients.",
      },
      {
        icon: "Users",
        title: "Cross-sell and account rounding never happens systematically",
        description:
          "A client with just an auto policy who should also have renters or life coverage rarely gets asked, because nobody has a system that flags it. That is revenue sitting in your own book of business.",
      },
    ],
    solutions: [
      {
        title: "Instant Quote Response",
        description:
          "New quote requests get an immediate response and the right next step, across web, phone, and referral, so speed stops being the reason you lose the account.",
        features: [
          "Sub-60-second response on new quote requests",
          "Automatic routing to the right line of business",
          "Pre-qualification questions before the session",
          "Carrier and coverage matching based on client profile",
          "Follow-up sequence until the prospect answers either way",
        ],
      },
      {
        title: "Renewal and Retention Automation",
        description:
          "Every policy's renewal date tracked and worked automatically, so a lapse never happens because a date got missed on a busy week.",
        features: [
          "Renewal reminders sequenced ahead of the actual date",
          "Automatic outreach for policies at risk of lapsing",
          "Coverage review scheduled before major renewals",
          "Client-facing reminders alongside internal alerts",
          "Retention reporting by book and by producer",
        ],
      },
      {
        title: "Policy Service and Claims Follow-Up",
        description:
          "Endorsements, changes, and claims tracked from first call to resolution, so nothing sits in a note nobody reads again.",
        features: [
          "Policy change requests logged and tracked to completion",
          "Claims status followed up automatically with the carrier",
          "Client updated at each stage without a manual call",
          "Document and endorsement history per policy",
          "Escalation flagged when a claim stalls",
        ],
      },
      {
        title: "Cross-Sell and Account Rounding",
        description:
          "Every client's coverage gaps surfaced automatically, so account rounding is a list you work from instead of something you have to remember to think about.",
        features: [
          "Coverage-gap detection across a client's full policy set",
          "Automated outreach on the highest-value gaps first",
          "Life-event triggers, like a new driver or new home, flagged for outreach",
          "Rounding performance tracked by producer",
          "Referral requests sent after a well-handled claim",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "auto_dealers",
    slug: "auto-dealers",
    name: "Auto Dealers & Service Centers",
    icon: "Car",
    opsLabel: "an auto dealer",
    shortDescription:
      "AI systems for dealerships and service centers that want both sides of the store connected, the bays full, and every open deal worked to a close.",
    heroHeadlineWhite: "The service lane knows",
    heroHeadlineGold: "who buys next.",
    heroSubheadline:
      "A dealership already holds everything it needs to sell the next car: service history, lease timelines, the customer sitting in the waiting room right now. We build the systems that connect both sides of the store, keep the bays full, and start the right conversation with the right customer at the right time.",
    painPoints: [
      {
        icon: "Thermometer",
        title: "Internet inquiries go cold in minutes, not hours",
        description:
          "A shopper who fills out a form on your site or a listing site is doing the same thing on two other lots at once. The first real response usually gets the appointment.",
      },
      {
        icon: "CalendarX",
        title: "The service bay has empty slots that shouldn't exist",
        description:
          "A car due for maintenance should get a reminder before the owner forgets. When that depends on someone running a list manually, slots go unfilled that a reminder would have booked.",
      },
      {
        icon: "UserX",
        title: "Deals that didn't close today just disappear",
        description:
          "A shopper who didn't buy on the lot visit rarely gets a real follow-up. Without a system tracking it, that is a sale walking out the door for good instead of coming back in three weeks.",
      },
      {
        icon: "DollarSign",
        title: "Trade-in and equity opportunities go unworked",
        description:
          "Customers sitting on positive equity or coming up on a lease end are exactly who should be hearing from you first. Most stores have no system flagging who those people are.",
      },
    ],
    solutions: [
      {
        title: "Instant Inquiry Response",
        description:
          "Every internet inquiry, call, and walk-in visit answered and qualified the way your best salesperson would, then moved toward an appointment with the history attached.",
        features: [
          "Sub-60-second response on web, text, and phone inquiries",
          "Trade-in and financing pre-qualification before the visit",
          "Appointment booking straight into your calendar",
          "Inquiry source tracking so you know what's actually working",
          "After-hours coverage so nights and weekends still convert",
        ],
      },
      {
        title: "Service Scheduling and Reminders",
        description:
          "Maintenance and recall reminders that go out automatically and actually get booked, keeping the service bay full without a service advisor running lists by hand.",
        features: [
          "Mileage and time-based service reminders",
          "One-tap booking straight from the reminder",
          "Recall and open campaign alerts matched to VIN",
          "Loaner and shuttle scheduling coordinated automatically",
          "No-show follow-up to get the slot rebooked fast",
        ],
      },
      {
        title: "Deal Follow-Up That Doesn't Quit",
        description:
          "Every unclosed deal followed up automatically until the shopper buys somewhere or says no, instead of going cold the day after the lot visit.",
        features: [
          "Automated follow-up sequences for unclosed deals",
          "Inventory alerts when a matching vehicle arrives",
          "Price-drop and incentive notifications to past shoppers",
          "CRM view of every deal's real status, not a guess",
          "Sales performance reporting by rep and by source",
        ],
      },
      {
        title: "Equity Mining and Loyalty",
        description:
          "Customers with positive equity or an approaching lease end surfaced automatically, so your team is working the best opportunities in your own database first.",
        features: [
          "Automatic equity and lease-end detection",
          "Targeted outreach to the highest-opportunity customers",
          "Service-to-sales handoff when a customer is ready to trade",
          "Review requests sent after a completed purchase or service visit",
          "Loyalty and repeat-buyer tracking across service and sales",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
  },
  {
    id: "nonprofits",
    slug: "nonprofits",
    name: "Nonprofits",
    icon: "HeartHandshake",
    shortDescription:
      "Custom AI systems for nonprofits that turn first-time donors into second-time donors, keep every supporter followed up with, and give a stretched team its hours back. Built and run by us.",
    heroHeadlineWhite: "Your donors did not lose interest.",
    heroHeadlineGold: "They just never heard from you again.",
    heroSubheadline:
      "Fewer than one in five first-time donors ever gives a second gift. That is rarely about generosity. It is capacity: the thank-you and the second ask land on a team already at its limit. We build custom AI systems that steward every donor on time and in your voice, then run them for you.",
    painPoints: [
      {
        icon: "RefreshCw",
        title: "The second gift almost never happens",
        description:
          "Sector-wide, first-time donor retention sits at about 19 percent. But donors who give a second time retain at nearly 60 percent. That one conversion is the highest-value moment in your entire fundraising year, and it is usually lost to a follow-up nobody had time to send.",
      },
      {
        icon: "Monitor",
        title: "The platform nobody had time to configure",
        description:
          "There is a tool in the stack with AI in the name and a login nobody has opened since the demo. Somebody has to design the workflow, connect it to your donor data, and keep it running through the weeks your team is underwater.",
      },
      {
        icon: "Users",
        title: "The team is past capacity, not underperforming",
        description:
          "Most nonprofit staff report carrying more responsibility than they have support for, and many organizations have cut headcount while demand went up. Stewardship is always the first thing to slip, because it is the only work with no immediate deadline attached to it.",
      },
      {
        icon: "FileText",
        title: "Reporting eats the time meant for the mission",
        description:
          "Board packets, grant reports, and funder updates get rebuilt by hand every cycle from spreadsheets that disagree with each other. It is hours of skilled work that produces no new support, and it comes straight out of program time.",
      },
    ],
    solutions: [
      {
        title: "Every Donor Thanked and Stewarded On Time",
        description:
          "The moment a gift arrives, the thank-you goes out, the donor record updates, and the second-gift sequence begins. Your team writes the voice once and approves it. After that it runs whether or not anyone has capacity that week.",
        features: [
          "Immediate, personal thank-you on every gift",
          "A second-gift journey built specifically for first-time donors",
          "Lapsed and at-risk supporters surfaced before they are gone",
          "Recurring giving invitations timed to donor behavior, not the calendar",
          "Every message reviewed against your voice, never sent from a generic template",
        ],
      },
      {
        title: "Every Inquiry Answered, In Your Voice",
        description:
          "Website questions, volunteer sign-ups, program referrals, and partnership requests all get a real answer quickly, then reach the right person with the context already attached. Nothing sits in a shared inbox over a weekend.",
        features: [
          "Web, form, chat, and email inquiries captured in one place",
          "Answers grounded in your actual programs and eligibility, not invented",
          "Routing to the right staff member with full history attached",
          "Volunteer and partner interest captured and followed up automatically",
          "Anything sensitive or unclear handed to a person instead of guessed at",
        ],
      },
      {
        title: "One Clean Donor Record",
        description:
          "Households, workplace gifts, event attendees, and volunteers stop living as four separate half-records. We resolve them into one supporter with a full history, and refuse to merge anything ambiguous rather than guessing.",
        features: [
          "Duplicate supporters resolved into one record with full giving history",
          "Ambiguous matches sent for human review instead of silently merged",
          "Giving, volunteering, and event attendance visible on one timeline",
          "Works alongside your existing CRM rather than replacing it",
          "Every change auditable, so you can always see what moved and why",
        ],
      },
      {
        title: "Board and Funder Reporting That Builds Itself",
        description:
          "Retention, acquisition, recurring revenue, and campaign performance calculated from the same underlying records every time, so the number in the board packet matches the number in the system.",
        features: [
          "Donor retention and lapse rates tracked continuously",
          "Revenue by source, campaign, and appeal without manual reconciliation",
          "Board-ready summaries generated from live data",
          "Grant and funder reporting assembled from the same source of truth",
          "Gaps and data quality problems shown rather than quietly averaged away",
        ],
      },
    ],
    ctaText: "Book a 20-minute call",
    ctaLink: "/contact",
  },
];

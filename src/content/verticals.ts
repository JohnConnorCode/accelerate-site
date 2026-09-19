import type { Vertical } from "@/lib/types";

export const verticals: Vertical[] = [
  {
    id: "home_services",
    slug: "home-services",
    name: "Home Services",
    icon: "Wrench",
    shortDescription:
      "AI systems built for contractors, plumbers, roofers, HVAC techs, and home service pros who want the office running at the crew's standard.",
    heroHeadlineWhite: "Give the office work a system.",
    heroHeadlineGold: "Keep the crew on the work.",
    heroSubheadline:
      "We learn how jobs move from the first inquiry through scheduling, estimating, field work, payment, and follow-up. Then we build and run the AI, automation, or custom tools that remove the most office work without disrupting the crew.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Turn a roof inspection request into an owned opportunity with property context and a clear callback.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Use a won roofing job to assign site access, materials and start-date checks before the crew arrives.",
      },
    ],
    solutions: [
      {
        title: "Follow a roofing inquiry through to an estimate",
        description:
          "Turn a roof inspection request into an owned opportunity with property context and a clear callback.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Prepare the team for a newly won job",
        description:
          "Use a won roofing job to assign site access, materials and start-date checks before the crew arrives.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Turn a roof inspection request into an owned opportunity with property context and a clear callback.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "law_firm",
    slug: "law-firms",
    name: "Law Firms",
    icon: "Scale",
    shortDescription:
      "AI-powered intake, follow-up, and client communication systems built for law firms that want to sign more clients without adding more admin staff.",
    heroHeadlineWhite: "Use AI where it saves the firm time.",
    heroHeadlineGold: "Keep legal judgment with the lawyers.",
    heroSubheadline:
      "We map intake, matter administration, client communication, drafting, and reporting, then build the right mix of automation, AI assistance, integrations, training, and ongoing execution around the firm's actual practice.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Review a legal consultation inquiry and assign the next contact while preserving the firm\u2019s intake process.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Turn agreed consultation next steps into assigned document requests and appointment follow-ups.",
      },
    ],
    solutions: [
      {
        title: "Review a consultation inquiry",
        description:
          "Review a legal consultation inquiry and assign the next contact while preserving the firm\u2019s intake process.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Assign the next steps after a consultation",
        description:
          "Turn agreed consultation next steps into assigned document requests and appointment follow-ups.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Professional services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Review a legal consultation inquiry and assign the next contact while preserving the firm\u2019s intake process.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "professional_services",
    slug: "professional-services",
    name: "Professional Services",
    icon: "Briefcase",
    shortDescription:
      "AI intake, scheduling, and follow-up for accountants, consultants, and financial advisors who want a pipeline that does not depend on referrals.",
    heroHeadlineWhite: "Turn repeatable client work",
    heroHeadlineGold: "into a reliable operation.",
    heroSubheadline:
      "We find where proposals, scheduling, onboarding, delivery, follow-up, and reporting consume the team, then build and run the focused AI and automation that gives that time back.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Assign access requests, an engagement owner and kickoff preparation from a won advisory engagement.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Review an overdue advisory invoice, customer context and payment evidence before preparing a reminder.",
      },
    ],
    solutions: [
      {
        title: "Start a client engagement with a shared checklist",
        description:
          "Assign access requests, an engagement owner and kickoff preparation from a won advisory engagement.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Review outstanding invoices and prepare follow-up",
        description:
          "Review an overdue advisory invoice, customer context and payment evidence before preparing a reminder.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Professional services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Assign access requests, an engagement owner and kickoff preparation from a won advisory engagement.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "real_estate",
    slug: "real-estate",
    name: "Real Estate",
    icon: "Building2",
    shortDescription:
      "Client capture, nurture, and long-memory pipeline systems for agents and brokerages that want every relationship worked, not just the hot ones.",
    heroHeadlineWhite: "Keep every relationship moving",
    heroHeadlineGold: "without living in the CRM.",
    heroSubheadline:
      "We map how buyers, sellers, listings, showings, follow-up, and referrals move through your business, then build the right AI, automation, integrations, or managed execution around that process.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Keep a property buyer\u2019s preferences and next viewing follow-up attached to one opportunity.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description: "Assign the questions and next appointments agreed during a property viewing.",
      },
    ],
    solutions: [
      {
        title: "Keep a buyer inquiry moving",
        description:
          "Keep a property buyer\u2019s preferences and next viewing follow-up attached to one opportunity.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Prepare for an appointment and assign follow-up",
        description: "Assign the questions and next appointments agreed during a property viewing.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Keep a property buyer\u2019s preferences and next viewing follow-up attached to one opportunity.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "manufacturing",
    slug: "manufacturing",
    name: "Manufacturing",
    icon: "Factory",
    opsLabel: "a manufacturer",
    shortDescription:
      "AI systems for manufacturers and industrial shops that want the estimator's knowledge in every quote and every open order visible to the whole floor.",
    heroHeadlineWhite: "Put the estimator's knowledge",
    heroHeadlineGold: "into the quoting process.",
    heroSubheadline:
      "We learn how RFQs, quotes, orders, suppliers, schedules, and reporting move through the shop, then build the focused tools, integrations, and automation that improve the work without replacing what already works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Collect quantity, specification and delivery needs before assigning a manufacturing quote review.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Turn an order review into assigned specification, material and delivery confirmations.",
      },
    ],
    solutions: [
      {
        title: "Review a quote request and its next action",
        description:
          "Collect quantity, specification and delivery needs before assigning a manufacturing quote review.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Track commitments from a customer delivery meeting",
        description:
          "Turn an order review into assigned specification, material and delivery confirmations.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    workflowExample:
      "Collect quantity, specification and delivery needs before assigning a manufacturing quote review.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "startups",
    slug: "startups",
    name: "Startups",
    icon: "Rocket",
    shortDescription:
      "AI systems for early-stage teams that need investor updates, user onboarding, and support running without a full ops team to run them.",
    heroHeadlineWhite: "Build the operating support",
    heroHeadlineGold: "the team has not hired yet.",
    heroSubheadline:
      "We identify the operational work pulling founders and early employees away from customers and product, then build and run the AI, internal tools, integrations, or reporting the company needs next.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Connect a software evaluation inquiry to an owner, use case and next product discussion.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Create an implementation checklist for a won software customer with access, ownership and acceptance steps.",
      },
    ],
    solutions: [
      {
        title: "Review new customer inquiries and follow-up",
        description:
          "Connect a software evaluation inquiry to an owner, use case and next product discussion.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Give a new customer a clear kickoff",
        description:
          "Create an implementation checklist for a won software customer with access, ownership and acceptance steps.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    workflowExample:
      "Connect a software evaluation inquiry to an owner, use case and next product discussion.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "medical_dental",
    slug: "medical-dental",
    name: "Medical & Dental Practices",
    icon: "Stethoscope",
    shortDescription:
      "AI intake, scheduling, and recall systems for medical and dental practices that want the appointment book solid and the front desk out of the paperwork.",
    heroHeadlineWhite: "Give the front desk",
    heroHeadlineGold: "more room for patients.",
    heroSubheadline:
      "We map scheduling, intake, reminders, recalls, insurance work, and patient communication, then build the appropriate automation, AI assistance, integrations, and staff training around the practice's requirements.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Route an administrative practice inquiry to the right coordinator with a clear follow-up.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Assign the operational follow-ups agreed in a practice meeting while keeping clinical records in their existing system.",
      },
    ],
    solutions: [
      {
        title: "Review a general appointment inquiry",
        description:
          "Route an administrative practice inquiry to the right coordinator with a clear follow-up.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Track administrative meeting commitments",
        description:
          "Assign the operational follow-ups agreed in a practice meeting while keeping clinical records in their existing system.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Route an administrative practice inquiry to the right coordinator with a clear follow-up.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "insurance_agencies",
    slug: "insurance-agencies",
    name: "Insurance Agencies",
    icon: "ShieldCheck",
    opsLabel: "an insurance agency",
    shortDescription:
      "AI quoting, renewal, and follow-up systems for independent agencies that want the whole book worked on time instead of from memory.",
    heroHeadlineWhite: "Work the whole book",
    heroHeadlineGold: "with better timing and context.",
    heroSubheadline:
      "We learn how quoting, renewals, service, claims follow-up, and account rounding work in your agency, then build and run the AI, automation, and reporting that supports producers and service staff.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Review an insurance inquiry and assign a licensed specialist to confirm the next conversation.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Assign the service handoff for an agreed insurance engagement, including document and contact checks.",
      },
    ],
    solutions: [
      {
        title: "Review a quote inquiry and assign follow-up",
        description:
          "Review an insurance inquiry and assign a licensed specialist to confirm the next conversation.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Prepare an engagement onboarding checklist",
        description:
          "Assign the service handoff for an agreed insurance engagement, including document and contact checks.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Professional services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Review an insurance inquiry and assign a licensed specialist to confirm the next conversation.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "auto_dealers",
    slug: "auto-dealers",
    name: "Auto Dealers & Service Centers",
    icon: "Car",
    opsLabel: "an auto dealer",
    shortDescription:
      "AI systems for dealerships and service centers that want both sides of the store connected, the bays full, and every open deal worked to a close.",
    heroHeadlineWhite: "Connect the work across",
    heroHeadlineGold: "sales and service.",
    heroSubheadline:
      "We map how inquiries, appointments, deals, repair orders, reminders, and customer history move across the store, then build the right automation, integrations, AI assistance, and managed follow-up.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Keep a vehicle inquiry, availability check and appointment follow-up together for the sales team.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Prepare a sold vehicle\u2019s handoff with assigned preparation, document and collection checks.",
      },
    ],
    solutions: [
      {
        title: "Track a vehicle inquiry and the next conversation",
        description:
          "Keep a vehicle inquiry, availability check and appointment follow-up together for the sales team.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Assign customer handoff commitments",
        description:
          "Prepare a sold vehicle\u2019s handoff with assigned preparation, document and collection checks.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book the session",
    ctaLink: "/contact",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    workflowExample:
      "Keep a vehicle inquiry, availability check and appointment follow-up together for the sales team.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "nonprofits",
    slug: "nonprofits",
    name: "Nonprofits",
    icon: "HeartHandshake",
    shortDescription:
      "Custom AI systems for nonprofits that turn first-time donors into second-time donors, keep every supporter followed up with, and give a stretched team its hours back. Built and run by us.",
    heroHeadlineWhite: "Give a stretched team",
    heroHeadlineGold: "more time for the mission.",
    heroSubheadline:
      "We learn where donor stewardship, volunteer coordination, program communication, grant work, and reporting consume limited staff time, then build and run the right automation, AI assistance, integrations, or training.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Context gets separated from the request",
        description:
          "Review a volunteer or supporter inquiry and assign an appropriate program follow-up.",
      },
      {
        icon: "ClipboardCheck",
        title: "Follow-through needs clear ownership",
        description:
          "Turn a program planning meeting into assigned venue, volunteer and communication tasks.",
      },
    ],
    solutions: [
      {
        title: "Review volunteer and partner interest",
        description:
          "Review a volunteer or supporter inquiry and assign an appropriate program follow-up.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
      {
        title: "Turn program meetings into assigned commitments",
        description:
          "Turn a program planning meeting into assigned venue, volunteer and communication tasks.",
        features: [
          "Review the source and business context",
          "Give the next step an owner",
          "Check the saved result before relying on it",
        ],
      },
    ],
    ctaText: "Book a 20-minute call",
    ctaLink: "/contact",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    workflowExample:
      "Review a volunteer or supporter inquiry and assign an appropriate program follow-up.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
  },
  {
    id: "restaurants_catering",
    slug: "restaurants-catering",
    name: "Restaurants & Catering",
    icon: "Utensils",
    group: "Hospitality & experiences",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for restaurants & catering: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Keep catering details out of the dinner rush.",
    heroHeadlineGold: "Give every event a clear handoff.",
    heroSubheadline:
      "We help restaurants & catering choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect event date, guest count, delivery location, budget range and dietary requirements so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description: "Confirm menu feasibility and delivery access before offering a final quote.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the agreed menu; verify dietary requirements with the organizer; assign delivery access confirmation.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A restaurant receives an inquiry for a 60-person office lunch. The organizer has a date and budget, but delivery access and dietary requirements still need confirmation.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the agreed menu; verify dietary requirements with the organizer; assign delivery access confirmation.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A restaurant receives an inquiry for a 60-person office lunch. The organizer has a date and budget, but delivery access and dietary requirements still need confirmation.",
    customBoundary:
      "POS orders, table reservations and kitchen production scheduling require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "retail_ecommerce",
    slug: "retail-ecommerce",
    name: "Retail & Ecommerce",
    icon: "ShoppingBag",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for retail & ecommerce: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Give wholesale interest a next step.",
    heroHeadlineGold: "Keep order promises visible.",
    heroSubheadline:
      "We help retail & ecommerce choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect business name, requested products, quantities, delivery deadline and destination so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description: "Check stock and fulfillment capacity before committing to a delivery date.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm available stock; verify the delivery address; assign the shipping-date check.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "An independent retailer receives a wholesale request for 120 gift sets. The buyer wants a delivery date that the team has not checked against available stock.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm available stock; verify the delivery address; assign the shipping-date check.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "An independent retailer receives a wholesale request for 120 gift sets. The buyer wants a delivery date that the team has not checked against available stock.",
    customBoundary:
      "Storefront checkout, inventory synchronization and order fulfillment require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "salons_spas",
    slug: "salons-spas",
    name: "Salons & Spas",
    icon: "Scissors",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for salons & spas: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Make consultation requests easy to review.",
    heroHeadlineGold: "Keep the next visit clear.",
    heroSubheadline:
      "We help salons & spas choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect requested service, preferred consultation window and general goals so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description:
          "Have the service professional review suitability before confirming a treatment or booking.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the consultation outcome; assign preparation instructions; verify the agreed follow-up date.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A salon receives a request for a color consultation before a wedding. The client has a preferred date, but the stylist needs to discuss suitability and preparation first.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the consultation outcome; assign preparation instructions; verify the agreed follow-up date.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A salon receives a request for a color consultation before a wedding. The client has a preferred date, but the stylist needs to discuss suitability and preparation first.",
    customBoundary:
      "Appointment booking, treatment records and payment systems require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "fitness_studios",
    slug: "fitness-studios",
    name: "Fitness Studios",
    icon: "Dumbbell",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for fitness studios: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Follow trial interest through to a conversation.",
    heroHeadlineGold: "Start memberships with an owned checklist.",
    heroSubheadline:
      "We help fitness studios choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect training interest, preferred session window and contact preference so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description: "Ask a qualified team member to confirm session suitability and availability.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the chosen membership; assign orientation; check that the member received joining instructions.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A studio receives a trial-session request from someone interested in small-group training. Staff need to confirm the class level and availability before offering a place.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the chosen membership; assign orientation; check that the member received joining instructions.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A studio receives a trial-session request from someone interested in small-group training. Staff need to confirm the class level and availability before offering a place.",
    customBoundary:
      "Class capacity, membership billing and health screening require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "pet_services",
    slug: "pet-services",
    name: "Pet Services",
    icon: "PawPrint",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for pet services: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Keep pet-service requests organized.",
    heroHeadlineGold: "Hand over the details the team needs.",
    heroSubheadline:
      "We help pet services choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect service type, requested dates, pet type and owner contact details so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description:
          "Confirm availability and required records in the service system before accepting the request.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm service dates; assign the required-records check; verify drop-off instructions.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A boarding business receives an inquiry for a dog during a holiday weekend. Staff need to review capacity and required records before accepting the stay.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm service dates; assign the required-records check; verify drop-off instructions.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A boarding business receives an inquiry for a dog during a holiday weekend. Staff need to review capacity and required records before accepting the stay.",
    customBoundary:
      "Kennel capacity, vaccination records and grooming schedules require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "auto_repair",
    slug: "auto-repair",
    name: "Auto Repair",
    icon: "Wrench",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for auto repair: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Give repair inquiries a clear owner.",
    heroHeadlineGold: "Keep approved work ready for handoff.",
    heroSubheadline:
      "We help auto repair choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect vehicle make and model, reported symptom, preferred callback time and general urgency so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description:
          "Have a service adviser review the symptom; confirm diagnostic arrangements separately.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Verify customer authorization; assign the parts-availability check; confirm the agreed customer update.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A repair shop receives a message about an intermittent warning light. The service adviser needs vehicle context and a diagnostic conversation before making promises about repairs.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Verify customer authorization; assign the parts-availability check; confirm the agreed customer update.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A repair shop receives a message about an intermittent warning light. The service adviser needs vehicle context and a diagnostic conversation before making promises about repairs.",
    customBoundary:
      "Diagnostic equipment, shop scheduling and repair-order billing require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "property_management",
    slug: "property-management",
    name: "Property Management",
    icon: "Building2",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for property management: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Follow owner interest with property context.",
    heroHeadlineGold: "Make new engagements easier to start.",
    heroSubheadline:
      "We help property management choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect property location, unit count, current management arrangement and desired start date so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description:
          "Review service-area fit and the owner\u2019s authority before proposing an engagement.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the signed management scope; assign the property-document request; prepare the owner kickoff.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "An owner asks about management for a small apartment building. The team needs the property scope and desired start date before discussing a management agreement.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the signed management scope; assign the property-document request; prepare the owner kickoff.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "An owner asks about management for a small apartment building. The team needs the property scope and desired start date before discussing a management agreement.",
    customBoundary:
      "Tenant screening, rent collection and maintenance dispatch require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "cleaning_companies",
    slug: "cleaning-companies",
    name: "Cleaning Companies",
    icon: "Sparkles",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for cleaning companies: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Turn cleaning inquiries into useful site reviews.",
    heroHeadlineGold: "Start recurring work with clear responsibilities.",
    heroSubheadline:
      "We help cleaning companies choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect site type, approximate size, preferred frequency and access window so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description: "Arrange a scope review before committing to staffing or a fixed quote.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the agreed cleaning scope; assign access instructions; verify the first-service check-in.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A cleaning company receives an inquiry for a two-floor office. The operations lead needs access arrangements and service frequency before confirming the scope.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the agreed cleaning scope; assign access instructions; verify the first-service check-in.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A cleaning company receives an inquiry for a two-floor office. The operations lead needs access arrangements and service frequency before confirming the scope.",
    customBoundary:
      "Crew routing, time tracking and supply inventory require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "staffing_recruiting",
    slug: "staffing-recruiting",
    name: "Staffing & Recruiting",
    icon: "Users",
    group: "Professional services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for staffing & recruiting: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Give employer inquiries a qualified next step.",
    heroHeadlineGold: "Keep client engagement preparation moving.",
    heroSubheadline:
      "We help staffing & recruiting choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect employer name, role types, headcount, target start date and work location so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description:
          "Confirm the employer\u2019s requirements and engagement terms before starting candidate work.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the agreed role brief; assign the hiring-manager kickoff; record the reporting cadence.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A staffing firm receives an employer request for three seasonal roles. The account lead needs hiring dates and role scope before agreeing to a recruiting engagement.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the agreed role brief; assign the hiring-manager kickoff; record the reporting cadence.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A staffing firm receives an employer request for three seasonal roles. The account lead needs hiring dates and role scope before agreeing to a recruiting engagement.",
    customBoundary:
      "Candidate tracking, background checks and payroll require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
  {
    id: "events_venues",
    slug: "events-venues",
    name: "Events & Venues",
    icon: "Calendar",
    group: "Hospitality & experiences",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI consulting and business automation for events & venues: organize inquiries, assign follow-up and prepare delivery with reviewed workflows.",
    heroHeadlineWhite: "Follow event inquiries with the right details.",
    heroHeadlineGold: "Give planning commitments an owner.",
    heroSubheadline:
      "We help events & venues choose useful AI projects, connect existing tools and improve daily operations. Start with inquiry review or delivery handoffs, then build around the way your team works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Requests arrive without enough context",
        description:
          "Collect event date, guest count, event type, layout needs and budget range so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "A decision needs a responsible person",
        description: "Verify capacity and availability before promising a date or configuration.",
      },
      {
        icon: "ClipboardCheck",
        title: "Agreed work needs a visible handoff",
        description:
          "Confirm the agreed event scope; assign supplier access checks; verify the organizer\u2019s next planning deadline.",
      },
    ],
    solutions: [
      {
        title: "Review the request",
        description:
          "A venue receives a request for an evening reception. The organizer knows the guest count but has not confirmed the room layout, supplier access or timing.",
        features: [
          "Keep contact details with the opportunity",
          "Assign a next action and owner",
          "Review the source before making a commitment",
        ],
      },
      {
        title: "Prepare the handoff",
        description:
          "Confirm the agreed event scope; assign supplier access checks; verify the organizer\u2019s next planning deadline.",
        features: [
          "Preview the checklist before approval",
          "Assign valid owners and due dates",
          "Check saved tasks and review overdue work",
        ],
      },
    ],
    workflowExample:
      "A venue receives a request for an evening reception. The organizer knows the guest count but has not confirmed the room layout, supplier access or timing.",
    customBoundary:
      "Venue calendars, ticketing and supplier booking require a separately scoped integration or your existing specialist software.",
    ctaText: "Discuss your workflow",
    ctaLink: "/contact",
  },
];

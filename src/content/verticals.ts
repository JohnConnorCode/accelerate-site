import type { Vertical } from "@/lib/types";

export const verticals: Vertical[] = [
  {
    id: "home_services",
    slug: "home-services",
    name: "Home Services",
    icon: "Wrench",
    shortDescription:
      "AI and automation for contractors, roofers, plumbers and HVAC teams. Connect inquiries, estimate preparation and job handoffs around your existing tools.",
    heroHeadlineWhite: "Give the office work a system.",
    heroHeadlineGold: "Keep the crew on the work.",
    heroSubheadline:
      "We learn how jobs move from the first inquiry through scheduling, estimating, field work, payment, and follow-up. Then we build and run the AI, automation, or custom tools that remove the most office work without disrupting the crew.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Follow a roofing inquiry through to an estimate",
        description:
          "Turn a roof inspection request into an owned opportunity with property context and a clear callback.",
      },
      {
        icon: "ClipboardCheck",
        title: "Prepare the team for a newly won job",
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
    pilot: {
      measure:
        "Time from a new request to an assigned callback; estimate requests missing property details.",
      readyWhen:
        "The estimator can find the property, requested work and next customer contact. The crew receives confirmed access and preparation tasks.",
    },
  },
  {
    id: "law_firm",
    slug: "law-firms",
    name: "Law Firms",
    icon: "Scale",
    shortDescription:
      "AI consulting and custom workflows for law firms. Organize intake, consultation follow-up and administration while keeping legal decisions with your team.",
    heroHeadlineWhite: "Use AI where it saves the firm time.",
    heroHeadlineGold: "Keep legal judgment with the lawyers.",
    heroSubheadline:
      "We map intake, matter administration, client communication, drafting, and reporting, then build the right mix of automation, AI assistance, integrations, training, and ongoing execution around the firm's actual practice.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review a consultation inquiry",
        description:
          "Review a legal consultation inquiry and assign the next contact while preserving the firm’s intake process.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the next steps after a consultation",
        description:
          "Turn agreed consultation next steps into assigned document requests and appointment follow-ups.",
      },
    ],
    solutions: [
      {
        title: "Review a consultation inquiry",
        description:
          "Review a legal consultation inquiry and assign the next contact while preserving the firm’s intake process.",
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
      "Review a legal consultation inquiry and assign the next contact while preserving the firm’s intake process.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
    pilot: {
      measure:
        "Consultation inquiries awaiting review; agreed document requests without a responsible person.",
      readyWhen:
        "The intake team can identify the next contact and the lawyer responsible for review. Conflict checks and engagement decisions remain with the firm.",
    },
  },
  {
    id: "professional_services",
    slug: "professional-services",
    name: "Professional Services",
    icon: "Briefcase",
    shortDescription:
      "AI and automation for consultants, accountants and advisory teams. Coordinate client onboarding, delivery commitments and invoice review.",
    heroHeadlineWhite: "Turn repeatable client work",
    heroHeadlineGold: "into a reliable operation.",
    heroSubheadline:
      "We find where proposals, scheduling, onboarding, delivery, follow-up, and reporting consume the team, then build and run the focused AI and automation that gives that time back.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Start a client engagement with a shared checklist",
        description:
          "Assign access requests, an engagement owner and kickoff preparation from a won advisory engagement.",
      },
      {
        icon: "ClipboardCheck",
        title: "Review outstanding invoices and prepare follow-up",
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
    pilot: {
      measure:
        "Time spent preparing a client kickoff; access requests that delay the first deliverable.",
      readyWhen:
        "The engagement owner can identify the agreed scope, outstanding access and first delivery date. Each request has a named owner.",
    },
  },
  {
    id: "real_estate",
    slug: "real-estate",
    name: "Real Estate",
    icon: "Building2",
    shortDescription:
      "AI and automation for real estate agents and brokerages. Organize buyer inquiries, viewing follow-up and client context around your existing systems.",
    heroHeadlineWhite: "Keep every relationship moving",
    heroHeadlineGold: "without living in the CRM.",
    heroSubheadline:
      "We map how buyers, sellers, listings, showings, follow-up, and referrals move through your business, then build the right AI, automation, integrations, or managed execution around that process.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Keep a buyer inquiry moving",
        description:
          "Keep a property buyer’s preferences and next viewing follow-up attached to one opportunity.",
      },
      {
        icon: "ClipboardCheck",
        title: "Prepare for an appointment and assign follow-up",
        description: "Assign the questions and next appointments agreed during a property viewing.",
      },
    ],
    solutions: [
      {
        title: "Keep a buyer inquiry moving",
        description:
          "Keep a property buyer’s preferences and next viewing follow-up attached to one opportunity.",
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
      "Keep a property buyer’s preferences and next viewing follow-up attached to one opportunity.",
    customBoundary:
      "Connections to industry-specific scheduling, records, payments or compliance systems require separate scoping, implementation and verification. Keep sensitive records in the appropriate authorized system.",
    pilot: {
      measure:
        "Buyer inquiries without a next conversation; questions left unresolved after a viewing.",
      readyWhen:
        "The agent can find the buyer’s preferences, the property discussed and the next agreed appointment or question to resolve.",
    },
  },
  {
    id: "manufacturing",
    slug: "manufacturing",
    name: "Manufacturing",
    icon: "Factory",
    opsLabel: "a manufacturer",
    shortDescription:
      "AI and automation for manufacturers. Organize quote requests, specification reviews and production handoffs with clear ownership and source records.",
    heroHeadlineWhite: "Put the estimator's knowledge",
    heroHeadlineGold: "into the quoting process.",
    heroSubheadline:
      "We learn how RFQs, quotes, orders, suppliers, schedules, and reporting move through the shop, then build the focused tools, integrations, and automation that improve the work without replacing what already works.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review a quote request and its next action",
        description:
          "Collect quantity, specification and delivery needs before assigning a manufacturing quote review.",
      },
      {
        icon: "ClipboardCheck",
        title: "Track commitments from a customer delivery meeting",
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
    pilot: {
      measure:
        "Quote requests returned for missing specifications; handoffs waiting for an engineering or capacity review.",
      readyWhen:
        "Sales and operations refer to the same revision, quantity and requested delivery date. Engineering and production confirm feasibility before a promise is made.",
    },
  },
  {
    id: "startups",
    slug: "startups",
    name: "Startups",
    icon: "Rocket",
    shortDescription:
      "AI consulting and custom workflows for startups. Connect customer context, pilot preparation and team commitments without rebuilding your operation.",
    heroHeadlineWhite: "Build the operating support",
    heroHeadlineGold: "the team has not hired yet.",
    heroSubheadline:
      "We identify the operational work pulling founders and early employees away from customers and product, then build and run the AI, internal tools, integrations, or reporting the company needs next.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review new customer inquiries and follow-up",
        description:
          "Connect a software evaluation inquiry to an owner, use case and next product discussion.",
      },
      {
        icon: "ClipboardCheck",
        title: "Give a new customer a clear kickoff",
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
    pilot: {
      measure:
        "Time between an agreed customer pilot and kickoff; setup commitments without an owner.",
      readyWhen:
        "The pilot has a clear objective, customer contact, access checklist and review date. Someone owns the decision to continue, change or stop it.",
    },
  },
  {
    id: "medical_dental",
    slug: "medical-dental",
    name: "Medical & Dental Practices",
    icon: "Stethoscope",
    shortDescription:
      "AI and automation for medical and dental practice administration. Coordinate inquiries and office follow-up while preserving clinical and patient-record boundaries.",
    heroHeadlineWhite: "Give the front desk",
    heroHeadlineGold: "more room for patients.",
    heroSubheadline:
      "We map scheduling, intake, reminders, recalls, insurance work, and patient communication, then build the appropriate automation, AI assistance, integrations, and staff training around the practice's requirements.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review a general appointment inquiry",
        description:
          "Route an administrative practice inquiry to the right coordinator with a clear follow-up.",
      },
      {
        icon: "ClipboardCheck",
        title: "Track administrative meeting commitments",
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
    pilot: {
      measure:
        "Administrative inquiries waiting for a callback; missing nonclinical preparation instructions.",
      readyWhen:
        "Office staff can find the next administrative action. Clinical assessment and patient records stay with authorized professionals and the practice system.",
    },
  },
  {
    id: "insurance_agencies",
    slug: "insurance-agencies",
    name: "Insurance Agencies",
    icon: "ShieldCheck",
    opsLabel: "an insurance agency",
    shortDescription:
      "AI and automation for insurance agency operations. Organize coverage inquiries and renewal follow-up while licensed agents retain professional decisions.",
    heroHeadlineWhite: "Work the whole book",
    heroHeadlineGold: "with better timing and context.",
    heroSubheadline:
      "We learn how quoting, renewals, service, claims follow-up, and account rounding work in your agency, then build and run the AI, automation, and reporting that supports producers and service staff.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review a quote inquiry and assign follow-up",
        description:
          "Review an insurance inquiry and assign a licensed specialist to confirm the next conversation.",
      },
      {
        icon: "ClipboardCheck",
        title: "Prepare an engagement onboarding checklist",
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
    pilot: {
      measure:
        "Coverage inquiries missing review details; renewal follow-ups without a next action.",
      readyWhen:
        "The licensed agent can identify the requested review and customer follow-up. Coverage, eligibility and binding decisions stay in the agency’s authorized process.",
    },
  },
  {
    id: "auto_dealers",
    slug: "auto-dealers",
    name: "Auto Dealers & Service Centers",
    icon: "Car",
    opsLabel: "an auto dealer",
    shortDescription:
      "AI and automation for auto dealerships. Keep vehicle inquiries, appointment preparation and customer follow-up connected to your existing dealer systems.",
    heroHeadlineWhite: "Connect the work across",
    heroHeadlineGold: "sales and service.",
    heroSubheadline:
      "We map how inquiries, appointments, deals, repair orders, reminders, and customer history move across the store, then build the right automation, integrations, AI assistance, and managed follow-up.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Track a vehicle inquiry and the next conversation",
        description:
          "Keep a vehicle inquiry, availability check and appointment follow-up together for the sales team.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign customer handoff commitments",
        description:
          "Prepare a sold vehicle’s handoff with assigned preparation, document and collection checks.",
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
          "Prepare a sold vehicle’s handoff with assigned preparation, document and collection checks.",
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
    pilot: {
      measure:
        "Vehicle inquiries without an assigned response; agreed appointment preparation left incomplete.",
      readyWhen:
        "The salesperson can identify the vehicle of interest, availability check and next customer conversation. Inventory and transaction records remain authoritative.",
    },
  },
  {
    id: "nonprofits",
    slug: "nonprofits",
    name: "Nonprofits",
    icon: "HeartHandshake",
    shortDescription:
      "AI and automation for nonprofit teams. Coordinate volunteer inquiries, events and community follow-up with clear responsibilities and shared context.",
    heroHeadlineWhite: "Give a stretched team",
    heroHeadlineGold: "more time for the mission.",
    heroSubheadline:
      "We learn where donor stewardship, volunteer coordination, program communication, grant work, and reporting consume limited staff time, then build and run the right automation, AI assistance, integrations, or training.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Review volunteer and partner interest",
        description:
          "Review a volunteer or supporter inquiry and assign an appropriate program follow-up.",
      },
      {
        icon: "ClipboardCheck",
        title: "Turn program meetings into assigned commitments",
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
    pilot: {
      measure:
        "Volunteer inquiries waiting for a response; event commitments without a coordinator.",
      readyWhen:
        "The coordinator can find the person’s interests, the agreed next step and the responsible team member. Required screening is tracked in the appropriate process.",
    },
  },
  {
    id: "restaurants_catering",
    slug: "restaurants-catering",
    name: "Restaurants & Catering",
    icon: "Utensils",
    group: "Hospitality & experiences",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for restaurants and caterers: organize event inquiries, review quote details and coordinate kitchen and delivery handoffs.",
    heroHeadlineWhite: "Turn catering inquiries",
    heroHeadlineGold: "into prepared events.",
    heroSubheadline:
      "When a catering request arrives during service, the details still need a home. We help restaurants capture the event brief, prepare quote reviews and coordinate kitchen and delivery handoffs, with AI and automation built around the tools your team uses.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect event date, guest count, delivery location, budget range and dietary requirements so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description: "Confirm menu feasibility and delivery access before offering a final quote.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Time from a catering inquiry to a quote-ready brief; event handoffs missing menu or delivery details.",
      readyWhen:
        "The event owner has the confirmed guest count, menu decision, dietary review and delivery contact. The kitchen and delivery team know which details are still open.",
    },
  },
  {
    id: "retail_ecommerce",
    slug: "retail-ecommerce",
    name: "Retail & Ecommerce",
    icon: "ShoppingBag",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for retail and ecommerce: review wholesale requests, coordinate stock checks and track customer commitments through fulfillment.",
    heroHeadlineWhite: "Keep wholesale conversations",
    heroHeadlineGold: "connected to fulfillment.",
    heroSubheadline:
      "A wholesale inquiry needs answers about products, quantities and delivery before it becomes an order. We help retailers connect those conversations to stock checks and fulfillment follow-up, so the next person can see what was promised and what still needs confirmation.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect business name, requested products, quantities, delivery deadline and destination so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description: "Check stock and fulfillment capacity before committing to a delivery date.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Wholesale inquiries missing quantities or destination; promised order updates without an owner.",
      readyWhen:
        "The account owner has checked stock in the commerce system and recorded the agreed customer update. A requested delivery date is clearly distinguished from a confirmed one.",
    },
  },
  {
    id: "salons_spas",
    slug: "salons-spas",
    name: "Salons & Spas",
    icon: "Scissors",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for salons and spas: organize consultations, preparation instructions and client follow-up around your existing booking tools.",
    heroHeadlineWhite: "Give each consultation",
    heroHeadlineGold: "a clear next step.",
    heroSubheadline:
      "A new service request often needs a professional conversation before a slot can be booked. We help salons and spas organize consultations, preparation instructions and follow-up around their existing booking tools, giving the front desk a clearer view of what each client needs.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect requested service, preferred consultation window and general goals so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description:
          "Have the service professional review suitability before confirming a treatment or booking.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Consultation requests waiting for a professional review; agreed preparation instructions awaiting follow-up.",
      readyWhen:
        "The service professional has reviewed the request and the coordinator knows the next contact. The booking system contains the confirmed appointment.",
    },
  },
  {
    id: "fitness_studios",
    slug: "fitness-studios",
    name: "Fitness Studios",
    icon: "Dumbbell",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for fitness studios: follow up on trial inquiries, coordinate orientation and prepare new members for their first visit.",
    heroHeadlineWhite: "Turn trial interest",
    heroHeadlineGold: "into a prepared first visit.",
    heroSubheadline:
      "People asking about a trial need a suitable session and clear joining instructions. We help fitness studios organize those conversations and member onboarding, with assigned follow-up that supports your coaches and works alongside your membership software.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect training interest, preferred session window and contact preference so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description: "Ask a qualified team member to confirm session suitability and availability.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Trial inquiries awaiting a reply; new members missing orientation or joining instructions.",
      readyWhen:
        "The team has confirmed a suitable session and assigned orientation. The member has the agreed arrival details and knows who to contact.",
    },
  },
  {
    id: "pet_services",
    slug: "pet-services",
    name: "Pet Services",
    icon: "PawPrint",
    group: "Personal & community services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for pet services: review boarding, grooming and daycare inquiries, confirm requirements and prepare the team for arrivals.",
    heroHeadlineWhite: "Prepare for every pet",
    heroHeadlineGold: "before arrival.",
    heroSubheadline:
      "Boarding, grooming and daycare requests involve dates, service requirements and details the care team needs. We help pet-service businesses organize the inquiry and agreed handoff, while availability and care records stay connected to the specialist tools you rely on.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect service type, requested dates, pet type and owner contact details so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description:
          "Confirm availability and required records in the service system before accepting the request.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Requests waiting for availability or required-records review; first visits with incomplete arrival details.",
      readyWhen:
        "The coordinator has checked dates, service fit and required records in the service system. The owner has confirmed arrival and collection instructions.",
    },
  },
  {
    id: "auto_repair",
    slug: "auto-repair",
    name: "Auto Repair",
    icon: "Wrench",
    group: "Commerce & operations",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for auto repair shops: organize service inquiries, authorization checks, parts follow-up and customer updates around your shop software.",
    heroHeadlineWhite: "Keep repair conversations",
    heroHeadlineGold: "moving with the job.",
    heroSubheadline:
      "Service advisers need vehicle context, customer authorization and a clear update plan. We help repair shops organize incoming requests and preparation for approved work, so the person handling the next conversation can find the decisions already made.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect vehicle make and model, reported symptom, preferred callback time and general urgency so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description:
          "Have a service adviser review the symptom; confirm diagnostic arrangements separately.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Repair inquiries awaiting an adviser callback; approved jobs missing authorization or a customer update.",
      readyWhen:
        "The adviser can locate authorization in the shop system, identify the parts check and name the person responsible for the next customer update.",
    },
  },
  {
    id: "property_management",
    slug: "property-management",
    name: "Property Management",
    icon: "Building2",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for property managers: review owner inquiries, organize property context and coordinate documents and tasks for new engagements.",
    heroHeadlineWhite: "Start property engagements",
    heroHeadlineGold: "with the details in place.",
    heroSubheadline:
      "An owner inquiry becomes useful when property context, service scope and transition responsibilities are clear. We help property managers organize those conversations and onboarding tasks, with custom connections to the systems that hold property and tenant records.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect property location, unit count, current management arrangement and desired start date so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description:
          "Review service-area fit and the owner’s authority before proposing an engagement.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Owner inquiries missing property context; agreed engagements delayed by document requests.",
      readyWhen:
        "The engagement owner has the signed scope, property references and document checklist. Each transition task has a responsible person and an agreed date.",
    },
  },
  {
    id: "cleaning_companies",
    slug: "cleaning-companies",
    name: "Cleaning Companies",
    icon: "Sparkles",
    group: "Property & field services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for cleaning companies: organize quote requests, site reviews, access instructions and recurring-service preparation.",
    heroHeadlineWhite: "Give every cleaning job",
    heroHeadlineGold: "a clear start.",
    heroSubheadline:
      "A reliable first visit begins with agreed areas, service frequency and access arrangements. We help cleaning companies organize quote requests, site reviews and recurring-service handoffs, so supervisors and crews can find the details that shape the work.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect site type, approximate size, preferred frequency and access window so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description: "Arrange a scope review before committing to staffing or a fixed quote.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Quote requests waiting for a site review; first visits delayed by unclear scope or access.",
      readyWhen:
        "The supervisor can find the agreed areas, frequency and access contact. The team has a first-service check-in and a way to report a missed requirement.",
    },
  },
  {
    id: "staffing_recruiting",
    slug: "staffing-recruiting",
    name: "Staffing & Recruiting",
    icon: "Users",
    group: "Professional services",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for staffing and recruiting: qualify employer inquiries, prepare role briefs and coordinate client kickoff and reporting commitments.",
    heroHeadlineWhite: "Bring the hiring brief",
    heroHeadlineGold: "into focus.",
    heroSubheadline:
      "A new employer request needs a clear role, hiring timeline and engagement agreement. We help staffing and recruiting teams organize qualification, client kickoff and reporting commitments, with workflow support built around their existing recruiting systems.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect employer name, role types, headcount, target start date and work location so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description:
          "Confirm the employer’s requirements and engagement terms before starting candidate work.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
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
    pilot: {
      measure:
        "Employer inquiries missing role requirements; agreed searches waiting for a hiring-manager kickoff.",
      readyWhen:
        "The recruiter has an approved role brief, agreed engagement terms and a reporting cadence. Candidate decisions remain in the authorized recruiting process.",
    },
  },
  {
    id: "events_venues",
    slug: "events-venues",
    name: "Events & Venues",
    icon: "Calendar",
    group: "Hospitality & experiences",
    updatedAt: "2026-09-19",
    shortDescription:
      "AI and automation for venues and event teams: review event inquiries, check planning requirements and track organizer and supplier commitments.",
    heroHeadlineWhite: "Turn event interest",
    heroHeadlineGold: "into coordinated planning.",
    heroSubheadline:
      "An event request needs a capacity review, a workable layout and a clear planning conversation. We help venues and event teams keep those details together and turn agreed decisions into assigned follow-up, alongside their booking and event-management tools.",
    painPoints: [
      {
        icon: "MessageSquare",
        title: "Capture the request",
        description:
          "Collect event date, guest count, event type, layout needs and budget range so the first conversation can address the actual request.",
      },
      {
        icon: "UserCheck",
        title: "Review the fit",
        description: "Verify capacity and availability before promising a date or configuration.",
      },
      {
        icon: "ClipboardCheck",
        title: "Assign the handoff",
        description:
          "Confirm the agreed event scope; assign supplier access checks; verify the organizer’s next planning deadline.",
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
          "Confirm the agreed event scope; assign supplier access checks; verify the organizer’s next planning deadline.",
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
    pilot: {
      measure:
        "Event inquiries awaiting a capacity check; planning commitments overdue before the next review.",
      readyWhen:
        "The planner can find the confirmed scope, capacity review and next organizer deadline. Supplier access and layout decisions have named owners.",
    },
  },
];

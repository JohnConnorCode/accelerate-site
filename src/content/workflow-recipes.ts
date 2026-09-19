import type { DemoScenarioId } from "@/lib/admin/demo/scenarios";

export interface WorkflowRecipe {
  id: string;
  industry: string;
  industryName: string;
  title: string;
  description: string;
  components: Array<{ label: string; href: string }>;
  demoScenario?: DemoScenarioId;
}

/** Shared discovery metadata; complete task instructions live in the docs. */
export const workflowRecipes: WorkflowRecipe[] = [
  {
    id: "roofing-inquiry",
    industry: "home-services",
    industryName: "Home services",
    title: "Follow a roofing inquiry through to an estimate",
    description:
      "Turn a roof inspection request into an owned opportunity with property context and a clear callback.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
    demoScenario: "northline-roofing",
  },
  {
    id: "job-start",
    industry: "home-services",
    industryName: "Home services",
    title: "Prepare the team for a newly won job",
    description:
      "Use a won roofing job to assign site access, materials and start-date checks before the crew arrives.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
    demoScenario: "northline-roofing",
  },
  {
    id: "consultation-intake",
    industry: "law-firms",
    industryName: "Law firms",
    title: "Review a consultation inquiry",
    description:
      "Review a legal consultation inquiry and assign the next contact while preserving the firm’s intake process.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
    demoScenario: "alder-ridge-law",
  },
  {
    id: "consultation-commitments",
    industry: "law-firms",
    industryName: "Law firms",
    title: "Assign the next steps after a consultation",
    description:
      "Turn agreed consultation next steps into assigned document requests and appointment follow-ups.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
    demoScenario: "alder-ridge-law",
  },
  {
    id: "engagement-onboarding",
    industry: "professional-services",
    industryName: "Professional services",
    title: "Start a client engagement with a shared checklist",
    description:
      "Assign access requests, an engagement owner and kickoff preparation from a won advisory engagement.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
    demoScenario: "ledgerstone-advisory",
  },
  {
    id: "invoice-follow-up",
    industry: "professional-services",
    industryName: "Professional services",
    title: "Review outstanding invoices and prepare follow-up",
    description:
      "Review an overdue advisory invoice, customer context and payment evidence before preparing a reminder.",
    components: [
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Receivables Collections",
        href: "/docs/plugins/receivables-collections",
      },
      {
        label: "Conversations",
        href: "/docs/conversations",
      },
      {
        label: "Approvals",
        href: "/docs/command-center/approvals",
      },
    ],
    demoScenario: "ledgerstone-advisory",
  },
  {
    id: "buyer-follow-up",
    industry: "real-estate",
    industryName: "Real estate",
    title: "Keep a buyer inquiry moving",
    description:
      "Keep a property buyer’s preferences and next viewing follow-up attached to one opportunity.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
    demoScenario: "hearthline-realty",
  },
  {
    id: "appointment-follow-through",
    industry: "real-estate",
    industryName: "Real estate",
    title: "Prepare for an appointment and assign follow-up",
    description: "Assign the questions and next appointments agreed during a property viewing.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
    demoScenario: "hearthline-realty",
  },
  {
    id: "quote-request",
    industry: "manufacturing",
    industryName: "Manufacturing",
    title: "Review a quote request and its next action",
    description:
      "Collect quantity, specification and delivery needs before assigning a manufacturing quote review.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "delivery-commitments",
    industry: "manufacturing",
    industryName: "Manufacturing",
    title: "Track commitments from a customer delivery meeting",
    description:
      "Turn an order review into assigned specification, material and delivery confirmations.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
  {
    id: "sales-follow-up",
    industry: "startups",
    industryName: "Startups",
    title: "Review new customer inquiries and follow-up",
    description:
      "Connect a software evaluation inquiry to an owner, use case and next product discussion.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "customer-kickoff",
    industry: "startups",
    industryName: "Startups",
    title: "Give a new customer a clear kickoff",
    description:
      "Create an implementation checklist for a won software customer with access, ownership and acceptance steps.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "practice-inquiry",
    industry: "medical-dental",
    industryName: "Medical and dental",
    title: "Review a general appointment inquiry",
    description:
      "Route an administrative practice inquiry to the right coordinator with a clear follow-up.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "practice-admin",
    industry: "medical-dental",
    industryName: "Medical and dental",
    title: "Track administrative meeting commitments",
    description:
      "Assign the operational follow-ups agreed in a practice meeting while keeping clinical records in their existing system.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
  {
    id: "insurance-inquiry",
    industry: "insurance-agencies",
    industryName: "Insurance agencies",
    title: "Review a quote inquiry and assign follow-up",
    description:
      "Review an insurance inquiry and assign a licensed specialist to confirm the next conversation.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "insurance-onboarding",
    industry: "insurance-agencies",
    industryName: "Insurance agencies",
    title: "Prepare an engagement onboarding checklist",
    description:
      "Assign the service handoff for an agreed insurance engagement, including document and contact checks.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "vehicle-inquiry",
    industry: "auto-dealers",
    industryName: "Auto dealers",
    title: "Track a vehicle inquiry and the next conversation",
    description:
      "Keep a vehicle inquiry, availability check and appointment follow-up together for the sales team.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "vehicle-handoff",
    industry: "auto-dealers",
    industryName: "Auto dealers",
    title: "Assign customer handoff commitments",
    description:
      "Prepare a sold vehicle’s handoff with assigned preparation, document and collection checks.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
  {
    id: "supporter-interest",
    industry: "nonprofits",
    industryName: "Nonprofits",
    title: "Review volunteer and partner interest",
    description:
      "Review a volunteer or supporter inquiry and assign an appropriate program follow-up.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
    demoScenario: "common-table-network",
  },
  {
    id: "program-commitments",
    industry: "nonprofits",
    industryName: "Nonprofits",
    title: "Turn program meetings into assigned commitments",
    description:
      "Turn a program planning meeting into assigned venue, volunteer and communication tasks.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
    demoScenario: "common-table-network",
  },

  {
    id: "catering-inquiry",
    industry: "restaurants-catering",
    industryName: "Restaurants & Catering",
    title: "Review a catering inquiry before quoting",
    description:
      "Capture event date, guest count, delivery location, budget range and dietary requirements and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "catering-event-handoff",
    industry: "restaurants-catering",
    industryName: "Restaurants & Catering",
    title: "Prepare an agreed catering event for delivery",
    description:
      "Confirm the agreed menu; verify dietary requirements with the organizer; assign delivery access confirmation. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "wholesale-inquiry",
    industry: "retail-ecommerce",
    industryName: "Retail & Ecommerce",
    title: "Follow a wholesale inquiry through review",
    description:
      "Capture business name, requested products, quantities, delivery deadline and destination and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "retail-order-handoff",
    industry: "retail-ecommerce",
    industryName: "Retail & Ecommerce",
    title: "Assign commitments for an agreed wholesale order",
    description:
      "Confirm available stock; verify the delivery address; assign the shipping-date check. Keep each commitment linked to the source meeting.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
  {
    id: "salon-consultation",
    industry: "salons-spas",
    industryName: "Salons & Spas",
    title: "Review a salon consultation request",
    description:
      "Capture requested service, preferred consultation window and general goals and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "salon-follow-up",
    industry: "salons-spas",
    industryName: "Salons & Spas",
    title: "Assign follow-up after a service consultation",
    description:
      "Confirm the consultation outcome; assign preparation instructions; verify the agreed follow-up date. Keep each commitment linked to the source meeting.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
  {
    id: "fitness-trial",
    industry: "fitness-studios",
    industryName: "Fitness Studios",
    title: "Follow a trial-session inquiry",
    description:
      "Capture training interest, preferred session window and contact preference and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "fitness-member-onboarding",
    industry: "fitness-studios",
    industryName: "Fitness Studios",
    title: "Prepare a new member onboarding checklist",
    description:
      "Confirm the chosen membership; assign orientation; check that the member received joining instructions. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "pet-service-inquiry",
    industry: "pet-services",
    industryName: "Pet Services",
    title: "Review a grooming or boarding inquiry",
    description:
      "Capture service type, requested dates, pet type and owner contact details and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "pet-service-handoff",
    industry: "pet-services",
    industryName: "Pet Services",
    title: "Prepare an agreed pet-service handoff",
    description:
      "Confirm service dates; assign the required-records check; verify drop-off instructions. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "repair-inquiry",
    industry: "auto-repair",
    industryName: "Auto Repair",
    title: "Review an auto repair inquiry",
    description:
      "Capture vehicle make and model, reported symptom, preferred callback time and general urgency and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "repair-job-handoff",
    industry: "auto-repair",
    industryName: "Auto Repair",
    title: "Prepare an approved repair job for handoff",
    description:
      "Verify customer authorization; assign the parts-availability check; confirm the agreed customer update. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "property-owner-inquiry",
    industry: "property-management",
    industryName: "Property Management",
    title: "Follow a property owner inquiry",
    description:
      "Capture property location, unit count, current management arrangement and desired start date and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "property-engagement-onboarding",
    industry: "property-management",
    industryName: "Property Management",
    title: "Prepare a property management engagement",
    description:
      "Confirm the signed management scope; assign the property-document request; prepare the owner kickoff. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "cleaning-quote",
    industry: "cleaning-companies",
    industryName: "Cleaning Companies",
    title: "Review a cleaning quote request",
    description:
      "Capture site type, approximate size, preferred frequency and access window and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "cleaning-service-kickoff",
    industry: "cleaning-companies",
    industryName: "Cleaning Companies",
    title: "Prepare a recurring cleaning service kickoff",
    description:
      "Confirm the agreed cleaning scope; assign access instructions; verify the first-service check-in. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "staffing-inquiry",
    industry: "staffing-recruiting",
    industryName: "Staffing & Recruiting",
    title: "Review an employer staffing inquiry",
    description:
      "Capture employer name, role types, headcount, target start date and work location and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "staffing-engagement",
    industry: "staffing-recruiting",
    industryName: "Staffing & Recruiting",
    title: "Prepare a staffing client engagement",
    description:
      "Confirm the agreed role brief; assign the hiring-manager kickoff; record the reporting cadence. Keep each commitment attached to the agreed opportunity.",
    components: [
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Client onboarding",
        href: "/docs/plugins/client-onboarding",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
      {
        label: "Overdue commitments",
        href: "/docs/plugins/commitment-watch",
      },
    ],
  },
  {
    id: "venue-inquiry",
    industry: "events-venues",
    industryName: "Events & Venues",
    title: "Review an event or venue inquiry",
    description:
      "Capture event date, guest count, event type, layout needs and budget range and assign a reviewed next step.",
    components: [
      {
        label: "Form builder",
        href: "/docs/plugins/form-builder",
      },
      {
        label: "Contacts",
        href: "/docs/contacts",
      },
      {
        label: "Pipeline",
        href: "/docs/pipeline",
      },
      {
        label: "Pipeline follow-up",
        href: "/docs/plugins/pipeline-watch",
      },
    ],
  },
  {
    id: "event-planning-handoff",
    industry: "events-venues",
    industryName: "Events & Venues",
    title: "Assign agreed event planning commitments",
    description:
      "Confirm the agreed event scope; assign supplier access checks; verify the organizer\u2019s next planning deadline. Keep each commitment linked to the source meeting.",
    components: [
      {
        label: "Calendar connection",
        href: "/docs/workspace/integrations",
      },
      {
        label: "Meeting preparation",
        href: "/docs/plugins/meeting-prep",
      },
      {
        label: "Meeting commitments",
        href: "/docs/plugins/meeting-commitments",
      },
      {
        label: "Work",
        href: "/docs/command-center/work",
      },
    ],
  },
];

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
    "id": "roofing-inquiry",
    "industry": "home-services",
    "industryName": "Home services",
    "title": "Follow a roofing inquiry through to an estimate",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ],
    "demoScenario": "northline-roofing"
  },
  {
    "id": "job-start",
    "industry": "home-services",
    "industryName": "Home services",
    "title": "Prepare the team for a newly won job",
    "description": "Combine a won opportunity, Client onboarding and shared tasks to prepare a clear delivery handoff.",
    "components": [
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Client onboarding",
        "href": "/docs/plugins/client-onboarding"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      },
      {
        "label": "Overdue commitments",
        "href": "/docs/plugins/commitment-watch"
      }
    ],
    "demoScenario": "northline-roofing"
  },
  {
    "id": "consultation-intake",
    "industry": "law-firms",
    "industryName": "Law firms",
    "title": "Review a consultation inquiry",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ],
    "demoScenario": "alder-ridge-law"
  },
  {
    "id": "consultation-commitments",
    "industry": "law-firms",
    "industryName": "Law firms",
    "title": "Assign the next steps after a consultation",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ],
    "demoScenario": "alder-ridge-law"
  },
  {
    "id": "engagement-onboarding",
    "industry": "professional-services",
    "industryName": "Professional services",
    "title": "Start a client engagement with a shared checklist",
    "description": "Combine a won opportunity, Client onboarding and shared tasks to prepare a clear delivery handoff.",
    "components": [
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Client onboarding",
        "href": "/docs/plugins/client-onboarding"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      },
      {
        "label": "Overdue commitments",
        "href": "/docs/plugins/commitment-watch"
      }
    ],
    "demoScenario": "ledgerstone-advisory"
  },
  {
    "id": "invoice-follow-up",
    "industry": "professional-services",
    "industryName": "Professional services",
    "title": "Review outstanding invoices and prepare follow-up",
    "description": "Combine invoice evidence, customer context and reviewed reminders to decide the next collection action.",
    "components": [
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Receivables Collections",
        "href": "/docs/plugins/receivables-collections"
      },
      {
        "label": "Conversations",
        "href": "/docs/conversations"
      },
      {
        "label": "Approvals",
        "href": "/docs/command-center/approvals"
      }
    ],
    "demoScenario": "ledgerstone-advisory"
  },
  {
    "id": "buyer-follow-up",
    "industry": "real-estate",
    "industryName": "Real estate",
    "title": "Keep a buyer inquiry moving",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ],
    "demoScenario": "hearthline-realty"
  },
  {
    "id": "appointment-follow-through",
    "industry": "real-estate",
    "industryName": "Real estate",
    "title": "Prepare for an appointment and assign follow-up",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ],
    "demoScenario": "hearthline-realty"
  },
  {
    "id": "quote-request",
    "industry": "manufacturing",
    "industryName": "Manufacturing",
    "title": "Review a quote request and its next action",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ]
  },
  {
    "id": "delivery-commitments",
    "industry": "manufacturing",
    "industryName": "Manufacturing",
    "title": "Track commitments from a customer delivery meeting",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ]
  },
  {
    "id": "sales-follow-up",
    "industry": "startups",
    "industryName": "Startups",
    "title": "Review new customer inquiries and follow-up",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ]
  },
  {
    "id": "customer-kickoff",
    "industry": "startups",
    "industryName": "Startups",
    "title": "Give a new customer a clear kickoff",
    "description": "Combine a won opportunity, Client onboarding and shared tasks to prepare a clear delivery handoff.",
    "components": [
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Client onboarding",
        "href": "/docs/plugins/client-onboarding"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      },
      {
        "label": "Overdue commitments",
        "href": "/docs/plugins/commitment-watch"
      }
    ]
  },
  {
    "id": "practice-inquiry",
    "industry": "medical-dental",
    "industryName": "Medical and dental",
    "title": "Review a general appointment inquiry",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ]
  },
  {
    "id": "practice-admin",
    "industry": "medical-dental",
    "industryName": "Medical and dental",
    "title": "Track administrative meeting commitments",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ]
  },
  {
    "id": "insurance-inquiry",
    "industry": "insurance-agencies",
    "industryName": "Insurance agencies",
    "title": "Review a quote inquiry and assign follow-up",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ]
  },
  {
    "id": "insurance-onboarding",
    "industry": "insurance-agencies",
    "industryName": "Insurance agencies",
    "title": "Prepare an engagement onboarding checklist",
    "description": "Combine a won opportunity, Client onboarding and shared tasks to prepare a clear delivery handoff.",
    "components": [
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Client onboarding",
        "href": "/docs/plugins/client-onboarding"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      },
      {
        "label": "Overdue commitments",
        "href": "/docs/plugins/commitment-watch"
      }
    ]
  },
  {
    "id": "vehicle-inquiry",
    "industry": "auto-dealers",
    "industryName": "Auto dealers",
    "title": "Track a vehicle inquiry and the next conversation",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ]
  },
  {
    "id": "vehicle-handoff",
    "industry": "auto-dealers",
    "industryName": "Auto dealers",
    "title": "Assign customer handoff commitments",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ]
  },
  {
    "id": "supporter-interest",
    "industry": "nonprofits",
    "industryName": "Nonprofits",
    "title": "Review volunteer and partner interest",
    "description": "Combine reviewed intake, customer records and pipeline follow-up to give every inquiry a clear next step.",
    "components": [
      {
        "label": "Form builder",
        "href": "/docs/plugins/form-builder"
      },
      {
        "label": "Contacts",
        "href": "/docs/contacts"
      },
      {
        "label": "Pipeline",
        "href": "/docs/pipeline"
      },
      {
        "label": "Pipeline follow-up",
        "href": "/docs/plugins/pipeline-watch"
      }
    ],
    "demoScenario": "common-table-network"
  },
  {
    "id": "program-commitments",
    "industry": "nonprofits",
    "industryName": "Nonprofits",
    "title": "Turn program meetings into assigned commitments",
    "description": "Combine meeting preparation, an agreed checklist and shared tasks to keep commitments visible.",
    "components": [
      {
        "label": "Calendar connection",
        "href": "/docs/workspace/integrations"
      },
      {
        "label": "Meeting preparation",
        "href": "/docs/plugins/meeting-prep"
      },
      {
        "label": "Meeting commitments",
        "href": "/docs/plugins/meeting-commitments"
      },
      {
        "label": "Work",
        "href": "/docs/command-center/work"
      }
    ],
    "demoScenario": "common-table-network"
  }
];

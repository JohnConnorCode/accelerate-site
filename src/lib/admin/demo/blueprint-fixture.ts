/** Fictional Blueprint detail. Generated — do not hand-edit. See scripts/gen-blueprint-demo-fixture.ts. */
export interface DemoBlueprintDetail {
  blueprintId: string;
  title: string;
  status: string;
  version: number;
  parentVersion: number | null;
  changeSummary: string;
  createdAt: string;
  document: Record<string, unknown>;
  review: Record<string, unknown> & { businessSummary: string };
  blocked: unknown[];
  approvals: unknown[];
  preflight: Record<string, number>;
}
export const DEMO_BLUEPRINT_DETAIL: DemoBlueprintDetail = {
  blueprintId: "11111111-1111-4111-8111-111111111111",
  title: "Example Manufacturing Blueprint",
  status: "draft",
  version: 1,
  parentVersion: null,
  changeSummary: "Initial setup",
  createdAt: "2026-09-08T00:00:00.000Z",
  document: {
    schemaVersion: "workspace-blueprint.v1",
    businessSummary:
      "Example Manufacturing Co. sells custom projects: deposit, sampling, client review, bulk production, QA, shipment, final payment.",
    evidenceRefs: [
      {
        kind: "fact",
        statement: "Clients approve samples before bulk production",
        sources: ["founder interview"],
        quote: "After we finish samples, the customer approves them before we run production.",
      },
    ],
    assumptions: ["Deposits are required before production for new clients"],
    unresolvedQuestions: ["Who approves discounts over 10%?"],
    navigation: [
      {
        label: "Sales",
        targetType: "board",
        targetKey: "sales_pipeline",
      },
      {
        label: "Production",
        targetType: "board",
        targetKey: "production",
      },
      {
        label: "Money",
        targetType: "module",
        targetKey: "invoicing",
      },
    ],
    entities: [
      {
        classification: "recommendation",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "production_order",
        label: "Production Order",
        description: "Custom manufacturing order from deposit to delivery",
        reuseLevel: 4,
        confidence: "high",
        unresolvedQuestions: [],
      },
    ],
    relationships: [],
    workTypes: [],
    boards: [
      {
        classification: "recommendation",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "production",
        name: "Production",
        sourceType: "production_order",
        groupingField: "stage",
        columns: [
          {
            key: "sampling",
            label: "Sampling",
            lifecycleStates: ["sampling"],
          },
          {
            key: "client_review",
            label: "Client Review",
            lifecycleStates: ["client_review"],
          },
          {
            key: "production",
            label: "Production",
            lifecycleStates: ["production"],
          },
          {
            key: "qa",
            label: "QA",
            lifecycleStates: ["qa"],
          },
          {
            key: "shipping",
            label: "Shipping",
            lifecycleStates: ["shipping"],
          },
          {
            key: "delivered",
            label: "Delivered",
            lifecycleStates: ["delivered"],
          },
        ],
        cardFields: ["customer", "due_date"],
      },
      {
        classification: "recommendation",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "sales_pipeline",
        name: "Sales Pipeline",
        sourceType: "opportunity",
        groupingField: "stage",
        columns: [
          {
            key: "new",
            label: "New",
            lifecycleStates: ["new"],
          },
          {
            key: "proposal",
            label: "Proposal",
            lifecycleStates: ["proposal"],
          },
          {
            key: "won",
            label: "Won",
            lifecycleStates: ["won"],
          },
        ],
        cardFields: ["value"],
      },
    ],
    views: [],
    dashboards: [],
    workflows: [
      {
        classification: "recommendation",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "won_opportunity_onboarding",
        name: "Won opportunity to production onboarding",
        trigger: {
          kind: "record_transition",
          ref: "opportunity.stage -> won",
        },
        steps: [
          {
            key: "create_project",
            kind: "deterministic",
            description: "Create production order",
            capabilityKey: "orders.create",
          },
          {
            key: "draft_welcome",
            kind: "ai_judgment",
            description: "Draft welcome email",
            capabilityKey: "email.draft",
          },
          {
            key: "send_welcome",
            kind: "action",
            description: "Send welcome email after approval",
            capabilityKey: "email.send",
          },
        ],
        requiredIntegrations: ["drive"],
        failureBehavior: "Retry deterministic steps twice; queue approval expiry after 7 days.",
      },
    ],
    triggers: [],
    coworkers: [
      {
        classification: "recommendation",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "operations",
        name: "Operations",
        purpose: "Keep production orders moving and escalate stuck client reviews",
        workKinds: ["review_stuck_order"],
        requiredCapabilities: ["orders.read"],
        relevantEntities: ["production_order"],
        autonomyPolicy: "ask_until_trusted",
        escalation: "Escalate client reviews waiting more than 3 days",
      },
    ],
    skills: [],
    attentionRules: [
      {
        classification: "inference",
        evidence: [
          {
            kind: "inference",
            statement: "Deposit precedes the production handoff",
            sources: ["founder interview"],
            quote: "Once the deposit arrives, we send the order to production.",
          },
        ],
        key: "stuck_client_review",
        entityType: "production_order",
        condition: "stage = client_review AND waiting > 3 days",
        severity: "work",
      },
    ],
    reports: [],
    integrationRequirements: [
      {
        capability: "drive",
        reason: "Automatic project folders",
        requiredFor: ["won_opportunity_onboarding"],
      },
    ],
    permissionPolicies: [],
    autonomyPolicies: [],
    installedAppRecommendations: [],
    migrationPlan: {
      behavior: "Existing records retain current state",
      retainExistingState: true,
    },
  },
  review: {
    businessSummary:
      "Example Manufacturing Co. sells custom projects: deposit, sampling, client review, bulk production, QA, shipment, final payment.",
    businessModel: [
      {
        ref: "entity:production_order",
        title: "Production Order",
        detail: "New type (level 4) · Custom manufacturing order from deposit to delivery",
        status: "ready",
        statusReason: null,
        impact: "structural",
      },
    ],
    workflows: [
      {
        ref: "workflow:won_opportunity_onboarding",
        title: "Won opportunity to production onboarding",
        detail:
          "Trigger record_transition opportunity.stage -> won · 3 steps (0 blocked, 1 need approval)",
        status: "approval",
        statusReason: "0 blocked, 1 need approval",
        impact: "structural",
      },
    ],
    boards: [
      {
        ref: "board:production",
        title: "Production",
        detail: "Projects production_order.stage across 6 columns",
        status: "ready",
        statusReason: null,
        impact: "structural",
      },
      {
        ref: "board:sales_pipeline",
        title: "Sales Pipeline",
        detail: "Projects opportunity.stage across 3 columns",
        status: "ready",
        statusReason: null,
        impact: "structural",
      },
    ],
    coworkers: [
      {
        ref: "coworker:operations",
        title: "Operations",
        detail:
          "Keep production orders moving and escalate stuck client reviews · review_stuck_order",
        status: "ready",
        statusReason: null,
        impact: "structural",
      },
    ],
    integrations: [
      {
        ref: "integration:drive",
        title: "drive",
        detail: "Automatic project folders · for won_opportunity_onboarding",
        status: "blocked",
        statusReason: "Integration not connected",
        impact: "external_authority",
      },
    ],
    questions: [
      {
        ref: "question:0",
        title: "Who approves discounts over 10%?",
        detail: "Needs an operator answer before apply",
        status: "info",
        statusReason: null,
        impact: null,
      },
      {
        ref: "assumption:0",
        title: "Deposits are required before production for new clients",
        detail: "Architect assumption — confirm or correct",
        status: "info",
        statusReason: null,
        impact: null,
      },
    ],
    gates: {
      blueprintLevel: [
        {
          ref: "navigation:Sales",
          label: "Navigation: Sales",
          level: "low_risk",
        },
        {
          ref: "navigation:Production",
          label: "Navigation: Production",
          level: "low_risk",
        },
        {
          ref: "navigation:Money",
          label: "Navigation: Money",
          level: "low_risk",
        },
      ],
      explicitWorkspaceChange: [
        {
          ref: "entity:production_order",
          label: "Entity: Production Order",
          level: "structural",
        },
        {
          ref: "board:production",
          label: "Board: Production",
          level: "structural",
        },
        {
          ref: "board:sales_pipeline",
          label: "Board: Sales Pipeline",
          level: "structural",
        },
        {
          ref: "workflow:won_opportunity_onboarding",
          label: "Workflow: Won opportunity to production onboarding",
          level: "structural",
        },
        {
          ref: "coworker:operations",
          label: "Coworker: Operations",
          level: "structural",
        },
        {
          ref: "attention:stuck_client_review",
          label: "Attention rule: stuck_client_review",
          level: "structural",
        },
      ],
      externalAuthority: [
        {
          ref: "integration:drive",
          label: "Integration: drive",
          level: "external_authority",
        },
      ],
    },
    preflight: {
      navigation: 3,
      newEntityTypes: 1,
      boards: 2,
      views: 0,
      dashboards: 0,
      workflows: 1,
      coworkers: 1,
      skills: 0,
      attentionRules: 1,
      appEnablements: 0,
      destructiveOperations: 0,
    },
    blockedCount: 2,
    approvalCount: 1,
  },
  blocked: [
    {
      ref: "workflow:won_opportunity_onboarding",
      kind: "unavailable_capability",
      key: "drive",
      reason: "Capability unavailable",
    },
    {
      ref: "integration",
      kind: "unavailable_capability",
      key: "drive",
      reason: "Integration not connected",
    },
  ],
  approvals: [
    {
      ref: "workflow:won_opportunity_onboarding/step:send_welcome",
      kind: "workflow_step",
      key: "email.send",
      reason: "Approval required",
    },
  ],
  preflight: {
    navigation: 3,
    newEntityTypes: 1,
    boards: 2,
    views: 0,
    dashboards: 0,
    workflows: 1,
    coworkers: 1,
    skills: 0,
    attentionRules: 1,
    appEnablements: 0,
    destructiveOperations: 0,
  },
};

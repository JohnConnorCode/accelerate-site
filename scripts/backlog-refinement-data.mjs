// Reviewed refinement templates, not a second status/priority authority.
export const refinementSlices = [
  {
    key: "canonical-tools-route-inventory",
    parent: "additional-tools-canonical-parity",
    title: "Reconcile retained admin routes with their canonical owners",
    phase: "B",
    refs: ["src/lib/admin/navigation.ts", "src/lib/revenue-os/README.md"],
    checks: ["test:route-coverage"],
    acceptance: [
      "Inventory each retained admin route, its canonical service, compatibility source and primary action in a checked-in reconciliation artifact.",
      "Identify missing field/row parity as linked work with the source record IDs and controlled verification procedure; do not remove routes or data.",
    ],
  },
  {
    key: "canonical-revenue-activity-parity",
    parent: "additional-tools-canonical-parity",
    title: "Reconcile Revenue and Activity with canonical records and receipts",
    phase: "B",
    refs: ["src/lib/revenue-os/analytics.ts", "src/lib/revenue-os/activity.ts"],
    checks: ["test:analytics-decision-model", "test:activity-ledger"],
    acceptance: [
      "Revenue and Activity read canonical opportunity, stage and activity services, with explicit dispositions for retained legacy fields.",
      "Controlled fixtures prove repeated inbound events link once and totals/activity agree across UI and services; production parity remains a separate recorded acceptance before any compatibility retirement.",
    ],
  },
  {
    key: "canonical-retained-tools-parity",
    parent: "additional-tools-canonical-parity",
    title: "Bring retained source tools onto shared admin and canonical read contracts",
    phase: "B",
    refs: ["src/lib/revenue-os/legacy-adapter.ts", "src/lib/admin/navigation.ts"],
    checks: ["test:admin-layout", "test:route-coverage"],
    acceptance: [
      "Use the route inventory to adapt remaining source-tool reads without adding identity, task, sender or analytics writers.",
      "Every retained primary action has desktop/mobile keyboard, loading/error/retry coverage, with canonical links and explicit compatibility exclusions; preserve every existing route.",
    ],
  },
  {
    key: "docs-first-value-guide",
    parent: "docs-content-first-pass",
    title: "Document installation and the first useful business journey",
    phase: "A",
    refs: ["src/content/docs/manifest.ts", "docs/self-hosting/SELF-HOSTING.md"],
    checks: ["verify:docs", "test:no-fabricated-claims"],
    acceptance: [
      "Reconcile current manifest entries and existing onboarding pages before adding content; define workspace, record, work, approval and receipt using shipped behavior.",
      "A newcomer can follow installation through one controlled lead-to-next-action journey; document missing providers and recovery with working internal links.",
    ],
  },
  {
    key: "docs-sales-operator-guide",
    parent: "docs-content-first-pass",
    title: "Document Pipeline, Conversations and Proposal operator journeys",
    phase: "C",
    refs: [
      "src/content/docs/manifest.ts",
      "src/lib/admin/navigation.ts",
      "src/app/admin/proposals/page.tsx",
    ],
    checks: ["verify:docs", "test:no-fabricated-claims"],
    acceptance: [
      "Document actual capture, identity review, stage movement, reply approval and proposal decisions with linked module-owned references.",
      "Each journey names a successful result, unavailable-provider state and recovery path; every page is registered and internal links resolve.",
    ],
  },
  {
    key: "docs-engagement-support-guide",
    parent: "docs-content-first-pass",
    title: "Document Campaign, Email Studio and Support workflows that are available",
    phase: "E",
    refs: [
      "src/content/docs/manifest.ts",
      "src/lib/revenue-os/campaigns.ts",
      "src/lib/revenue-os/knowledge.ts",
    ],
    checks: ["verify:docs", "test:no-fabricated-claims"],
    acceptance: [
      "Document audience review, composition, approval, scheduling, stop conditions and customer-response work against merged runtime behavior.",
      "Planned Support or campaign capabilities are clearly identified as unavailable, with no stub how-to claiming they work; verify links and shared terminology.",
    ],
  },
  {
    key: "docs-admin-recovery-guide",
    parent: "docs-content-first-pass",
    title: "Document workspace setup, permissions and operational recovery",
    phase: "B",
    refs: [
      "src/content/docs/manifest.ts",
      "src/lib/revenue-os/setup-status.ts",
      "src/lib/revenue-os/health.ts",
    ],
    checks: ["verify:docs", "test:no-fabricated-claims"],
    acceptance: [
      "Explain integrations, missing configuration, truthful health, approvals, tasks and incident recovery through the actual operator screens.",
      "Separate founder platform authority from tenant permissions and prove every documented recovery command has a bounded environment and working reference.",
    ],
  },
  {
    key: "docs-extension-developer-guide",
    parent: "docs-content-first-pass",
    title: "Document a version-matched extension and MCP developer journey",
    phase: "D",
    refs: [
      "src/content/docs/manifest.ts",
      "docs/contributing/EXTENDING.md",
      "docs/self-hosting/MCP-SETUP.md",
    ],
    checks: ["verify:docs", "test:plugin-modules", "test:mcp-server"],
    acceptance: [
      "Reuse the existing MCP and extension documentation to guide one working plugin from capability declaration to controlled execution, verification and removal.",
      "Document supported contracts and trust/tenant boundaries against the exact integration commit; reconcile manifest coverage and remove allow-missing exceptions only when all required pages exist.",
    ],
  },
];
export const phaseProofs = [
  {
    phase: "A",
    deps: [
      "identity-resolution-service",
      "communication-sender-service",
      "drive-provenance-retrieval",
    ],
    refs: [
      "src/lib/revenue-os/identity.ts",
      "src/lib/revenue-os/communications.ts",
      "src/lib/revenue-os/knowledge.ts",
    ],
    checks: ["test:identity-resolution", "test:knowledge"],
    acceptance: [
      "A controlled inquiry creates one canonical identity, opportunity, next action and receipted approved response.",
      "Retrieved business context identifies source records and dates; duplicate input and provider failure preserve truthful state and permit safe recovery.",
    ],
  },
  {
    phase: "B",
    deps: [
      "durable-work-engine",
      "capability-graph-canonical",
      "evidence-claim-ledger",
      "autonomy-policy-engine",
      "work-completion-truth",
    ],
    refs: [
      "src/lib/revenue-os/work-items.ts",
      "src/lib/revenue-os/autonomy-policy.ts",
      "src/lib/revenue-os/capabilities.ts",
    ],
    checks: ["test:action-execution", "test:tenant-isolation"],
    acceptance: [
      "Controlled interruption and concurrency prove work persists without duplicate effects, with retry/deferred/failed outcomes and an inspectable receipt.",
      "UI, internal agents and plugins share capability, authorization, provenance and budget checks; revocation, human-confirmed facts and exhausted budgets fail safely.",
    ],
  },
  {
    phase: "C",
    deps: [
      "coworker-model",
      "communication-sender-service",
      "calendar-sync-association",
      "precall-briefs",
      "postmeeting-workflow",
    ],
    refs: [
      "src/lib/revenue-os/sales-coworker.ts",
      "src/lib/revenue-os/coworker-agent.ts",
      "src/lib/revenue-os/google.ts",
    ],
    checks: ["test:ai-command-runtime", "test:command-center-scheduler"],
    acceptance: [
      "A controlled lead progresses through identity/context, qualification, durable reply draft, approval/send, booking, meeting brief, reviewed commitments and follow-up.",
      "Receipts link the same canonical records throughout; future work has a reason, and missing integration, rejection, duplicate event and provider failure remain recoverable.",
    ],
  },
  {
    phase: "D",
    deps: ["plugin-conformance-kit", "plugin-cli-and-scaffold", "plugin-install-lifecycle"],
    refs: [
      "src/lib/revenue-os/plugins.ts",
      "src/lib/revenue-os/plugin-isolate.ts",
      "docs/contributing/EXTENDING.md",
    ],
    checks: ["test:plugin-isolate", "test:capability-data-api", "test:mcp-server"],
    acceptance: [
      "A separately authored example installs, executes and uninstalls using documented public contracts without importing private services or introducing parallel infrastructure.",
      "Conformance proves declared capabilities, tenant isolation, permission revocation, bounded usage, safe retry and retained business data across lifecycle changes.",
    ],
  },
  {
    phase: "E",
    deps: ["receivables-workspace-demo", "first-value-business-journey"],
    refs: ["docs/contracts/BUSINESS-PLUGIN-EXEMPLARS.md", "src/lib/revenue-os/plugins.ts"],
    checks: ["test:plugin-modules", "test:delivery-handoff"],
    acceptance: [
      "An operator completes a controlled delivery/invoice/collections business journey using additional plugins and the shared runtime.",
      "The evidence records accountable next actions, balances from actual invoice facts, governed reminders and dispute recovery; define business measures without inventing adoption or revenue results.",
    ],
  },
];

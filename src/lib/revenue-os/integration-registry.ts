export const INTEGRATION_REGISTRY_VERSION = "revenue-os-integrations.v1";

export type IntegrationMaturity = "native" | "next" | "planned" | "edge";
export type IntegrationCostTier = "free" | "usage_included" | "usage_based" | "paid";
export type IntegrationTransport = "webhook" | "push" | "incremental_sync" | "scheduled_sync" | "manual" | "api";
export type IntegrationStatus = "ready" | "degraded" | "action" | "available" | "planned";

export interface IntegrationCapabilityDefinition {
  id: string;
  label: string;
  description: string;
  direction: "read" | "write" | "bidirectional";
  impact: "read" | "internal_write" | "external_action";
  configurationKey?: string;
  evidenceKey?: `runtime:${string}` | `source:${string}` | `job:${string}` | `webhook:${string}`;
  requiredScopes?: string[];
  freshnessHours?: number;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: "foundation" | "workspace" | "revenue" | "knowledge" | "notifications" | "crm" | "delivery" | "interoperability";
  maturity: IntegrationMaturity;
  priority: number;
  description: string;
  strategicRole: string;
  cost: { tier: IntegrationCostTier; label: string; detail: string };
  auth: string;
  transports: IntegrationTransport[];
  dataClasses: string[];
  connectionProvider?: string;
  configurationKey?: string;
  setupHref?: string;
  docsHref: string;
  limits: string[];
  guardrail: string;
  capabilities: IntegrationCapabilityDefinition[];
}

const googleScopes = {
  gmailRead: "https://www.googleapis.com/auth/gmail.readonly",
  gmailSend: "https://www.googleapis.com/auth/gmail.send",
  calendar: "https://www.googleapis.com/auth/calendar.events",
  drive: "https://www.googleapis.com/auth/drive.readonly",
};

export const integrationRegistry: readonly IntegrationDefinition[] = [
  {
    id: "supabase", name: "Supabase", category: "foundation", maturity: "native", priority: 1,
    description: "Canonical records, authentication, receipts, audit history, realtime state, and the future durable queue.",
    strategicRole: "System of record",
    cost: { tier: "free", label: "Free-first", detail: "Use the free envelope until storage, egress, backup, retention, or reliability thresholds require an upgrade." },
    auth: "Server-only project credentials", transports: ["api", "push"], dataClasses: ["Canonical business records", "Audit and execution receipts"],
    configurationKey: "supabase", setupHref: "/admin/setup#supabase", docsHref: "https://supabase.com/docs",
    limits: ["Free projects can pause after inactivity", "Cron is a wake-up adapter, not a business-logic host", "Production upgrades are driven by measured reliability and retention needs"],
    guardrail: "Provider rows are infrastructure; domain services remain the only authoritative writers.",
    capabilities: [
      { id: "canonical-data", label: "Canonical data", description: "Store and retrieve Revenue OS records through the service boundary.", direction: "bidirectional", impact: "internal_write", configurationKey: "supabase", evidenceKey: "runtime:supabase" },
      { id: "realtime", label: "Realtime operator state", description: "Broadcast changes to authenticated admin surfaces without browser-owned truth.", direction: "read", impact: "read", configurationKey: "supabase", evidenceKey: "runtime:supabase" },
      { id: "scheduler", label: "Continuous scheduler", description: "Wake authenticated Revenue OS jobs on a sub-daily cadence while keeping business logic in application services.", direction: "write", impact: "internal_write", configurationKey: "supabase", evidenceKey: "job:system-health-snapshot", freshnessHours: 0.5 },
    ],
  },
  {
    id: "google", name: "Google Workspace", category: "workspace", maturity: "native", priority: 2,
    description: "Gmail conversations, Calendar meetings, and explicitly selected Drive knowledge.", strategicRole: "Primary operating context",
    cost: { tier: "usage_included", label: "Usage included", detail: "Standard Workspace API quotas cover normal operation; usage and provider policy changes still require monitoring." },
    auth: "OAuth 2.0 with minimum scopes", transports: ["push", "incremental_sync", "scheduled_sync"], dataClasses: ["Email", "Calendar", "Selected documents"],
    connectionProvider: "google", configurationKey: "google", setupHref: "/admin/setup#google", docsHref: "https://developers.google.com/workspace",
    limits: ["Push-first with cursor recovery", "Drive access remains folder-allowlisted", "Quota and scope drift must degrade visibly"],
    guardrail: "Never ingest unrestricted Drive or infer identity from display names. External mutations remain approval-gated.",
    capabilities: [
      { id: "gmail-read", label: "Gmail sync", description: "Incrementally synchronize threads, replies, and unread work.", direction: "read", impact: "read", configurationKey: "google", evidenceKey: "source:gmail", requiredScopes: [googleScopes.gmailRead], freshnessHours: 26 },
      { id: "gmail-send", label: "Threaded Gmail reply", description: "Send a confirmed personal reply through the canonical communication path.", direction: "write", impact: "external_action", configurationKey: "google", requiredScopes: [googleScopes.gmailSend] },
      { id: "calendar", label: "Calendar sync", description: "Associate meetings with canonical records and operating work.", direction: "bidirectional", impact: "external_action", configurationKey: "google", evidenceKey: "source:google_calendar", requiredScopes: [googleScopes.calendar], freshnessHours: 26 },
      { id: "drive", label: "Selected Drive knowledge", description: "Index only approved folders with provenance and deletion propagation.", direction: "read", impact: "read", configurationKey: "google", evidenceKey: "source:google_drive", requiredScopes: [googleScopes.drive], freshnessHours: 26 },
    ],
  },
  {
    id: "resend", name: "Resend", category: "notifications", maturity: "native", priority: 3,
    description: "Transactional and campaign delivery with canonical receipts and suppression feedback.", strategicRole: "Auditable delivery",
    cost: { tier: "free", label: "Free tier", detail: "Start within the provider's free monthly and daily envelope, then upgrade based on verified send volume." },
    auth: "Server-only API key and signed webhooks", transports: ["api", "webhook"], dataClasses: ["Recipients", "Message metadata", "Delivery events"],
    configurationKey: "resend", setupHref: "/admin/setup#email", docsHref: "https://resend.com/docs",
    limits: ["One canonical sender", "Daily campaign cap", "Signed delivery feedback required for trustworthy outcomes"],
    guardrail: "API acceptance is not delivery. Retries reuse the original idempotency key and uncertain results require reconciliation.",
    capabilities: [
      { id: "delivery", label: "Recorded email delivery", description: "Send through the shared sender and retain the provider receipt.", direction: "write", impact: "external_action", configurationKey: "resend", evidenceKey: "runtime:resend" },
      { id: "feedback", label: "Delivery feedback", description: "Process signed bounce, complaint, suppression, delivery, open, and click events.", direction: "read", impact: "internal_write", configurationKey: "resend_webhooks", evidenceKey: "webhook:resend", freshnessHours: 720 },
    ],
  },
  {
    id: "openrouter", name: "OpenRouter", category: "foundation", maturity: "native", priority: 4,
    description: "One governed model gateway for bounded analysis, retrieval, drafting, and registered tools.", strategicRole: "Model gateway",
    cost: { tier: "usage_based", label: "Usage based", detail: "Use workflow-specific model routing and budgets rather than adding separate provider credentials." },
    auth: "Server-only API key", transports: ["api"], dataClasses: ["Bounded operating context", "Redacted traces"],
    configurationKey: "openrouter", setupHref: "/admin/setup#openrouter", docsHref: "https://openrouter.ai/docs",
    limits: ["Bounded context and turns", "Registered tools only", "Per-run usage receipts"],
    guardrail: "Models never receive database or provider credentials and never perform unrestricted writes.",
    capabilities: [
      { id: "governed-ai", label: "Governed intelligence", description: "Run bounded model workflows with immutable traces and tool gates.", direction: "bidirectional", impact: "internal_write", configurationKey: "openrouter", evidenceKey: "runtime:openrouter" },
    ],
  },
  {
    id: "first-party", name: "First-party website", category: "revenue", maturity: "native", priority: 5,
    description: "Forms, qualifier, chat, bookings, and privacy-minimized analytics enter the canonical revenue loop directly.", strategicRole: "Native demand capture",
    cost: { tier: "free", label: "First party", detail: "No additional analytics, form, or lead-capture subscription." },
    auth: "Signed or validated public entrypoints", transports: ["api", "push"], dataClasses: ["Inbound inquiries", "Attribution", "Anonymous website events"],
    setupHref: "/admin/setup#analytics", docsHref: "/admin/setup",
    limits: ["Rate-limited public entrypoints", "No IP, user-agent, or cross-site identity in analytics"],
    guardrail: "A delivery failure can never discard an already accepted inquiry.",
    capabilities: [
      { id: "capture", label: "Canonical lead capture", description: "Resolve identity and create one attributable revenue record.", direction: "read", impact: "internal_write", evidenceKey: "runtime:first-party" },
      { id: "analytics", label: "First-party analytics", description: "Measure attention and conversion without another vendor.", direction: "read", impact: "read", evidenceKey: "runtime:first-party" },
    ],
  },
  {
    id: "microsoft", name: "Microsoft 365", category: "workspace", maturity: "next", priority: 10,
    description: "Outlook, Calendar, OneDrive, SharePoint, Teams, To Do, Planner, and Bookings parity through Microsoft Graph.", strategicRole: "Workspace parity",
    cost: { tier: "usage_included", label: "License included", detail: "Standard Graph APIs are generally included within licensed-user thresholds." },
    auth: "OAuth 2.0 with delegated minimum scopes", transports: ["push", "incremental_sync"], dataClasses: ["Email", "Calendar", "Selected files", "Tasks"], docsHref: "https://learn.microsoft.com/graph/overview",
    limits: ["Change notifications plus delta recovery", "Honor Retry-After and provider throttling"],
    guardrail: "Microsoft data maps to the same canonical services as Google; it does not create a parallel CRM.",
    capabilities: [
      { id: "outlook", label: "Outlook mail", description: "Threaded mail synchronization and confirmed replies.", direction: "bidirectional", impact: "external_action" },
      { id: "calendar", label: "Outlook calendar", description: "Meeting synchronization and confirmed mutations.", direction: "bidirectional", impact: "external_action" },
      { id: "files", label: "OneDrive and SharePoint", description: "Selected document indexing with provenance.", direction: "read", impact: "read" },
    ],
  },
  {
    id: "stripe", name: "Stripe", category: "revenue", maturity: "next", priority: 11,
    description: "Payments, invoices, subscriptions, refunds, and disputes linked to canonical companies and opportunities.", strategicRole: "Payment truth",
    cost: { tier: "usage_based", label: "No integration fee", detail: "The connector adds no subscription; normal Stripe transaction pricing still applies." },
    auth: "Restricted server key and signed webhooks", transports: ["webhook", "incremental_sync"], dataClasses: ["Customer identity", "Invoices", "Payments"], docsHref: "https://docs.stripe.com/webhooks",
    limits: ["Webhook events may arrive out of order", "Reconcile uncertain state from the API"],
    guardrail: "Stripe owns payment facts; Command Center owns revenue context and attribution.",
    capabilities: [{ id: "revenue-events", label: "Revenue events", description: "Connect actual payment state to pipeline, campaigns, and delivery.", direction: "read", impact: "internal_write" }],
  },
  {
    id: "slack", name: "Slack", category: "notifications", maturity: "next", priority: 12,
    description: "Deliver briefs, alerts, and approval links without making chat the system of record.", strategicRole: "Notification and approval surface",
    cost: { tier: "free", label: "Free-first", detail: "Useful for delivery and approvals within free workspace limits." },
    auth: "OAuth 2.0 with selected workspace scopes", transports: ["api", "webhook"], dataClasses: ["Notifications", "Selected channel context"], docsHref: "https://api.slack.com/apis",
    limits: ["Free history is limited", "Only explicitly selected channels may be read"],
    guardrail: "Approvals execute in Command Center; Slack never becomes the durable action ledger.",
    capabilities: [{ id: "notifications", label: "Briefs and approvals", description: "Deliver actionable notifications that link back to canonical work.", direction: "write", impact: "external_action" }],
  },
  {
    id: "notion", name: "Notion", category: "knowledge", maturity: "next", priority: 13,
    description: "Selected pages and databases become cited knowledge while Notion remains their source.", strategicRole: "Curated knowledge source",
    cost: { tier: "free", label: "Free-first", detail: "The public API works with free workspaces within provider limits." },
    auth: "OAuth or internal integration with selected pages", transports: ["webhook", "incremental_sync"], dataClasses: ["Selected pages", "Database records"], docsHref: "https://developers.notion.com/",
    limits: ["Respect average request limits", "Propagate edits, permissions, and deletion"],
    guardrail: "Only explicitly shared content is indexed; generated summaries never overwrite source facts.",
    capabilities: [{ id: "knowledge", label: "Selected workspace knowledge", description: "Index approved content with source, date, and citations.", direction: "read", impact: "read" }],
  },
  {
    id: "hubspot", name: "HubSpot", category: "crm", maturity: "planned", priority: 20,
    description: "Safe import or coexistence for businesses already using HubSpot.", strategicRole: "CRM adoption bridge",
    cost: { tier: "free", label: "Free CRM compatible", detail: "Start with import and narrowly owned synchronization." },
    auth: "Private app or OAuth", transports: ["webhook", "incremental_sync"], dataClasses: ["Contacts", "Companies", "Deals"], docsHref: "https://developers.hubspot.com/docs/api/overview",
    limits: ["Explicit canonical owner per object", "Conflict queue for ambiguous changes"],
    guardrail: "Never enable uncontrolled bidirectional sync or dual ownership.",
    capabilities: [{ id: "crm-coexistence", label: "CRM import and coexistence", description: "Map external CRM records to canonical identity with provenance.", direction: "bidirectional", impact: "internal_write" }],
  },
  {
    id: "accounting", name: "QuickBooks / Xero", category: "revenue", maturity: "planned", priority: 21,
    description: "Invoice and payment reconciliation for installations that need accounting truth beyond Stripe.", strategicRole: "Accounting reconciliation",
    cost: { tier: "paid", label: "Client-dependent", detail: "Prioritize only where the client already operates the accounting platform." },
    auth: "OAuth 2.0", transports: ["webhook", "incremental_sync"], dataClasses: ["Invoices", "Payments", "Customer references"], docsHref: "https://developer.intuit.com/",
    limits: ["Read-first reconciliation", "No autonomous accounting writes"],
    guardrail: "Accounting systems own ledger facts; discrepancies become review work.",
    capabilities: [{ id: "invoice-reconciliation", label: "Invoice reconciliation", description: "Compare operational revenue with accounting outcomes.", direction: "read", impact: "read" }],
  },
  {
    id: "delivery-tools", name: "Delivery tools", category: "delivery", maturity: "planned", priority: 22,
    description: "Linear, Asana, ClickUp, Trello, or Jira selected per client—not installed indiscriminately.", strategicRole: "Client delivery context",
    cost: { tier: "paid", label: "Client-dependent", detail: "Use the system the client already operates." },
    auth: "Provider OAuth or scoped token", transports: ["webhook", "incremental_sync"], dataClasses: ["Projects", "Issues", "Commitments"], docsHref: "/admin/features",
    limits: ["One authoritative owner for shared tasks", "Connector chosen through tenant configuration"],
    guardrail: "Do not create permanent dual-write task loops.",
    capabilities: [{ id: "delivery-sync", label: "Delivery context", description: "Connect sold work to execution progress and commitments.", direction: "bidirectional", impact: "internal_write" }],
  },
  {
    id: "n8n", name: "n8n", category: "interoperability", maturity: "edge", priority: 30,
    description: "Optional self-hosted edge orchestration for uncommon providers and client-specific triggers.", strategicRole: "Long-tail adapter",
    cost: { tier: "free", label: "Self-hostable", detail: "Community Edition can cover narrow edge workflows without another hosted subscription." },
    auth: "Signed Command Center APIs", transports: ["webhook", "api"], dataClasses: ["Bounded event envelopes"], docsHref: "https://docs.n8n.io/hosting/",
    limits: ["No canonical state", "No hidden business rules", "Signed and replay-safe calls only"],
    guardrail: "n8n may wake or adapt the system; it never owns core workflows or execution truth.",
    capabilities: [{ id: "edge-automation", label: "Long-tail automation", description: "Adapt uncommon sources into versioned signed entrypoints.", direction: "bidirectional", impact: "internal_write" }],
  },
  {
    id: "mcp", name: "Model Context Protocol", category: "interoperability", maturity: "edge", priority: 31,
    description: "Expose bounded Command Center tools and consume only allowlisted third-party servers.", strategicRole: "Agent interoperability",
    cost: { tier: "free", label: "Open protocol", detail: "Protocol support has no platform fee; connected services may have their own costs." },
    auth: "OAuth 2.1 audience-bound tokens", transports: ["api"], dataClasses: ["Bounded tool inputs and cited outputs"], docsHref: "https://modelcontextprotocol.io/specification/latest",
    limits: ["Read-only server first", "Pinned allowlist", "No token passthrough"],
    guardrail: "MCP maps to the existing tool registry and action queue; it never bypasses domain services or confirmation.",
    capabilities: [{ id: "agent-tools", label: "Bounded agent tools", description: "Make approved reads portable and stage mutations for founder review.", direction: "bidirectional", impact: "internal_write" }],
  },
] as const;

export function getIntegrationDefinition(id: string): IntegrationDefinition | null {
  return integrationRegistry.find((provider) => provider.id === id) ?? null;
}

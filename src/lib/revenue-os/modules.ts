/**
 * Pluggable Module Contract for Revenue OS
 *
 * Separates always-on core capabilities (auth, tenancy, contacts, companies,
 * pipeline, conversations, activity, tasks, identity, AI context) from optional
 * pluggable business modules (proposals, campaigns, bookings, recovery, etc.).
 *
 * Rules:
 * - Module enablement is a deployment-time or tenant-configuration choice.
 * - Core modules cannot be disabled (isCore: true).
 * - Disabling a module removes its navigation entries, marks its AI tools unavailable,
 *   and refuses routes fail-closed without dangling references.
 * - No dynamic execution of untrusted code; modules are declarative statically-typed seams.
 */

export type ModuleCategory = "revenue" | "delivery" | "intelligence" | "sources" | "system";

export interface RevenueOSModule {
  /** Unique stable module key. */
  id: string;
  /** Human-readable module name. */
  name: string;
  /** Concise description of what this module provides. */
  description: string;
  /** High-level capability domain. */
  category: ModuleCategory;
  /** Core modules are mandatory for Revenue OS operation and cannot be toggled off. */
  isCore: boolean;
  /** Default enablement status for new / standard workspaces. */
  defaultEnabled: boolean;
  /** Navigation link IDs registered in adminNavSections. */
  navLinkIds: string[];
  /** AI tool names in the ai-tools registry provided or used by this module. */
  aiToolNames?: string[];
  /** Admin route prefixes owned by this module. */
  routes?: string[];
  /** Setup Center check IDs relevant to this module. */
  setupChecks?: string[];
  /** External documentation or guide URL. */
  docsUrl?: string;
}

/**
 * Authoritative module registry for Revenue OS.
 */
export const REVENUE_OS_MODULES: readonly RevenueOSModule[] = [
  // --- Core Modules (Always Enabled) ---
  {
    id: "core-command",
    name: "Command Center & Inbox",
    description: "Daily operator triage queue, activity audit trail, and inbound inbox.",
    category: "system",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["today", "inbox", "activity"],
    routes: ["/admin/today", "/admin/inbox", "/admin/activity"],
    aiToolNames: [
      "get_today_snapshot",
      "get_record_timeline",
      "get_pending_actions",
      "propose_task",
      "propose_layout_change",
      "propose_founder_note",
    ],
  },
  {
    id: "core-pipeline",
    name: "Opportunity Pipeline",
    description: "Revenue stage progression, opportunity records, and value forecasting.",
    category: "revenue",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["pipeline"],
    routes: ["/admin/pipeline"],
    aiToolNames: ["search_pipeline", "propose_stage_change"],
  },
  {
    id: "core-conversations",
    name: "Omnichannel Conversations",
    description: "Unified communication inbox synchronizing Gmail, inbound forms, and direct messages.",
    category: "revenue",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["conversations"],
    routes: ["/admin/conversations"],
    aiToolNames: ["propose_send_email", "search_conversations", "propose_conversation_reply"],
  },
  {
    id: "core-contacts",
    name: "Contact Intake & Identity",
    description: "Deterministic identity resolution, deduplicated contact ledger, and company linking.",
    category: "revenue",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["contacts"],
    routes: ["/admin/contacts"],
    aiToolNames: ["search_contacts"],
  },
  {
    id: "core-intelligence",
    name: "AI Grounding & Knowledge",
    description: "Second Brain knowledge retrieval, bounded context model loops, and run traces.",
    category: "intelligence",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["ai"],
    routes: ["/admin/ai"],
    aiToolNames: ["search_knowledge_base"],
  },
  {
    id: "core-system",
    name: "System Settings & Tenancy",
    description: "Tenant workspace provisioning, setup verification, and operating preferences.",
    category: "system",
    isCore: true,
    defaultEnabled: true,
    navLinkIds: ["tenants", "setup", "features", "settings"],
    routes: ["/admin/tenants", "/admin/setup", "/admin/features", "/admin/settings"],
  },

  // --- Optional / Pluggable Business Modules ---
  {
    id: "proposals",
    name: "Proposals & Estimates",
    description: "Proposal drafting, pricing validation, scope decisions, and status tracking.",
    category: "revenue",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["proposals"],
    routes: ["/admin/proposals"],
  },
  {
    id: "campaigns",
    name: "Outbound Campaigns",
    description: "Controlled multi-step email campaigns, versioned copy, and sequence delivery runs.",
    category: "revenue",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["campaigns", "delivery-runs"],
    routes: ["/admin/campaigns", "/admin/email-sequences"],
    aiToolNames: ["propose_campaign_activation"],
    setupChecks: ["resend_configured", "campaign_readiness"],
  },
  {
    id: "email-studio",
    name: "Email Studio",
    description: "Live transactional and marketing email template editor, previewer, and versioning.",
    category: "revenue",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["emails"],
    routes: ["/admin/emails"],
  },
  {
    id: "recovery",
    name: "Revenue Recovery",
    description: "Reactivation playbooks for stale opportunities, no-shows, and past quotes.",
    category: "revenue",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["recovery"],
    routes: ["/admin/recovery"],
  },
  {
    id: "revenue",
    name: "Revenue Analytics & Valuation",
    description: "Closed revenue tracking, recurring client value metrics, and attribution.",
    category: "revenue",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["revenue"],
    routes: ["/admin/revenue"],
  },
  {
    id: "bookings",
    name: "Meeting Bookings & Scheduling",
    description: "Calendar integration, booking records, and meeting management.",
    category: "delivery",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["bookings"],
    routes: ["/admin/bookings"],
    setupChecks: ["calendly_configured", "google_calendar_configured"],
  },
  {
    id: "clients",
    name: "Client Delivery & Retainers",
    description: "Active client account management, retainer scope, and delivery status.",
    category: "delivery",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["clients"],
    routes: ["/admin/clients"],
  },
  {
    id: "content",
    name: "Content Operations",
    description: "Editorial brief generator, publishing status, and content marketing assets.",
    category: "delivery",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["content"],
    routes: ["/admin/content"],
  },
  {
    id: "resources",
    name: "Resource Library",
    description: "Gated downloadable guides, templates, and lead-magnet asset management.",
    category: "delivery",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["resources"],
    routes: ["/admin/resources"],
  },
  {
    id: "leads-capture",
    name: "Direct Leads & Chat Intake",
    description: "Raw lead submissions, grader captures, and real-time chat inquiries.",
    category: "sources",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["leads", "chat-leads"],
    routes: ["/admin/leads", "/admin/chat-leads"],
  },
  {
    id: "subscribers",
    name: "Subscriber Audiences",
    description: "Newsletter and resource subscriber lists with attribution and status tracking.",
    category: "sources",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["subscribers"],
    routes: ["/admin/subscribers"],
  },
  {
    id: "partners",
    name: "Partner Management",
    description: "Referral partner tracking, partner applications, and commission ledger.",
    category: "sources",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["partners"],
    routes: ["/admin/partners"],
  },
  {
    id: "website-grades",
    name: "Website Grader",
    description: "Automated website audit intake and lead generation pipeline.",
    category: "sources",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["website-grades"],
    routes: ["/admin/website-grades"],
  },
  {
    id: "analytics",
    name: "Funnel & Traffic Analytics",
    description: "Source-to-revenue funnel analytics and privacy-respecting traffic metrics.",
    category: "intelligence",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["analytics"],
    routes: ["/admin/analytics"],
  },
  {
    id: "integrations",
    name: "Integrations Hub",
    description: "Third-party connector catalog, OAuth credentials, and sync health monitoring.",
    category: "system",
    isCore: false,
    defaultEnabled: true,
    navLinkIds: ["integrations"],
    routes: ["/admin/integrations"],
  },
] as const;

/** Map of module ID to module definition for O(1) lookup. */
export const MODULE_MAP = new Map<string, RevenueOSModule>(
  REVENUE_OS_MODULES.map((mod) => [mod.id, mod]),
);

/** Mapping of nav link ID to its owning module ID. */
export const NAV_LINK_TO_MODULE_MAP = new Map<string, RevenueOSModule>();
for (const mod of REVENUE_OS_MODULES) {
  for (const linkId of mod.navLinkIds) {
    NAV_LINK_TO_MODULE_MAP.set(linkId, mod);
  }
}

/** Mapping of AI tool name to its owning module ID. */
export const AI_TOOL_TO_MODULE_MAP = new Map<string, RevenueOSModule>();
for (const mod of REVENUE_OS_MODULES) {
  if (mod.aiToolNames) {
    for (const toolName of mod.aiToolNames) {
      AI_TOOL_TO_MODULE_MAP.set(toolName, mod);
    }
  }
}

/**
 * Checks whether a module is enabled for a given tenant configuration.
 *
 * Invariants:
 * 1. Core modules are ALWAYS enabled and cannot be disabled.
 * 2. If the tenant config does not explicitly specify a module override, the
 *    module's defaultEnabled value is used (typically true).
 * 3. An explicit boolean in tenantConfig.modules[moduleId] governs optional modules.
 */
export function isModuleEnabled(
  moduleId: string,
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null,
): boolean {
  const moduleDef = MODULE_MAP.get(moduleId);
  if (!moduleDef) return false;
  if (moduleDef.isCore) return true;

  const override = tenantConfig?.modules?.[moduleId];
  if (typeof override === "boolean") {
    return override;
  }
  return moduleDef.defaultEnabled;
}

/**
 * Returns all active modules for a given workspace configuration.
 */
export function getActiveModules(
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null,
): RevenueOSModule[] {
  return REVENUE_OS_MODULES.filter((module) => isModuleEnabled(module.id, tenantConfig));
}

/**
 * Determines whether a specific navigation link should be shown based on module enablement.
 */
export function isNavLinkEnabled(
  navLinkId: string,
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null,
): boolean {
  const moduleDef = NAV_LINK_TO_MODULE_MAP.get(navLinkId);
  if (!moduleDef) return true; // Link without explicit module association remains available
  return isModuleEnabled(moduleDef.id, tenantConfig);
}

/**
 * Determines whether a specific AI tool is permitted based on module enablement.
 */
export function isAiToolModuleEnabled(
  toolName: string,
  tenantConfig?: { modules?: Partial<Record<string, boolean>> } | null,
): { enabled: boolean; module?: RevenueOSModule; reason?: string } {
  const moduleDef = AI_TOOL_TO_MODULE_MAP.get(toolName);
  if (!moduleDef) return { enabled: true };
  const enabled = isModuleEnabled(moduleDef.id, tenantConfig);
  if (!enabled) {
    return {
      enabled: false,
      module: moduleDef,
      reason: `The '${moduleDef.name}' module (${moduleDef.id}) is disabled in this workspace configuration.`,
    };
  }
  return { enabled: true, module: moduleDef };
}

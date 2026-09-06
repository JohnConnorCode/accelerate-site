/**
 * The one place a business fact is allowed to appear.
 *
 * Accelerate's source-controlled configuration is the bootstrap/default tenant
 * and the public marketing-site identity. Live tenant workspaces load a validated
 * version of this shape from the shared database. See
 * `shared-database-multi-tenancy-contract` and docs/contracts/MULTI-TENANCY-CONTRACT.md.
 *
 * Rules for this file:
 * - No secrets. API keys, tokens, and database credentials stay in the
 *   environment. Everything here is safe to read from client components.
 * - No per-row or per-request data. Request-scoped tenant configuration is loaded
 *   by the server tenant-context module and passed explicitly to consumers.
 * - Anything read here must have a sensible value for a business that is not
 *   Accelerate. If a value only makes sense for Accelerate, it belongs in
 *   `src/content/`, which is Accelerate's own marketing site and stays
 *   single-brand.
 *
 * `scripts/verify-agent-contract.mjs` fails the build when a new business
 * literal appears under `src/lib`, `src/app/admin`, or `src/app/api/admin`.
 * Shrink the allowlist there as call sites move here.
 */

import type { WorkspaceBrand } from "@/lib/revenue-os/branding-contract";

/** Legacy bootstrap fields stay required; live workspace presentation fields
 * come from the same validated brand contract used by documents and plugins. */
export interface TenantBrand extends Partial<WorkspaceBrand> {
  /** Display name used in the admin chrome and outbound email. */
  name: string;
  /** Bare domain, no scheme. Used for display and analytics defaults. */
  domain: string;
  /** Canonical absolute site URL, no trailing slash. */
  siteUrl: string;
  /** Short uppercase mark for the collapsed sidebar. */
  logoMark: string;
  /** Accent used in outbound email chrome. Admin UI colors live in globals.css. */
  accentColor: string;
  /** Small-caps line under the wordmark in customer-facing email. */
  tagline: string;
  /** Footer line in customer-facing email. */
  emailFooter: string;
}

export interface TenantFounder {
  /** Short name used in operator-facing copy and signatures. */
  name: string;
  /** Full name, used where the business introduces itself to a customer. */
  fullName: string;
  /** Contact address shown to customers and used as a reply-to. */
  email: string;
  /**
   * Actor recorded on audit and activity rows written by automation rather than
   * a person. Deliberately distinct from the founder address so the ledger can
   * tell a human action from a system one.
   */
  systemActorEmail: string;
}

export interface TenantPlaybook {
  /** Stable key. Written to canonical source tags, so changing it breaks idempotency. */
  key: string;
  label: string;
  industry: string;
  /** Value written to `contacts.source` and `activities.source`. */
  sourceTag: string;
  /** Public route that runs this qualifier. */
  path: string;
  nextAction: string;
}

export interface TenantCapabilities {
  /**
   * Public self-serve scheduler. False keeps founder-reply booking even when a
   * scheduler URL is present. Booking health truth stays on the booking-mode card.
   */
  publicBooking: boolean;
}

export interface TenantConfig {
  brand: TenantBrand;
  founder: TenantFounder;
  capabilities: TenantCapabilities;
  ai: {
    /** How the copilot refers to the business it works for. */
    businessDescriptor: string;
    /** One sentence of voice guidance appended to generative prompts. */
    voice: string;
    /**
     * How the business describes itself to a customer, in its own words. This is
     * the substance a client installation must rewrite; the surrounding prompt
     * rules about tone, grounding, and refusals are product behaviour and stay.
     */
    positioning: string;
  };
  booking: {
    /** Absolute booking URL handed out in chat and email copy. */
    url: string;
    /** On-site path whose page embeds the calendar. */
    path: string;
    /**
     * External scheduler link. Optional: Calendly stays disabled unless a card
     * explicitly activates it.
     */
    schedulerUrl: string | null;
  };
  pipeline: {
    /**
     * Renames pipeline stages for this business without changing the canonical
     * stage keys, which are what the database, transition rules, and analytics
     * are built on. A law firm can call `meeting` a Consultation; nothing else
     * moves. Omit a stage to keep its default label.
     */
    stageLabels: Record<string, string>;
  };
  playbooks: TenantPlaybook[];
  /**
   * Optional module / plugin enablement toggles.
   * If omitted or undefined, modules default to their defined defaultEnabled status.
   */
  modules?: Partial<Record<string, boolean>>;
  /** Deep links to the infrastructure this deployment actually runs on. */
  external: {
    vercelProjectUrl: string | null;
    supabaseProjectRef: string | null;
  };
}

/**
 * Accelerate's bootstrap/default tenant and public marketing identity. Tenant
 * workspaces validate stored configuration against this same interface.
 */
export const tenant: TenantConfig = {
  brand: {
    name: "Accelerate",
    domain: "acceleratewith.us",
    siteUrl: "https://www.acceleratewith.us",
    logoMark: "A",
    accentColor: "#78a91e",
    tagline: "AI strategy, custom solutions, and execution",
    emailFooter: "Accelerate · Practical AI and automation for your business",
  },
  founder: {
    name: "John",
    fullName: "John Connor",
    email: "john@acceleratewith.us",
    systemActorEmail: "system@acceleratewith.us",
  },
  capabilities: {
    publicBooking: true,
  },
  ai: {
    businessDescriptor:
      "Accelerate, an AI strategy, solutions, and execution partner for small business",
    voice: "Be concise and operational. Never call the business an agency.",
    positioning:
      "Accelerate learns how a small business works, identifies where AI and automation can free time or increase revenue, then advises, builds, integrates, runs, trains, and improves the right custom solution. We do not call ourselves an agency, and we do not force every business into the same product.",
  },
  booking: {
    // This previously pointed at calendly.com/john-superdebate, a different
    // business, while being embedded on /contact under "Choose a time directly
    // on John's calendar" and handed out by the public chat. Every Book a call
    // CTA on the site led there, so it was nulled until a correct event was
    // supplied. Verified 2026-08-20 as "30 Minute Meeting - John Connor" on
    // the acceleratewith handle before being turned back on. Setting this to
    // null again disables every booking surface at once rather than leaving a
    // dead embed behind.
    schedulerUrl: "https://calendly.com/john-acceleratewith/30min",
    url: "https://acceleratewith.us/contact",
    path: "/contact",
  },
  pipeline: {
    // Accelerate uses the default stage names.
    stageLabels: {},
  },
  playbooks: [
    {
      key: "roofing",
      label: "Roofing",
      industry: "roofing",
      // Written to canonical rows already in production. Do not rename without a
      // migration: dedupe keys and idempotency depend on it.
      sourceTag: "roofing_qualifier",
      path: "/roofing",
      nextAction: "Respond to qualified roofing audit request",
    },
  ],
  external: {
    vercelProjectUrl: null,
    supabaseProjectRef: null,
  },
};

/** Environment wins over configuration, so one deployment can be retargeted without a code change. */
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || tenant.brand.siteUrl;
export const adminEmail = () => process.env.ADMIN_EMAIL || tenant.founder.email;
export const fromEmail = () =>
  process.env.RESEND_FROM_EMAIL || `${tenant.brand.name} <${tenant.founder.email}>`;
export const analyticsDomain = () =>
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || tenant.brand.domain;

/**
 * Deep link into this installation's Supabase dashboard. Falls back to the
 * project list rather than pointing a client at somebody else's project, which
 * is what a hard-coded ref used to do.
 */
export function supabaseDashboard(path = ""): string {
  const ref = tenant.external.supabaseProjectRef;
  return ref
    ? `https://supabase.com/dashboard/project/${ref}${path}`
    : "https://supabase.com/dashboard/projects";
}

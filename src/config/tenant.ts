/**
 * The one place a business fact is allowed to appear.
 *
 * The Command Center is cloned per client: each installation is its own Vercel
 * project and its own Supabase database running this same codebase. That makes a
 * new client a config file plus environment variables, not a search and replace,
 * and it is why there is no tenant column anywhere in the schema. See the
 * `cloneable-command-center-contract` card for the recorded decision.
 *
 * Rules for this file:
 * - No secrets. API keys, tokens, and database credentials stay in the
 *   environment. Everything here is safe to read from client components.
 * - No per-row or per-request data. This is per-deployment configuration.
 * - Anything read here must have a sensible value for a business that is not
 *   Accelerate. If a value only makes sense for Accelerate, it belongs in
 *   `src/content/`, which is Accelerate's own marketing site and stays
 *   single-brand.
 *
 * `scripts/verify-agent-contract.mjs` fails the build when a new business
 * literal appears under `src/lib`, `src/app/admin`, or `src/app/api/admin`.
 * Shrink the allowlist there as call sites move here.
 */

export interface TenantBrand {
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

export interface TenantConfig {
  brand: TenantBrand;
  founder: TenantFounder;
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
  /** Deep links to the infrastructure this deployment actually runs on. */
  external: {
    vercelProjectUrl: string | null;
    supabaseProjectRef: string | null;
  };
}

/**
 * Accelerate's own installation. A client install replaces this object; nothing
 * else in `src/lib`, `src/app/admin`, or `src/app/api/admin` should need editing.
 */
export const tenant: TenantConfig = {
  brand: {
    name: "Accelerate",
    domain: "acceleratewith.us",
    siteUrl: "https://www.acceleratewith.us",
    logoMark: "A",
    accentColor: "#78a91e",
    tagline: "AI revenue systems, built and run for you",
    emailFooter: "Accelerate · AI revenue systems for small business",
  },
  founder: {
    name: "John",
    fullName: "John Connor",
    email: "john@acceleratewith.us",
    systemActorEmail: "system@acceleratewith.us",
  },
  ai: {
    businessDescriptor: "Accelerate, an embedded AI operations team for small business",
    voice: "Be concise and operational. Never call the business an agency.",
    positioning:
      "Accelerate is an embedded AI operations team for small businesses. We do not call ourselves an agency. We are not software. We build custom AI systems for our clients AND run them alongside the team.",
  },
  booking: {
    // FIXME: this Calendly event belongs to a different business (john-superdebate)
    // and was reachable from the public chat prompt. Left as-is so behaviour does
    // not change silently; replace with the correct event or set to null to stop
    // handing it out. Tracked on the tenant-config-seam card.
    schedulerUrl: "https://calendly.com/john-superdebate/30min",
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
    vercelProjectUrl: "https://vercel.com/robert-farrells-projects/accelerate-site/settings/environment-variables",
    supabaseProjectRef: "skjypuwkceoiunyhhqlm",
  },
};

/** Environment wins over configuration, so one deployment can be retargeted without a code change. */
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || tenant.brand.siteUrl;
export const adminEmail = () => process.env.ADMIN_EMAIL || tenant.founder.email;
export const fromEmail = () => process.env.RESEND_FROM_EMAIL || `${tenant.brand.name} <${tenant.founder.email}>`;
export const analyticsDomain = () => process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || tenant.brand.domain;

/**
 * Deep link into this installation's Supabase dashboard. Falls back to the
 * project list rather than pointing a client at somebody else's project, which
 * is what a hard-coded ref used to do.
 */
export function supabaseDashboard(path = ""): string {
  const ref = tenant.external.supabaseProjectRef;
  return ref ? `https://supabase.com/dashboard/project/${ref}${path}` : "https://supabase.com/dashboard/projects";
}

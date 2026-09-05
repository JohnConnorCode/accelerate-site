/**
 * Bootstrap tenant identity, parameterized for self-hosters.
 *
 * migrations/20260830-shared-database-tenancy.sql seeds the platform's first
 * (bootstrap) tenant. A fresh self-hosted install should not inherit
 * Accelerate's own domain, founder email, or scheduler link. Each field below
 * has a BOOTSTRAP_* environment variable override; unset, it falls back to
 * the reference deployment's own values so the hosted Accelerate instance and
 * any existing fork that has not opted in keep behaving exactly as before.
 *
 * This intentionally does not touch the bootstrap tenant's slug, id, or the
 * accelerate_default_tenant_id() function name. Renaming those is tracked as
 * a separate open-source namespace card; see scripts/feature-backlog-data.mjs.
 */

export const BOOTSTRAP_IDENTITY_TOKENS = [
  { token: "__BOOTSTRAP_BRAND_NAME__", env: "BOOTSTRAP_BRAND_NAME", default: "Accelerate" },
  {
    token: "__BOOTSTRAP_BRAND_DOMAIN__",
    env: "BOOTSTRAP_BRAND_DOMAIN",
    default: "acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_BRAND_SITE_URL__",
    env: "BOOTSTRAP_BRAND_SITE_URL",
    default: "https://www.acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_BRAND_ACCENT_COLOR__",
    env: "BOOTSTRAP_BRAND_ACCENT_COLOR",
    default: "#78a91e",
  },
  {
    token: "__BOOTSTRAP_BRAND_TAGLINE__",
    env: "BOOTSTRAP_BRAND_TAGLINE",
    default: "AI strategy, custom solutions, and execution",
  },
  {
    token: "__BOOTSTRAP_BRAND_EMAIL_FOOTER__",
    env: "BOOTSTRAP_BRAND_EMAIL_FOOTER",
    default: "Accelerate · Practical AI and automation for your business",
  },
  { token: "__BOOTSTRAP_FOUNDER_NAME__", env: "BOOTSTRAP_FOUNDER_NAME", default: "John" },
  {
    token: "__BOOTSTRAP_FOUNDER_FULL_NAME__",
    env: "BOOTSTRAP_FOUNDER_FULL_NAME",
    default: "John Connor",
  },
  {
    token: "__BOOTSTRAP_FOUNDER_EMAIL__",
    env: "BOOTSTRAP_FOUNDER_EMAIL",
    default: "john@acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_SYSTEM_ACTOR_EMAIL__",
    env: "BOOTSTRAP_SYSTEM_ACTOR_EMAIL",
    default: "system@acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_AI_DESCRIPTOR__",
    env: "BOOTSTRAP_AI_DESCRIPTOR",
    default: "Accelerate, an AI strategy, solutions, and execution partner for small business",
  },
  {
    token: "__BOOTSTRAP_AI_VOICE__",
    env: "BOOTSTRAP_AI_VOICE",
    default: "Be concise and operational. Never call the business an agency.",
  },
  {
    token: "__BOOTSTRAP_AI_POSITIONING__",
    env: "BOOTSTRAP_AI_POSITIONING",
    default:
      "Accelerate learns how a small business works, identifies where AI and automation can free time or increase revenue, then advises, builds, integrates, runs, trains, and improves the right custom solution.",
  },
  {
    token: "__BOOTSTRAP_BOOKING_URL__",
    env: "BOOTSTRAP_BOOKING_URL",
    default: "https://acceleratewith.us/contact",
  },
  { token: "__BOOTSTRAP_BOOKING_PATH__", env: "BOOTSTRAP_BOOKING_PATH", default: "/contact" },
  {
    token: "__BOOTSTRAP_SETTINGS_FROM_EMAIL__",
    env: "BOOTSTRAP_SETTINGS_FROM_EMAIL",
    default: "hello@acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_SETTINGS_ADMIN_EMAIL__",
    env: "BOOTSTRAP_SETTINGS_ADMIN_EMAIL",
    default: "hello@acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_BRAND_SITE_URL_BARE__",
    env: "BOOTSTRAP_BRAND_SITE_URL_BARE",
    default: "https://acceleratewith.us",
  },
  {
    token: "__BOOTSTRAP_SCHEDULER_URL__",
    env: "BOOTSTRAP_SCHEDULER_URL",
    default: "https://calendly.com/john-acceleratewith/30min",
  },
];

function escapeSqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

export function resolveBootstrapIdentity() {
  const resolved = {};
  for (const { token, env, default: fallback } of BOOTSTRAP_IDENTITY_TOKENS) {
    resolved[token] =
      env === "BOOTSTRAP_SCHEDULER_URL"
        ? (process.env[env]?.trim() ?? "")
        : process.env[env]?.trim() || fallback;
  }
  return resolved;
}

export function applyBootstrapIdentitySubstitution(sql) {
  const resolved = resolveBootstrapIdentity();
  let result = sql;
  for (const [token, value] of Object.entries(resolved)) {
    if (!result.includes(token)) continue;
    result = result.split(token).join(escapeSqlLiteral(value));
  }
  return result;
}

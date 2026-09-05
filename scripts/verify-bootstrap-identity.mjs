#!/usr/bin/env node
/**
 * Warns a self-hoster who ran migrations without setting any BOOTSTRAP_*
 * override that their database's bootstrap tenant still carries Accelerate's
 * own identity (see scripts/lib/bootstrap-identity.mjs and .env.example).
 *
 * Requires a configured Supabase connection (.env.local). Not run in CI: CI
 * has no live database, and this is a self-hoster readiness check, not a
 * repository hygiene check like npm run verify:oss.
 */
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. See .env.example.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("tenants")
  .select("slug, config")
  .order("created_at", { ascending: true })
  .limit(1)
  .single();

if (error) {
  console.error(`Could not read the bootstrap tenant: ${error.message}`);
  process.exit(1);
}

const founderEmail = data?.config?.founder?.email;
const domain = data?.config?.brand?.domain;

// Independent of the current process environment: this checks what actually
// landed in the database, not what today's env vars would resolve to.
const stillDefault = founderEmail === "john@acceleratewith.us";

if (stillDefault) {
  console.warn(
    JSON.stringify(
      {
        result: "warning",
        message:
          "This installation's bootstrap tenant still carries Accelerate's own identity " +
          `(founder ${founderEmail}, domain ${domain}). If this is a fork, set the ` +
          "BOOTSTRAP_* variables before first installation. For an existing workspace, " +
          "use Branding and the reviewed tenant configuration service; migrations do not overwrite saved configuration.",
        tenantSlug: data.slug,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(
  JSON.stringify({ result: "passed", tenantSlug: data.slug, founderEmail, domain }, null, 2),
);

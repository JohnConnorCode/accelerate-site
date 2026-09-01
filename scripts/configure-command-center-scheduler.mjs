#!/usr/bin/env node

import { runPsql } from "./lib/accelerate-database.mjs";

function fail(message) {
  console.error(`Scheduler configuration failed: ${message}`);
  process.exit(1);
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET?.trim();
if (!siteUrl || !/^https:\/\//.test(siteUrl))
  fail("NEXT_PUBLIC_SITE_URL must be the production HTTPS origin");
if (!cronSecret || cronSecret.length < 32) fail("CRON_SECRET must contain at least 32 characters");

async function resolveCanonicalDispatcherUrl(initialUrl) {
  let current = initialUrl;
  for (let redirects = 0; redirects < 5; redirects += 1) {
    let response;
    try {
      response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      fail(
        `could not verify the dispatcher origin: ${error instanceof Error ? error.message : "request failed"}`,
      );
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return current;
    const location = response.headers.get("location");
    if (!location) fail("dispatcher origin returned a redirect without a Location header");
    const redirected = new URL(location, current);
    if (
      redirected.protocol !== "https:" ||
      redirected.pathname !== "/api/cron/system-health-snapshot"
    ) {
      fail("dispatcher redirected outside the expected production HTTPS route");
    }
    current = redirected.toString();
  }
  fail("dispatcher origin exceeded the redirect limit");
}

// pg_net does not forward Authorization across an origin redirect. Resolve the
// public canonical host before putting the URL in Vault so the scheduler cannot
// look configured while every wake is rejected after a bare-domain redirect.
const dispatcherUrl = await resolveCanonicalDispatcherUrl(
  `${siteUrl}/api/cron/system-health-snapshot`,
);
const sql = `
BEGIN;
SELECT public.configure_command_center_scheduler(${sqlLiteral(dispatcherUrl)}, ${sqlLiteral(cronSecret)});
SELECT public.command_center_scheduler_status() AS scheduler_status;
COMMIT;
`;

const result = runPsql(["--quiet", "--tuples-only"], { input: sql });
if (result.status !== 0) {
  process.stderr.write(result.stderr ?? "");
  fail("database configuration did not complete");
}
console.log("Command Center scheduler configured in encrypted Supabase Vault.");
console.log((result.stdout ?? "").trim());

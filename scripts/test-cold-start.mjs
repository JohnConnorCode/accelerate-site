import { deploymentConfigArgs } from "./deployment-preflight.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { isSupabasePublicConfigured } from "../src/lib/supabase/configuration.mjs";
import { setupConfiguration } from "./lib/workspace-setup.mjs";
const url = "https://exampleproject.supabase.co";
const key = "sb_publishable_testkey";
const jwt = (role) =>
  `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("public readiness accepts supported public keys and refuses malformed or privileged configuration", () => {
  for (const good of [key, jwt("anon")]) assert.equal(isSupabasePublicConfigured(url, good), true);
  assert.equal(isSupabasePublicConfigured("http://127.0.0.1:54321", key), true);
  for (const bad of [
    undefined,
    "",
    "your-publishable-or-anon-key",
    "sb_secret_private",
    jwt("service_role"),
    "malformed",
    "a.b.c",
  ])
    assert.equal(isSupabasePublicConfigured(url, bad), false);
  for (const bad of [
    undefined,
    "",
    "https://your-project.supabase.co",
    "broken",
    "http://remote.test",
    "https://user:pass@host.test",
    url + "/rest/v1",
    url + "?query=1",
  ])
    assert.equal(isSupabasePublicConfigured(bad, key), false);
});
test("copied example stays unconfigured and optional providers are inactive", () => {
  const env = parseEnv(readFileSync(".env.example", "utf8"));
  assert.equal(
    isSupabasePublicConfigured(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    false,
  );
  assert.equal(setupConfiguration(env).ready, false);
  for (const name of [
    "RESEND_API_KEY",
    "OPENROUTER_API_KEY",
    "CRON_SECRET",
    "PLAUSIBLE_API_KEY",
    "GOOGLE_CLIENT_ID",
  ])
    assert.equal(env[name], undefined);
});
test("fork Git deployment proceeds while original project remains on manual releases", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.notEqual(config.git?.deploymentEnabled, false);
  assert.deepEqual(config.crons, []);
  const original = JSON.parse(readFileSync("distribution/original-hosting.json", "utf8"));
  for (const [project, status] of [
    ["", 0],
    ["prj_fork", 1],
    [original.projectId, 0],
  ]) {
    assert.equal(
      spawnSync(process.execPath, ["scripts/vercel-ignore.mjs"], {
        env: { ...process.env, VERCEL_PROJECT_ID: project },
      }).status,
      status,
    );
  }
  const production = JSON.parse(readFileSync("vercel.production.json", "utf8"));
  assert.equal(production.git.deploymentEnabled, false);
  assert.deepEqual(
    production.crons.map((job) => [job.path, job.schedule]),
    [
      ["/api/cron/revenue-campaigns", "0 0 * * *"],
      ["/api/cron/google-workspace-sync", "0 1 * * *"],
      ["/api/cron/work-engine", "*/15 * * * *"],
      ["/api/cron/system-health-snapshot", "*/30 * * * *"],
    ],
  );
});

test("guarded release selects original schedules only for its exact verified identity", () => {
  const original = JSON.parse(readFileSync("distribution/original-hosting.json", "utf8"));
  assert.deepEqual(deploymentConfigArgs(original), ["--local-config", "vercel.production.json"]);
  assert.deepEqual(deploymentConfigArgs({ ...original, projectId: "prj_fork" }), []);
  assert.deepEqual(deploymentConfigArgs({ ...original, teamId: "team_other" }), []);
  for (const arg of ["-A", "-Aother.json", "--local-config", "--local-config=other.json"])
    assert.throws(() => deploymentConfigArgs(original, [arg]), /verified deployment target/);
});

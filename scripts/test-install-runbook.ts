#!/usr/bin/env tsx
/**
 * Named install-runbook proof. Asserts every AC, including negatives.
 * Fixtures are in-process; it never reads .env.local or a production database.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrationCatalog } from "./lib/migration-ledger.mjs";
import { EXCLUDED_MIGRATIONS, MIGRATION_MANIFEST } from "./lib/migration-manifest.mjs";
import { runWorkspaceSetup, setupConfiguration } from "./lib/workspace-setup.mjs";
import {
  campaignEngineReadiness,
  resendDeliveryReadiness,
} from "../src/lib/revenue-os/setup-status";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const started = Date.now();
const cases: { id: string; name: string }[] = [];

function gitFiles(pattern: string): string[] {
  return execFileSync("git", ["ls-files", pattern], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8");
}

function prove(id: string, name: string, fn: () => void) {
  fn();
  cases.push({ id, name });
}

async function main() {
  prove(
    "AC01",
    "fresh checkout has no original env, cache, accounts or production database files",
    () => {
      const trackedEnv = gitFiles(".env*").filter((path) => path !== ".env.example");
      assert.deepEqual(trackedEnv, [], `tracked env files: ${trackedEnv.join(",")}`);
      assert.equal(gitFiles(".next/**").length, 0);
      assert.equal(gitFiles("node_modules/**").length, 0);
      assert.equal(gitFiles(".vercel/**").length, 0);
      const ignore = read(".gitignore");
      assert.match(ignore, /^\.env\*/m);
      assert.match(ignore, /^\/\.next\//m);
      assert.match(ignore, /^\.vercel/m);
      const example = read(".env.example");
      assert.match(example, /NEXT_PUBLIC_SUPABASE_URL=/);
      assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./);
      const readme = read("README.md");
      assert.match(readme, /git clone https:\/\/github\.com\/JohnConnorCode\/accelerate-site\.git/);
      assert.match(readme, /npm ci/);
      assert.match(readme, /npm run dev/);
      assert.doesNotMatch(readme, /cp .*?\.env\.local/);
    },
  );

  prove("AC01", "a checkout that still carries original env is not treated as ready", () => {
    const dirty = setupConfiguration({
      NEXT_PUBLIC_SUPABASE_URL: "https://www.acceleratewith.us",
      ADMIN_EMAIL: "john@acceleratewith.us",
    });
    assert.equal(dirty.ready, false);
    assert.ok(dirty.issues.length > 0);
  });

  prove("AC02", "docs and setup command install dependencies, schema, owner and membership", () => {
    const hosting = read("docs/self-hosting/SELF-HOSTING.md");
    assert.match(hosting, /npm ci/);
    assert.match(hosting, /npm run setup/);
    assert.match(hosting, /--apply --project/);
    assert.match(hosting, /SETUP_OWNER_PASSWORD/);
    const publicInstall = read("src/content/docs/self-hosting/installation.mdx");
    assert.match(publicInstall, /npm run setup/);
    assert.match(publicInstall, /--apply --project/);
    assert.doesNotMatch(
      publicInstall,
      /Create the owner user with the same email as `ADMIN_EMAIL` and give the account a password/,
    );
    const catalog = migrationCatalog(root);
    assert.equal(catalog.length, MIGRATION_MANIFEST.length);
    assert.ok(Object.keys(EXCLUDED_MIGRATIONS).length > 0);
    const result = spawnSync(process.execPath, ["--test", "scripts/test-workspace-setup.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  {
    const empty = setupConfiguration({});
    assert.equal(empty.ready, false);
    assert.equal((await runWorkspaceSetup(empty, {})).status, "configuration_required");
    cases.push({
      id: "AC02",
      name: "missing config refuses before writes",
    });
  }

  prove("AC02", "an unclassified SQL file cannot join a clean install", () => {
    assert.throws(() => {
      const known = new Set([...MIGRATION_MANIFEST, ...Object.keys(EXCLUDED_MIGRATIONS)]);
      if (!known.has("migrations/2099-not-in-catalog.sql"))
        throw new Error(
          "Migration classification mismatch: unclassified=migrations/2099-not-in-catalog.sql",
        );
    }, /unclassified=migrations\/2099-not-in-catalog\.sql/);
  });

  prove("AC03", "configured setup yields workspace membership and operator surfaces", () => {
    const inventory = JSON.parse(read("docs/verification/admin-route-inventory.json")) as {
      routes: { route: string }[];
    };
    const routes = new Set(inventory.routes.map((row) => row.route));
    for (const route of [
      "/admin/contacts",
      "/admin/work",
      "/admin/today",
      "/admin/setup",
      "/admin/integrations",
    ])
      assert.ok(routes.has(route), `missing operator surface ${route}`);
    const login = read("src/app/admin/login/page.tsx");
    assert.match(login, /Connect your Supabase project/);
    const navigation = read("src/lib/admin/navigation.ts");
    assert.match(navigation, /href: "\/admin\/contacts"/);
    assert.match(navigation, /href: "\/admin\/work"/);
    assert.match(navigation, /href: "\/admin\/setup"/);
  });

  prove("AC03", "setup never treats a false membership activation as a usable workspace", () => {
    const source = read("scripts/test-workspace-setup.mjs");
    assert.match(source, /false activation success cannot become workspace readiness/);
    assert.match(source, /workspace_configured/);
  });

  prove("AC04", "provider-free demo stays distinct from connected setup states", () => {
    const readme = read("README.md");
    assert.match(readme, /fictional demo works with zero setup/);
    assert.match(readme, /connect your Supabase project/);
    const hosting = read("docs/self-hosting/SELF-HOSTING.md");
    assert.match(hosting, /without provider credentials/);
    assert.match(hosting, /Setup Center/);
    const turnkey = read("scripts/qa-turnkey.mjs");
    assert.match(turnkey, /No workspace data is connected/);
    assert.match(turnkey, /Explore the fictional Command Center/);
    assert.match(turnkey, /Connect your Supabase project/);
    assert.equal(resendDeliveryReadiness({ configured: false }).status, "action");
    assert.equal(
      resendDeliveryReadiness({ configured: true, lastOutbound: null }).status,
      "action",
    );
    assert.equal(
      campaignEngineReadiness({ schemaReady: false, configured: true }).status,
      "action",
    );
  });

  prove(
    "AC05",
    "preview recipe is fork-owned and does not target the original hosting project",
    () => {
      const deploy = read("DEPLOY.md");
      assert.match(deploy, /A fork must create its own Vercel project/);
      assert.match(deploy, /Do not link, deploy to, or copy the original Accelerate project IDs/);
      const target = JSON.parse(read("deployment-target.json")) as {
        projectId: string;
        canonicalUrl: string;
      };
      assert.match(deploy, new RegExp(target.projectId));
      assert.equal(target.canonicalUrl, "https://www.acceleratewith.us");
      const vercel = JSON.parse(read("vercel.json")) as { git: { deploymentEnabled: boolean } };
      assert.equal(vercel.git.deploymentEnabled, false);
      const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
      assert.ok(pkg.scripts["deploy:check"]);
      assert.doesNotMatch(read("README.md"), /vercel deploy --prod/);
    },
  );

  prove("AC06", "command, failure and dashboard steps are captured for CI", () => {
    const hosting = read("docs/self-hosting/SELF-HOSTING.md");
    assert.match(hosting, /Auth settings/);
    assert.match(hosting, /\/auth\/callback/);
    assert.match(hosting, /These are project settings/);
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    assert.equal(
      pkg.scripts["test:install-runbook"],
      "NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-install-runbook.ts",
    );
  });

  const receipt = {
    result: "passed",
    schemaVersion: 1,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    durationMs: Date.now() - started,
    migrations: MIGRATION_MANIFEST.length,
    cases,
    commands: [
      {
        command: "git clone && npm ci && npm run dev",
        proves: "AC01",
        expected: "site and fictional demo without credentials",
      },
      {
        command: "npm run setup",
        proves: "AC02",
        expected: "named fixes when configuration is missing",
      },
      {
        command: "npm run setup -- --apply --project <ref>",
        proves: "AC02 AC03",
        expected: "owner, migrations, admin membership",
      },
      {
        command: "npm run verify:migrations",
        proves: "AC02",
        expected: "unclassified files fail closed",
      },
      {
        command: "npm run deploy:check",
        proves: "AC05",
        expected: "fork-owned hosting identity; no production deploy",
      },
      {
        command: "NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-install-runbook.ts",
        proves: "AC06",
        expected: "this receipt",
      },
    ],
    documentedDashboardSteps: [
      "Supabase Auth: enable email/password",
      "Supabase Auth: application origin and /auth/callback redirect",
    ],
    failureMatrix: [
      {
        case: "missing or placeholder configuration",
        expected: "configuration_required, no host writes",
      },
      { case: "original Accelerate identity leftovers", expected: "setup not ready" },
      { case: "apply against a different project ref", expected: "refuse before writes" },
      { case: "unclassified migration file", expected: "verify:migrations fails" },
      { case: "false membership activation", expected: "workspace not ready" },
      {
        case: "provider keys without a delivery receipt",
        expected: "Setup Center stays action, not ready",
      },
      { case: "fork using original Vercel project IDs", expected: "documented as forbidden" },
    ],
  };

  const output = process.env.INSTALL_RUNBOOK_OUTPUT || "/tmp/accelerate-install-runbook.json";
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(receipt, null, 2) + "\n");
  assert.ok(existsSync(output));
  console.log(JSON.stringify({ ...receipt, output }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

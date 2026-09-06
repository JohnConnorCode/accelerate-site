#!/usr/bin/env node
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setupConfiguration, runWorkspaceSetup, SetupError } from "./lib/workspace-setup.mjs";
const args = process.argv.slice(2);
const help = `Workspace setup (no Docker required)
  npm run setup                         Read-only configuration and installation plan
  npm run setup -- --apply --project REF Apply to the exact configured project

Configure your own .env.local from .env.example. Set BOOTSTRAP_BRAND_NAME,
ADMIN_EMAIL and NEXT_PUBLIC_SITE_URL. For a new owner, set SETUP_OWNER_PASSWORD
in your private local environment (12–1024 characters); never pass it as an argument.
Existing accounts retain their password. No invitation email or provider activation
is sent. Auth creation and database migrations are separate resumable steps.
See docs/self-hosting/SELF-HOSTING.md for project and Auth redirect prerequisites.`;
try {
  if (args.length === 1 && args[0] === "--help") {
    console.log(help);
  } else {
    const apply = args.length === 3 && args[0] === "--apply" && args[1] === "--project";
    if (args.length && !apply && !(args.length === 1 && args[0] === "--check"))
      throw new SetupError(help);
    const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
    if (existsSync(envPath)) process.loadEnvFile(envPath);
    const config = setupConfiguration(process.env);
    let result;
    if (!config.ready) result = { status: "configuration_required", issues: config.issues };
    else {
      const database = await import("./lib/accelerate-database.mjs");
      const { migrationCatalog } = await import("./lib/migration-ledger.mjs");
      const { createWorkspaceSetupHost } = await import("./lib/workspace-setup-host.mjs");
      const host = createWorkspaceSetupHost(config, database, migrationCatalog(database.repoRoot));
      result = await runWorkspaceSetup(config, host, {
        apply,
        project: args[2],
        password: process.env.SETUP_OWNER_PASSWORD,
      });
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "configuration_required") process.exitCode = 2;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "stopped",
        message:
          error instanceof SetupError
            ? error.message
            : "Setup could not continue. Check local configuration and service availability; private service errors are not printed.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

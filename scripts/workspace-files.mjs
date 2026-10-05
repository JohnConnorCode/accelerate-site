#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { setupConfiguration } from "./lib/workspace-setup.mjs";
import { backupStorage, restoreStorage, RecoveryError } from "./lib/storage-recovery.mjs";

const help = `Private uploaded-file recovery
  npm run workspace:files -- backup --project REF --directory /private/new-copy
  npm run workspace:files -- restore --project REF --directory /private/copy
  npm run workspace:files -- restore --project REF --directory /private/copy --apply

Use the reviewed source/target environment. Pause uploads during backup and keep
the restore target isolated, with providers and schedules disabled. Restore is a
read-only plan unless --apply is present. Conflicting files and bucket policies
are refused. Encrypt the private copy through your secret manager before moving
it off-host. Database, Auth and encryption-key recovery are separate steps.
See docs/self-hosting/BACKUP-RECOVERY.md.`;
try {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "--help") console.log(help);
  else {
    const apply = mode === "restore" && args.at(-1) === "--apply";
    const flags = apply ? args.slice(0, -1) : args;
    if (!["backup", "restore"].includes(mode) || flags.length !== 4 || flags[0] !== "--project" || flags[2] !== "--directory" || !flags[1] || !flags[3].startsWith("/")) throw new Error(help);
    if (existsSync(".env.local")) process.loadEnvFile(resolve(".env.local"));
    const config = setupConfiguration(process.env);
    if (!config.ready || config.project !== flags[1]) throw new Error("Recovery configuration or exact project selection is invalid. Run npm run setup to inspect the configuration.");
    const client = createClient(config.apiUrl, config.serviceKey, { auth: { persistSession: false }, global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(60_000) }) } });
    const result = mode === "backup" ? await backupStorage(client.storage, config.project, flags[3], { origin: config.apiUrl }) : await restoreStorage(client.storage, config.project, flags[3], { apply, origin: config.apiUrl });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  // Provider responses can contain object names or credentials. Print only our
  // bounded operator messages; keep raw provider diagnostics outside artifacts.
  console.error(error instanceof RecoveryError || error?.message?.startsWith("Private uploaded-file recovery") ? error.message : "File recovery stopped. Check the exact project, private copy, bucket policies and provider availability. Keep effects disabled; rerun the read-only restore plan before applying. No existing files are overwritten.");
  process.exitCode = 1;
}

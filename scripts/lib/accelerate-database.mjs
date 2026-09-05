import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const environmentFile = resolve(fileURLToPath(new URL("../../.env.local", import.meta.url)));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

function projectRefFromUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return "";
  try {
    return new URL(configuredUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

export const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim() || projectRefFromUrl();
export const POOLER_HOST = process.env.SUPABASE_DB_HOST?.trim() || "";
export const POOLER_PORT = process.env.SUPABASE_DB_PORT?.trim() || "5432";
export const DATABASE_USER =
  process.env.SUPABASE_DB_USER?.trim() || (PROJECT_REF ? `postgres.${PROJECT_REF}` : "");
export const KEYCHAIN_SERVICE =
  process.env.SUPABASE_DB_KEYCHAIN_SERVICE?.trim() || "accelerate-supabase-db-password";
export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function readDatabasePassword() {
  const configured =
    process.env.SUPABASE_DB_PASSWORD?.trim() || process.env.ACCELERATE_SUPABASE_DB_PASSWORD?.trim();
  if (configured) return configured;
  if (!DATABASE_USER)
    throw new Error(
      "SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL is required for database tooling.",
    );
  if (process.platform !== "darwin")
    throw new Error("SUPABASE_DB_PASSWORD is required outside macOS.");

  const result = spawnSync(
    "security",
    ["find-generic-password", "-a", DATABASE_USER, "-s", KEYCHAIN_SERVICE, "-w"],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout.trim())
    throw new Error(`database password is not available in Keychain service ${KEYCHAIN_SERVICE}`);
  return result.stdout.trim();
}

export function psqlArgs(extra = []) {
  if (!PROJECT_REF || !POOLER_HOST || !DATABASE_USER)
    throw new Error("Supabase database target is incomplete. See .env.example.");
  const local = ["localhost", "127.0.0.1", "::1"].includes(POOLER_HOST);
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (configuredUrl) {
    const hostname = new URL(configuredUrl).hostname;
    const localApi = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
    if (local !== localApi)
      throw new Error("Database and API targets mix local and hosted environments");
    if (hostname.endsWith(".supabase.co") && hostname.split(".")[0] !== PROJECT_REF)
      throw new Error("Supabase API URL does not match SUPABASE_PROJECT_REF");
  }
  if (POOLER_HOST.endsWith(".pooler.supabase.com") && DATABASE_USER !== `postgres.${PROJECT_REF}`)
    throw new Error("Supabase pooler user does not match the configured project");
  if (
    POOLER_HOST.startsWith("db.") &&
    POOLER_HOST.endsWith(".supabase.co") &&
    POOLER_HOST !== `db.${PROJECT_REF}.supabase.co`
  )
    throw new Error("Supabase database host does not match the configured project");
  return [
    "-X",
    "-h",
    POOLER_HOST,
    "-p",
    POOLER_PORT,
    "-U",
    DATABASE_USER,
    "-d",
    process.env.SUPABASE_DB_NAME?.trim() || "postgres",
    "--set",
    "ON_ERROR_STOP=on",
    ...extra,
  ];
}

export function runPsql(extra = [], { input } = {}) {
  return spawnSync("psql", psqlArgs(extra), {
    cwd: repoRoot,
    env: {
      ...process.env,
      PGSSLMODE:
        process.env.PGSSLMODE ||
        (["localhost", "127.0.0.1", "::1"].includes(POOLER_HOST) ? "disable" : "require"),
      PGPASSWORD: readDatabasePassword(),
    },
    encoding: "utf8",
    input,
  });
}

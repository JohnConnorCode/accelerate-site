import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const PROJECT_REF = "skjypuwkceoiunyhhqlm";
export const POOLER_HOST = "aws-1-us-east-1.pooler.supabase.com";
export const POOLER_PORT = "5432";
export const DATABASE_USER = `postgres.${PROJECT_REF}`;
export const KEYCHAIN_SERVICE = "accelerate-supabase-db-password";
export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function readDatabasePassword() {
  const configured = process.env.ACCELERATE_SUPABASE_DB_PASSWORD?.trim();
  if (configured) return configured;
  if (process.platform !== "darwin") throw new Error("ACCELERATE_SUPABASE_DB_PASSWORD is required outside macOS.");

  const result = spawnSync("security", ["find-generic-password", "-a", DATABASE_USER, "-s", KEYCHAIN_SERVICE, "-w"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`database password is not available in Keychain service ${KEYCHAIN_SERVICE}`);
  return result.stdout.trim();
}

export function psqlArgs(extra = []) {
  return ["-X", "-h", POOLER_HOST, "-p", POOLER_PORT, "-U", DATABASE_USER, "-d", "postgres", "--set", "ON_ERROR_STOP=on", ...extra];
}

export function runPsql(extra = [], { input } = {}) {
  return spawnSync("psql", psqlArgs(extra), {
    cwd: repoRoot,
    env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    encoding: "utf8",
    input,
  });
}

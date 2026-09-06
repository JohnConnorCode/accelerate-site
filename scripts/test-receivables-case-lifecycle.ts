import { spawnSync } from "node:child_process";
for (const script of [
  "scripts/test-collections-host.ts",
  "scripts/test-migration-ledger-postgres.mjs",
]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script], {
    stdio: "inherit",
    env: { ...process.env, COLLECTIONS_POSTGRES_PROOF: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

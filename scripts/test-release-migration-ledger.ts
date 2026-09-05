/** Ticket entrypoint. Uses a disposable native PostgreSQL cluster, with no containers. */
import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["scripts/test-migration-ledger-postgres.mjs"], {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

/** Compatibility entrypoint; no implicit reconciliation or deletion. */
import { spawnSync } from "node:child_process";
const result = spawnSync("npx", ["tsx", "scripts/work-board-import.ts", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);

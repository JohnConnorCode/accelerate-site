#!/usr/bin/env tsx
/** One-time private board transport setup for the natural-language runner. */
import { spawnSync } from "node:child_process";
const result = spawnSync(
  "npx",
  ["tsx", "scripts/agent-go.ts", "--setup", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
  },
);
process.exitCode = result.status ?? 1;

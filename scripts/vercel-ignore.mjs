import { readFileSync } from "node:fs";
// Forks deploy normally. The original project uses the guarded prebuilt release.
const original = JSON.parse(
  readFileSync(new URL("../distribution/original-hosting.json", import.meta.url), "utf8"),
);
process.exit(process.env.VERCEL_PROJECT_ID === original.projectId ? 0 : 1);

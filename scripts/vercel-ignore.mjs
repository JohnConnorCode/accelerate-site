import { readFileSync } from "node:fs";
// Forks deploy normally. The original project uses the guarded prebuilt release.
const original = JSON.parse(
  readFileSync(new URL("../distribution/original-hosting.json", import.meta.url), "utf8"),
);
if (!process.env.VERCEL_PROJECT_ID) {
  console.error(
    "Build skipped: enable Automatically expose System Environment Variables in Vercel so the project identity can be checked.",
  );
  process.exit(0);
}
process.exit(process.env.VERCEL_PROJECT_ID === original.projectId ? 0 : 1);

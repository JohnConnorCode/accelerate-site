import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout?.trim() ?? "";
}

function releaseId() {
  const explicitId = process.env.NEXT_DEPLOYMENT_ID?.trim();
  const source = explicitId || run("git", ["rev-parse", "--short=12", "HEAD"], { capture: true });
  const value = source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
  if (!value) throw new Error("A deployment id is required for a production release.");
  return value;
}

const [mode, ...args] = process.argv.slice(2);
const deploymentId = releaseId();
const env = { ...process.env, NEXT_DEPLOYMENT_ID: deploymentId };

if (mode === "start") {
  console.log(`Starting production release ${deploymentId}`);
  run("next", ["start", ...args], { env });
} else if (mode === "vercel-build") {
  console.log(`Building production release ${deploymentId}`);
  run("vercel", ["build", "--prod", ...args], { env });
} else {
  throw new Error(`Unknown release command: ${mode || "(missing)"}`);
}

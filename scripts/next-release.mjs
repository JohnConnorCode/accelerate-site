import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
  const value = source.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  if (!value) throw new Error("A deployment id is required for a production release.");
  return value;
}

const [mode, ...args] = process.argv.slice(2);
const deploymentId = releaseId();
const env = { ...process.env, NEXT_DEPLOYMENT_ID: deploymentId };

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function verifyPrebuiltIdentity() {
  const requiredServerFiles = readJson(".next/required-server-files.json");
  const serializedConfig = requiredServerFiles.config || {};
  if (serializedConfig.deploymentId !== deploymentId) {
    throw new Error(
      `Prebuilt output does not preserve release id ${deploymentId}. Rebuild before deploying.`,
    );
  }
  if (serializedConfig.experimental?.runtimeServerDeploymentId !== false) {
    throw new Error(
      "Prebuilt output may replace the custom release id at runtime. Refusing deployment.",
    );
  }
  const document = readFileSync(
    ".vercel/output/functions/demo/command-center.prerender-fallback.html",
    "utf8",
  );
  const documentIds = new Set(
    [...document.matchAll(/\?dpl=([a-zA-Z0-9_-]+)/g)].map((match) => match[1]),
  );
  if (documentIds.size !== 1 || !documentIds.has(deploymentId)) {
    throw new Error(
      `Prebuilt document contains competing deployment ids: ${[...documentIds].join(", ") || "none"}.`,
    );
  }
}

if (mode === "build") {
  console.log(`Building production release ${deploymentId}`);
  run("next", ["build", ...args], { env });
} else if (mode === "start") {
  console.log(`Starting production release ${deploymentId}`);
  run("next", ["start", ...args], { env });
} else if (mode === "vercel-build") {
  console.log(`Building production release ${deploymentId}`);
  run("vercel", ["build", "--prod", ...args], { env });
} else if (mode === "verify-prebuilt") {
  verifyPrebuiltIdentity();
  console.log(`Verified prebuilt release ${deploymentId}`);
} else if (mode === "vercel-deploy") {
  console.log(`Deploying production release ${deploymentId}`);
  verifyPrebuiltIdentity();
  run("vercel", ["deploy", "--prebuilt", "--prod", "--archive=tgz", ...args], { env });
} else {
  throw new Error(`Unknown release command: ${mode || "(missing)"}`);
}

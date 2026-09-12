import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { assertForkHosting } from "./lib/neutral-distribution.mjs";

export function verifyDeploymentTarget({ target, linked, env = process.env, request }) {
  if (!target.projectId || !target.teamId || !target.projectName) {
    throw new Error("deployment-target.json must declare projectId, teamId and projectName.");
  }
  if (linked.projectId !== target.projectId || linked.orgId !== target.teamId) {
    throw new Error(
      "Wrong Vercel project/team link. Follow DEPLOY.md; do not pull configuration or build.",
    );
  }
  if (
    (env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_ID !== target.projectId) ||
    (env.VERCEL_ORG_ID && env.VERCEL_ORG_ID !== target.teamId)
  ) {
    throw new Error("Vercel environment overrides conflict with deployment-target.json.");
  }
  // Query the exact intended project under the exact intended team, never the CLI default scope.
  const project = request(
    `/v9/projects/${encodeURIComponent(target.projectId)}?teamId=${encodeURIComponent(target.teamId)}`,
  );
  if (
    project.id !== target.projectId ||
    project.accountId !== target.teamId ||
    project.name !== target.projectName
  ) {
    throw new Error("Vercel returned a different project/team. Stop and correct account access.");
  }
  return target;
}

export function deploymentPreflight() {
  const target = JSON.parse(readFileSync("deployment-target.json", "utf8"));
  if (process.env.NEXT_PUBLIC_DISTRIBUTION_PROFILE === "neutral") assertForkHosting(target);
  let linked;
  try {
    linked = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
  } catch {
    throw new Error(
      `Missing or invalid Vercel link. Expected ${target.projectName} (${target.projectId}) in team ${target.teamId}. Follow DEPLOY.md before pulling configuration.`,
    );
  }
  return verifyDeploymentTarget({
    target,
    linked,
    request(endpoint) {
      const result = spawnSync("vercel", ["api", endpoint], { encoding: "utf8", timeout: 30000 });
      if (result.error || result.status !== 0) {
        // Provider output can contain account details; do not echo raw responses or tokens.
        throw new Error(
          `Current Vercel login could not verify access to ${target.projectId} in ${target.teamId}. Check vercel whoami and vercel teams ls, then sign in to an account with access. This does not establish a hosting suspension. See DEPLOY.md.`,
        );
      }
      try {
        return JSON.parse(result.stdout);
      } catch {
        throw new Error(
          "Vercel returned an unreadable project response; target access is unverified.",
        );
      }
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const target = deploymentPreflight();
    console.log(
      `Verified Vercel project ${target.projectName} (${target.projectId}), team ${target.teamId}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

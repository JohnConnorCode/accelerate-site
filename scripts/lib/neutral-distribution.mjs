import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadInclusionManifest(root = process.cwd()) {
  return JSON.parse(readFileSync(resolve(root, "distribution/inclusion-manifest.json"), "utf8"));
}

export function loadOriginalHosting(root = process.cwd()) {
  return JSON.parse(readFileSync(resolve(root, "distribution/original-hosting.json"), "utf8"));
}

export function gitFiles(root = process.cwd()) {
  return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

export function isExcluded(path, prefixes) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function starterFiles(root = process.cwd()) {
  const manifest = loadInclusionManifest(root);
  return gitFiles(root).filter((path) => !isExcluded(path, manifest.excludePrefixes));
}

export function assertForkHosting(target, original = loadOriginalHosting()) {
  if (
    target.projectId === original.projectId ||
    target.teamId === original.teamId ||
    target.canonicalUrl === original.canonicalUrl
  ) {
    throw new Error(
      "Neutral hosting cannot use the original installation project, team or canonical URL. Copy deployment-target.example.json and fill your own IDs.",
    );
  }
  if (!target.projectId || !target.teamId || !target.projectName || !target.canonicalUrl) {
    throw new Error("Fork hosting requires projectId, teamId, projectName and canonicalUrl.");
  }
  if (
    String(target.projectId).startsWith("prj_replace") ||
    String(target.teamId).startsWith("team_replace")
  ) {
    throw new Error("Replace the example hosting placeholders with a project you control.");
  }
  return target;
}

#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { textExtensions, secretPatterns } from "./lib/source-safety.mjs";

const requiredFiles = [
  ".env.example",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/dependabot.yml",
  ".github/workflows/ci.yml",
  "ASSETS.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "docs/self-hosting/ARCHITECTURE.md",
  "docs/self-hosting/SELF-HOSTING.md",
  "CHANGELOG.md",
  "DEPLOY.md",
];

const git = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (git.status !== 0) throw new Error("Unable to enumerate tracked files.");
const tracked = git.stdout.split("\0").filter(Boolean);
const trackedSet = new Set(tracked);
const failures = [];

for (const file of requiredFiles) {
  if (!trackedSet.has(file) && !process.env.OSS_ALLOW_UNTRACKED_REQUIRED_FILES) {
    failures.push(`required community file is not tracked: ${file}`);
  } else {
    try {
      if (!readFileSync(file, "utf8").trim())
        failures.push(`required community file is empty: ${file}`);
    } catch {
      failures.push(`required community file is missing: ${file}`);
    }
  }
}

for (const file of tracked) {
  if (/^\.env(?:\.|$)/.test(file) && file !== ".env.example")
    failures.push(`environment file must not be tracked: ${file}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.private !== true)
  failures.push("package.json must remain private to prevent accidental npm publication");
if (packageJson.license !== "MIT") failures.push("package.json must declare the MIT license");
if (!packageJson.repository?.url) failures.push("package.json must declare its repository URL");

for (const file of tracked) {
  if (!textExtensions.has(extname(file))) continue;
  let value;
  try {
    value = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(value)) failures.push(`${label} pattern found in ${file}`);
  }
  if (extname(file) === ".md") {
    for (const match of value.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, "");
      if (!target || target.startsWith("#") || target.startsWith("/") || /^[a-z]+:/i.test(target))
        continue;
      const localPath = decodeURIComponent(target.split("#")[0]);
      if (!existsSync(resolve(dirname(file), localPath)))
        failures.push(`broken local Markdown link in ${file}: ${target}`);
    }
  }
  // Non-Markdown source (the feature backlog manifest, mainly) references
  // doc paths as plain strings, not Markdown links. Catch those dangling too:
  // a stale doc filename referenced only in scripts/feature-backlog-data.mjs
  // once shipped for weeks before anything caught it.
  // Qualified sibling-repository paths are provenance, not local doc links.
  if (extname(file) === ".mjs" || extname(file) === ".ts") {
    for (const match of value.matchAll(/(?<![A-Za-z0-9_./:-])docs\/[A-Za-z0-9._-]+\.md\b/g)) {
      const target = match[0];
      if (!existsSync(resolve(target))) failures.push(`broken doc reference in ${file}: ${target}`);
    }
  }
}

if (failures.length) {
  console.error(`Open-source readiness failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      trackedFiles: tracked.length,
      requiredCommunityFiles: requiredFiles.length,
      secretPatterns: secretPatterns.length,
    },
    null,
    2,
  ),
);

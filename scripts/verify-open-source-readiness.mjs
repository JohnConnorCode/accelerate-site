#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

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
  "docs/ARCHITECTURE.md",
  "docs/SELF-HOSTING.md",
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
      if (!readFileSync(file, "utf8").trim()) failures.push(`required community file is empty: ${file}`);
    } catch {
      failures.push(`required community file is missing: ${file}`);
    }
  }
}

for (const file of tracked) {
  if (/^\.env(?:\.|$)/.test(file) && file !== ".env.example") failures.push(`environment file must not be tracked: ${file}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
if (packageJson.private !== true) failures.push("package.json must remain private to prevent accidental npm publication");
if (packageJson.license !== "MIT") failures.push("package.json must declare the MIT license");
if (!packageJson.repository?.url) failures.push("package.json must declare its repository URL");

const textExtensions = new Set(["", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mdx", ".mjs", ".sql", ".svg", ".ts", ".tsx", ".txt", ".yml", ".yaml"]);
const secretPatterns = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Stripe secret key", /sk_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["OpenRouter secret key", /sk-or-v1-[a-f0-9]{32,}/i],
  ["Anthropic secret key", /sk-ant-[A-Za-z0-9_-]{24,}/],
  ["Resend secret key", /re_[A-Za-z0-9]{24,}/],
  ["Google API key", /AIza[A-Za-z0-9_-]{24,}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
];

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
      if (!target || target.startsWith("#") || target.startsWith("/") || /^[a-z]+:/i.test(target)) continue;
      const localPath = decodeURIComponent(target.split("#")[0]);
      if (!existsSync(resolve(dirname(file), localPath))) failures.push(`broken local Markdown link in ${file}: ${target}`);
    }
  }
}

if (failures.length) {
  console.error(`Open-source readiness failed:\n- ${[...new Set(failures)].join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ result: "passed", trackedFiles: tracked.length, requiredCommunityFiles: requiredFiles.length, secretPatterns: secretPatterns.length }, null, 2));

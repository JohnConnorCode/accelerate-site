#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Inspect local Git history only. Never fetch, checkout, reset, merge or deploy. */
export function checkForkUpgrade(root, ref) {
  const git = (...args) =>
    spawnSync("git", ["-c", "core.fsmonitor=false", ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 1048576,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    });
  const manual =
    "Keep this checkout intact. Adopt the full repository in a new directory, configure your own environment and hosting, and import supported website exports as unpublished drafts. Transfer business data through the existing backup/recovery guide. Review custom extensions separately.";
  if (typeof ref !== "string" || !ref || ref.startsWith("-") || /[\s\x00-\x1f]/.test(ref))
    return {
      status: "invalid-reference",
      next: "Supply a fetched upstream commit or tag with --ref.",
    };
  const head = git("rev-parse", "--verify", "HEAD^{commit}");
  if (head.status !== 0) return { status: "manual-adoption", next: manual };
  const upstream = git("rev-parse", "--verify", `${ref}^{commit}`);
  if (upstream.status !== 0)
    return {
      status: "invalid-reference",
      next: "Fetch the intended upstream release explicitly, then rerun with its commit or tag. No fetch was performed.",
    };
  const sourceCommit = head.stdout.trim(),
    upstreamCommit = upstream.stdout.trim();
  const base = git("merge-base", sourceCommit, upstreamCommit);
  if (base.status === 1)
    return { status: "manual-adoption", sourceCommit, upstreamCommit, next: manual };
  if (base.status !== 0)
    return {
      status: "unavailable",
      next: "Git history could not be inspected. Retain this checkout and check local Git access.",
    };
  const identity = { sourceCommit, upstreamCommit, commonAncestor: base.stdout.trim() };
  const dirty = git("status", "--porcelain=v1", "-z", "--untracked-files=all");
  if (dirty.status !== 0)
    return {
      status: "unavailable",
      ...identity,
      next: "Working tree status could not be read. No update was performed.",
    };
  if (dirty.stdout)
    return {
      status: "working-tree-changes",
      ...identity,
      next: "Review and retain modified and untracked files before an update. Save unfinished work in your own branch or a separate backup; do not reset it.",
    };
  const legacy = git(
    "diff",
    "--name-only",
    identity.commonAncestor,
    sourceCommit,
    "--",
    "src/config/tenant.ts",
    "deployment-target.json",
  );
  if (legacy.status !== 0)
    return {
      status: "unavailable",
      ...identity,
      next: "Configuration ownership could not be inspected. No update was performed.",
    };
  const legacyConfiguration = legacy.stdout.trim().split("\n").filter(Boolean);
  const drivers = git("config", "--name-only", "--get-regexp", "^merge\\..*\\.driver$");
  if (drivers.status === 0)
    return {
      status: "owner-review",
      ...identity,
      next: "Custom Git merge drivers are configured. Review them separately before simulating an update; no merge simulation or update was performed.",
    };
  if (drivers.status !== 1)
    return {
      status: "unavailable",
      ...identity,
      next: "Git merge configuration could not be inspected. No update was performed.",
    };
  const merge = git(
    "merge-tree",
    "--write-tree",
    "--name-only",
    "-z",
    sourceCommit,
    upstreamCommit,
  );
  if (merge.status !== 0 && merge.status !== 1)
    return {
      status: "unavailable",
      ...identity,
      next: "Merge inspection requires Git 2.38 or newer and complete local history. No update was performed.",
    };
  const fields = merge.stdout.split("\0");
  const conflicts = [];
  for (let i = 1; i < fields.length && fields[i]; i++) conflicts.push(fields[i]);
  if (merge.status === 1 || legacyConfiguration.length)
    return {
      status: "owner-review",
      ...identity,
      conflicts: conflicts.slice(0, 100),
      conflictCount: conflicts.length,
      legacyConfiguration,
      next: "Review conflicts and legacy configuration in a separate branch. Move hosting IDs to deployment-target.local.json and ordinary identity/theme/page settings to the existing environment and workspace controls. Keep the original branch and backup until verified; never force-reset or replace settings wholesale.",
    };
  return {
    status: "mergeable",
    ...identity,
    next: "Git reports a clean source merge. Back up the installation, review release requirements and migrations, merge in your own branch, regenerate extension outputs, and verify in an isolated target before deployment. Database, uploaded-object, provider and plugin compatibility remain separate checks. No update was performed.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const result =
    args.length === 2 && args[0] === "--ref"
      ? checkForkUpgrade(process.cwd(), args[1])
      : {
          status: "invalid-reference",
          next: "Usage: npm run fork:check -- --ref <fetched-upstream-commit-or-tag>",
        };
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "mergeable") process.exitCode = 1;
}

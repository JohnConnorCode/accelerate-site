#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function git(args, optional = false) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || (result.status !== 0 && !(optional && result.status === 1)))
    throw new Error("Unable to configure this worktree's Git hooks.");
  return result.stdout.trim();
}
if (!existsSync(".githooks/pre-commit") || !existsSync("scripts/verify-commit.mjs"))
  throw new Error("Run hooks:install from a checkout containing the versioned hooks.");
// Worktree configuration keeps this opt-in from changing concurrent checkouts.
// Nonstandard shared core.worktree/bare settings need explicit Git migration.
if (
  git(["config", "--local", "--get", "core.worktree"], true) ||
  git(["config", "--local", "--get", "core.bare"], true) === "true"
)
  throw new Error(
    "Custom core.worktree/bare configuration requires manual worktree-config migration.",
  );
git(["config", "--local", "extensions.worktreeConfig", "true"]);
const existing = git(["config", "--worktree", "--get", "core.hooksPath"], true);
if (existing && existing !== ".githooks")
  throw new Error(
    "This worktree already has a custom hooksPath; preserve or remove that setting explicitly before installing.",
  );
git(["config", "--worktree", "core.hooksPath", ".githooks"]);
console.log(
  "Installed versioned hooks for this worktree. Existing hooks and global templates are preserved.",
);
console.log("Undo: git config --worktree --unset core.hooksPath");

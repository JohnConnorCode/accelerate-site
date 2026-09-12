import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { git, repositoryContext, repositoryIdentity } from "./developer-workspace.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
function uuid(value) {
  if (!UUID.test(value ?? "")) throw new Error("Checkpoint requires valid card and attempt UUIDs.");
  return value;
}
function repository(root, card) {
  const repo = card.work_spec?.repository;
  if (
    !repo ||
    !SHA.test(repo.baseCommit ?? "") ||
    !repo.baseBranch ||
    git(root, ["check-ref-format", `refs/heads/${repo.baseBranch}`], true) === null
  )
    throw new Error("CHECKPOINT_BASE_INVALID: approved repository branch and exact base required.");
  if (
    !repositoryIdentity(repo.url) ||
    repositoryIdentity(repo.url) !==
      repositoryIdentity(git(root, ["remote", "get-url", "origin"], true))
  )
    throw new Error("CHECKPOINT_ORIGIN_MISMATCH: use the approved repository.");
  const ref = `refs/remotes/origin/${repo.baseBranch}`;
  const contains = (target) =>
    git(root, ["merge-base", "--is-ancestor", repo.baseCommit, target], true) !== null;
  if (!contains(ref) && !contains(`refs/heads/${repo.baseBranch}`))
    git(root, ["fetch", "--no-tags", "origin", `refs/heads/${repo.baseBranch}:${ref}`]);
  if (!contains(ref) && !contains(`refs/heads/${repo.baseBranch}`))
    throw new Error("CHECKPOINT_BASE_MISMATCH: approved base is not on its declared branch.");
  return repo;
}
function safePath(root, file) {
  if (
    typeof file !== "string" ||
    !file ||
    isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some((part) => part === ".." || part === ".git") ||
    file.includes("\0")
  )
    throw new Error("CHECKPOINT_PATH_REJECTED: paths must stay inside the source checkout.");
  const parts = file.toLowerCase().split("/");
  if (
    parts.some((part) =>
      /^(node_modules|\.next|\.turbo|coverage|dist|build|test-results|playwright-report|work-board-sessions|secrets?|credentials?|\.aws|\.ssh|\.npmrc|\.netrc|\.envrc|\.git-credentials|\.pypirc)$/.test(
        part,
      ),
    ) ||
    parts.some(
      (part) => /^\.env(?:\.|$)/.test(part) && !/^\.env\.(example|sample|template)$/.test(part),
    ) ||
    /(?:^|\/)(?:id_rsa|id_ed25519|credentials[^/]*|secrets?[^/]*)(?:$|\.)/i.test(file) ||
    /\.(pem|key|p12|pfx)$/i.test(file)
  )
    throw new Error(`CHECKPOINT_PATH_REJECTED: excluded source path ${file}.`);
  const full = resolve(root, file);
  if (existsSync(full)) {
    const rel = relative(realpathSync(root), realpathSync(full));
    if (rel.startsWith("..") || isAbsolute(rel) || !lstatSync(full).isFile())
      throw new Error(
        `CHECKPOINT_PATH_REJECTED: only ordinary source files are accepted (${file}).`,
      );
  }
  return file;
}
function list(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\0")
    .filter(Boolean);
}

/** Snapshot unfinished source without changing HEAD, the user's index, or working files. */
export function createCheckpoint(cwd, card, attemptId, input = {}, { publish = true } = {}) {
  const { root } = repositoryContext(cwd);
  uuid(card.id);
  uuid(attemptId);
  const repo = repository(root, card);
  if (git(root, ["merge-base", "--is-ancestor", repo.baseCommit, "HEAD"], true) === null)
    throw new Error("CHECKPOINT_BASE_MISMATCH: source HEAD does not contain approved base.");
  if (!Array.isArray(input.files ?? []))
    throw new Error("Checkpoint files must be an explicit array.");
  const explicit = (input.files ?? []).map((file) => safePath(root, file));
  const dirty = list(root, ["diff", "--name-only", "-z", "HEAD"]);
  dirty.forEach((file) => safePath(root, file));
  const omittedUntracked = list(root, ["ls-files", "--others", "--exclude-standard", "-z"]).filter(
    (file) => !explicit.includes(file),
  );
  const temporary = mkdtempSync(resolve(tmpdir(), "agent-checkpoint-"));
  // Checkpoints are automated, unverified snapshots, not the worker's final commits.
  // Give them an explicit identity without requiring or changing user Git settings.
  const env = {
    ...process.env,
    GIT_INDEX_FILE: resolve(temporary, "index"),
    GIT_AUTHOR_NAME: "Accelerate checkpoint",
    GIT_AUTHOR_EMAIL: "checkpoint@accelerate.invalid",
    GIT_COMMITTER_NAME: "Accelerate checkpoint",
    GIT_COMMITTER_EMAIL: "checkpoint@accelerate.invalid",
  };
  const run = (args) => {
    try {
      return execFileSync("git", args, {
        cwd: root,
        env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      throw new Error(
        `Checkpoint Git ${args[0]} failed; working source and original index are preserved.`,
      );
    }
  };
  const branch = `agent/checkpoints/${card.id}/${attemptId}/${randomUUID()}`;
  try {
    run(["read-tree", "HEAD"]);
    const files = [...new Set([...dirty, ...explicit])];
    if (files.length) run(["--literal-pathspecs", "add", "-A", "--", ...files]);
    const commitSha = run([
      "commit-tree",
      run(["write-tree"]),
      "-p",
      git(root, ["rev-parse", "HEAD"]),
      "-m",
      `Unverified work checkpoint for ${card.id}`,
    ]);
    run([
      "update-ref",
      `refs/heads/${branch}`,
      commitSha,
      "0000000000000000000000000000000000000000",
    ]);
    if (publish) {
      try {
        run(["push", "origin", `refs/heads/${branch}:refs/heads/${branch}`]);
      } catch {
        throw new Error(
          `CHECKPOINT_PUBLISH_FAILED: local checkpoint ${commitSha} retained at ${branch}; retry publishing this ref before recording a transferable checkpoint.`,
        );
      }
    }
    return {
      checkpoint: {
        commitSha,
        baseCommit: repo.baseCommit,
        branch,
        summary: input.summary ?? "Unverified work in progress",
        completed: input.completed ?? [],
        remaining: input.remaining ?? [],
        artifacts: input.artifacts ?? [],
      },
      omittedUntracked,
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

/** Plan an isolated successor; createWorkspace owns the actual checkout creation. */
export function prepareSuccessor(cwd, card, suffixUUID) {
  const { root, common } = repositoryContext(cwd);
  uuid(card.id);
  uuid(suffixUUID);
  const repo = repository(root, card);
  const checkpoint = card.work_checkpoint;
  if (!checkpoint || !SHA.test(checkpoint.commitSha ?? "") || !UUID.test(checkpoint.id ?? ""))
    throw new Error("CHECKPOINT_MISSING: recover or publish a source checkpoint before takeover.");
  if (checkpoint.baseCommit !== repo.baseCommit)
    throw new Error("CHECKPOINT_BASE_MISMATCH: checkpoint does not match the approved base.");
  const prefix = `agent/checkpoints/${card.id}/`;
  const tail = checkpoint.branch?.startsWith(prefix)
    ? checkpoint.branch.slice(prefix.length).split("/")
    : [];
  if (tail.length !== 2 || !tail.every((part) => UUID.test(part)))
    throw new Error(
      "CHECKPOINT_REF_INVALID: checkpoint must name this card's immutable checkpoint branch.",
    );
  const ref = `refs/heads/${checkpoint.branch}`;
  if (git(root, ["rev-parse", "--verify", ref], true) !== checkpoint.commitSha) {
    try {
      git(root, ["fetch", "--no-tags", "origin", ref]);
    } catch {
      throw new Error(
        "CHECKPOINT_UNAVAILABLE: published checkpoint branch could not be recovered.",
      );
    }
    if (git(root, ["rev-parse", "FETCH_HEAD"], true) !== checkpoint.commitSha)
      throw new Error(
        "CHECKPOINT_REF_MISMATCH: published branch differs from the recorded source.",
      );
  }
  if (
    git(root, ["merge-base", "--is-ancestor", repo.baseCommit, checkpoint.commitSha], true) === null
  )
    throw new Error("CHECKPOINT_BASE_MISMATCH: checkpoint history excludes approved base.");
  const key = card.seed_key ?? card.id;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(key))
    throw new Error("Checkpoint card key cannot safely name a worktree.");
  const name = `${key}-${suffixUUID}`;
  const branch = `agent/${name}`;
  const path = resolve(
    dirname(dirname(common)),
    ".agent-worktrees",
    basename(dirname(common)),
    name,
  );
  if (existsSync(path) || git(root, ["rev-parse", "--verify", `refs/heads/${branch}`], true))
    throw new Error(
      "CHECKPOINT_SUCCESSOR_OCCUPIED: preserve the existing successor and use its recorded ownership.",
    );
  return { root, path, branch, baseCommit: checkpoint.commitSha, mode: "create" };
}

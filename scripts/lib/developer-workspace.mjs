import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, basename, resolve } from "node:path";

export function git(cwd, args, optional = false) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    if (optional) return null;
    throw new Error(
      `Git ${args[0]} failed. Inspect repository access and the approved base; no credentials are printed.`,
    );
  }
}

export function repositoryIdentity(value) {
  const input = String(value ?? "")
    .trim()
    .replace(/^git@([^:]+):/, "ssh://git@$1/");
  try {
    const url = new URL(input);
    if (!["https:", "ssh:", "file:"].includes(url.protocol) || url.password) return null;
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\.git\/?$/, "").replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export function repositoryContext(cwd) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const common = resolve(root, git(root, ["rev-parse", "--git-common-dir"]));
  return { root, common, sessions: resolve(common, "work-board-sessions") };
}

/** Validate before claiming. Fetches only the declared origin branch when explicitly enabled. */
export function prepareWorkspace(cwd, card, { fetchBase = false } = {}) {
  const { root, common } = repositoryContext(cwd);
  const repo = card.work_spec?.repository;
  if (
    !repo ||
    !/^[a-f0-9]{40}$/.test(repo.baseCommit) ||
    !repo.baseBranch ||
    git(root, ["check-ref-format", `refs/heads/${repo.baseBranch}`], true) === null
  )
    throw new Error(
      "Ticket needs an approved repository URL, branch and exact 40-character base commit. No work was claimed.",
    );
  const identity = repositoryIdentity(repo.url);
  if (
    !identity ||
    identity !== repositoryIdentity(git(root, ["remote", "get-url", "origin"], true))
  )
    throw new Error(
      "This checkout's origin does not match the ticket repository. Use the approved clone before claiming.",
    );
  const localRef = `refs/heads/${repo.baseBranch}`;
  const remoteRef = `refs/remotes/origin/${repo.baseBranch}`;
  const contains = (ref) =>
    git(root, ["merge-base", "--is-ancestor", repo.baseCommit, ref], true) !== null;
  if (!contains(localRef) && !contains(remoteRef) && fetchBase) {
    git(root, ["fetch", "--no-tags", "origin", `refs/heads/${repo.baseBranch}:${remoteRef}`]);
  }
  if (!contains(localRef) && !contains(remoteRef))
    throw new Error(
      "Approved base is unavailable or not an ancestor of its branch. Fetch the published branch; ask the maintainer to publish/reconcile it if missing. No work was claimed.",
    );
  const key = card.seed_key ?? card.id;
  if (typeof key !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(key))
    throw new Error(
      "Ticket key cannot safely name a worktree. Ask the maintainer to correct it; no work was claimed.",
    );
  const branch = `agent/${key}`;
  const entries = git(root, ["worktree", "list", "--porcelain"]).split("\n\n");
  const existing = entries.find((block) =>
    block.split("\n").includes(`branch refs/heads/${branch}`),
  );
  const path =
    existing
      ?.split("\n")
      .find((line) => line.startsWith("worktree "))
      ?.slice(9) ??
    resolve(dirname(dirname(common)), ".agent-worktrees", basename(dirname(common)), key);
  if (existsSync(path)) {
    if (!existing || git(path, ["branch", "--show-current"], true) !== branch)
      throw new Error(
        "The target worktree path is already occupied. Preserve it and resolve ownership before claiming.",
      );
    if (git(path, ["status", "--porcelain"]))
      throw new Error(
        "The retained worktree has uncommitted changes. Review and preserve that handoff before claiming, or deliberately use --no-worktree for manual preparation.",
      );
    if (git(path, ["merge-base", "--is-ancestor", repo.baseCommit, "HEAD"], true) === null)
      throw new Error(
        "Retained worktree does not contain the approved base. Reconcile it before claiming.",
      );
    return { root, path, branch, baseCommit: repo.baseCommit, mode: "reuse" };
  }
  const branchExists = git(root, ["rev-parse", "--verify", `refs/heads/${branch}`], true) !== null;
  if (branchExists && !contains(`refs/heads/${branch}`))
    throw new Error(
      "Existing ticket branch does not contain the approved base. Reconcile it before claiming.",
    );
  return {
    root,
    path,
    branch,
    baseCommit: repo.baseCommit,
    mode: branchExists ? "attach" : "create",
  };
}

export function createWorkspace(plan) {
  if (plan.mode === "create")
    git(plan.root, ["worktree", "add", "-b", plan.branch, plan.path, plan.baseCommit]);
  else if (plan.mode === "attach") git(plan.root, ["worktree", "add", plan.path, plan.branch]);
  return plan.path;
}

export function boardEndpoint(env) {
  if (!env.WORK_BOARD_URL)
    throw new Error("Set WORK_BOARD_URL to the maintainer's canonical board endpoint.");
  const url = new URL("/api/agent/work-board", env.WORK_BOARD_URL);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw new Error("Use HTTPS for remote work boards; plain HTTP is allowed only on loopback.");
  return url;
}

export async function requestBoard(endpoint, token, path = "", body) {
  if (!token)
    throw new Error(
      "Set a project-scoped WORK_BOARD_TOKEN issued by the maintainer; database credentials are not required.",
    );
  let response;
  try {
    response = await fetch(`${endpoint}${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      "Work board is unreachable or timed out. Check the endpoint and retry with the same request key after an uncertain mutation.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const instruction =
      response.status === 401 || response.status === 403
        ? "Ask the maintainer to check your token's expiry, project, scopes and capabilities."
        : response.status === 404 || !data
          ? "The endpoint may still run the old application; the maintainer must activate the canonical work-board release."
          : "Refresh the card and inspect its readiness or review the request receipt before retrying.";
    throw new Error(`Work board request failed (${response.status}). ${instruction}`);
  }
  return data;
}

export function requireBoardProtocol(data) {
  if (data.protocolVersion !== 2 || data.schemaReady !== true || !Array.isArray(data.features))
    throw new Error(
      "This endpoint has not proven execution-packet protocol v2. Ask the maintainer to apply migrations and deploy the compatible board before claiming.",
    );
}

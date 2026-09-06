import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { git, repositoryIdentity } from "./developer-workspace.mjs";

export function inspectMaintainerPolicy(policy, { login, protection }) {
  const checks = [];
  const add = (id, passed, detail) =>
    checks.push({ id, status: passed ? "pass" : "blocked", detail });
  add(
    "github-account",
    login === policy.githubAccount,
    `Use GitHub account ${policy.githubAccount}; current account is ${login || "unverified"}. Correct gh authentication before repository mutations.`,
  );
  const reviews = protection?.required_pull_request_reviews;
  add(
    "single-owner-review",
    Boolean(protection) &&
      (!reviews ||
        (reviews.required_approving_review_count === 0 &&
          !reviews.require_code_owner_reviews &&
          !reviews.require_last_push_approval)),
    "Single-owner mode must not require the PR author to approve their own work. Keep PR evidence and CI; do not invent a second GitHub identity.",
  );
  add(
    "required-ci",
    Boolean(
      protection?.required_status_checks?.contexts?.includes("verify") &&
      protection.required_status_checks.strict &&
      protection.enforce_admins?.enabled,
    ),
    "Require verify, an up-to-date candidate and administrator enforcement. The doctor never changes protection settings.",
  );
  return checks;
}

export function maintainerPreflight(
  root,
  request = (endpoint) => {
    try {
      return JSON.parse(
        execFileSync("gh", ["api", endpoint], {
          encoding: "utf8",
          timeout: 20000,
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
    } catch {
      throw new Error(
        "GitHub readiness is unverified. Check gh auth status and access to the configured repository; no credentials or provider response were printed.",
      );
    }
  },
) {
  const policy = JSON.parse(readFileSync(resolve(root, "workflow-policy.json"), "utf8"));
  if (
    policy.reviewMode !== "single-owner" ||
    !/^[\w-]+\/[\w.-]+$/.test(policy.repository) ||
    !/^[\w-]+$/.test(policy.githubAccount) ||
    policy.integrationBranch !== "main"
  )
    throw new Error(
      "Review workflow-policy.json: declare repository, owner account, main integration branch and single-owner review mode.",
    );
  if (
    repositoryIdentity(git(root, ["remote", "get-url", "origin"])) !==
    `github.com/${policy.repository}`
  )
    throw new Error(
      "Origin differs from workflow-policy.json. Use the agreed checkout; do not change an unrelated repository's settings.",
    );
  const login = request("user").login;
  // Check identity before querying private repository settings.
  if (login !== policy.githubAccount)
    return [
      {
        id: "github-account",
        status: "blocked",
        detail: `Connect ${policy.githubAccount} with gh auth login or gh auth switch before maintainer work.`,
      },
    ];
  const base = `repos/${policy.repository}`;
  const protection = request(`${base}/branches/main/protection`);
  const checks = inspectMaintainerPolicy(policy, { login, protection });
  const remote = request(`${base}/git/ref/heads/main`).object.sha;
  const fetched = git(root, ["rev-parse", "refs/remotes/origin/main"], true);
  checks.push({
    id: "integration-ref",
    status: fetched === remote ? "pass" : "blocked",
    detail:
      fetched === remote
        ? `origin/main matches GitHub at ${remote}. Pin this exact base for new integration work; active tickets retain their approved bases.`
        : "Run git fetch origin, then inspect main and active worktrees. The doctor does not fetch, merge, reset or adopt another agent's checkout.",
  });
  const worktrees = git(root, ["worktree", "list", "--porcelain"]).split("\n\n").filter(Boolean);
  checks.push({
    id: "worktree-ownership",
    status: "warning",
    detail: `${worktrees.length} worktrees registered. Inspect ownership and dirty changes before integration; branch ancestry alone cannot prove completion after a squash merge.`,
  });
  checks.push({
    id: "release-boundary",
    status: "not-checked",
    detail:
      "This checks maintainer access and merge policy, not candidate CI, board claims or production readiness. Use dev:doctor --board for dispatch and deploy:check for the exact hosting target.",
  });
  return checks;
}

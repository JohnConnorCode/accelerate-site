import { format, resolveConfig } from "prettier";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { routeWrites, tenantRegistryGaps } from "./verify-runtime-boundaries.mjs";
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const head = process.argv[2];
if (!head || !/^[a-f0-9]{40}$/.test(head))
  throw new Error("Pass the immutable audit starting commit");
const since = "2026-08-29T00:00:00-05:00";
const base = git("rev-list", "-1", `--before=${since}`, head);
const commits = git("log", `--since=${since}`, "--format=%H%x09%aI%x09%s", head)
  .split("\n")
  .map((line) => {
    const [sha, date, ...title] = line.split("\t");
    return { sha, date, title: title.join("\t") };
  });
const netChanges = git("diff", "--numstat", base, head)
  .split("\n")
  .map((line) => {
    const [added, removed, ...path] = line.split("\t");
    return { path: path.join("\t"), added, removed };
  });
// Include paths touched and subsequently reverted, and merge resolutions.
// Net diff alone silently omits those changes from an "all changes" audit.
const paths = [
  ...new Set(
    git(
      "log",
      `--since=${since}`,
      "--format=",
      "--name-only",
      "--no-renames",
      "--diff-merges=first-parent",
      head,
    )
      .split("\n")
      .filter(Boolean),
  ),
]
  .sort()
  .map((path) => ({ path }));
const branches = git("for-each-ref", "--format=%(refname:short)", "refs/heads")
  .split("\n")
  .flatMap((branch) => {
    if (branch === "agent/northstar-runtime-consolidation") return [];
    const count = Number(git("rev-list", "--count", `${head}..${branch}`));
    if (!count) return [];
    const sha = git("rev-parse", branch);
    const files = git("diff", "--name-only", `${head}...${sha}`).split("\n");
    return [
      {
        branch,
        sha,
        uniqueCommits: count,
        files,
        disposition:
          "Preserved: unique work is not automatically merged by this audit. Compare with its Feature Board acceptance and current domain changes before release.",
      },
    ];
  });
const writes = routeWrites(process.cwd());
const report = {
  baseline: base,
  head,
  since,
  commits,
  paths,
  netChanges,
  branches,
  worktrees: git("worktree", "list", "--porcelain"),
  coverage: {
    kind: "Complete change inventory and static boundary scan, targeted behavioral review; not a claim of line-by-line review of every file",
    sourcePathCount: paths.filter((p) => p.path.startsWith("src/")).length,
  },
  currentBoundaries: {
    unscopedCreatedTenantTables: tenantRegistryGaps(process.cwd()),
    directRouteWriteSites: writes,
  },
};
mkdirSync("docs/internal/audits", { recursive: true });
writeFileSync(
  "docs/internal/audits/2026-09-04-runtime-inventory.json",
  await format(JSON.stringify(report), {
    ...(await resolveConfig("docs/internal/audits/2026-09-04-runtime-inventory.json")),
    parser: "json",
  }),
);
console.log(
  JSON.stringify({
    commits: commits.length,
    paths: paths.length,
    unmergedBranches: branches.length,
    remainingDirectRouteWriteSites: Object.keys(writes).length,
  }),
);

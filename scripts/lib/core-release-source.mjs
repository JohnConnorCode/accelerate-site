import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { migrationCatalog } from "./migration-ledger.mjs";
import { catalogDigest, parseReleaseMetadata } from "../../src/lib/revenue-os/core-release.mjs";

const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export function sourceIdentity(root) {
  let forkCommit = null;
  let customized = null;
  let core = null;
  try {
    forkCommit = git(root, ["rev-parse", "HEAD"]);
    const raw = JSON.parse(readFileSync(join(root, "core-release.json"), "utf8"));
    core = raw === null ? null : parseReleaseMetadata(raw);
    if (core) git(root, ["merge-base", "--is-ancestor", core.sourceCommit, "HEAD"]);
    customized = core
      ? Boolean(git(root, ["status", "--porcelain", "--untracked-files=no"])) ||
        forkCommit !== core.sourceCommit
      : null;
  } catch {
    core = null;
  }
  return { core, forkCommit, customized, nodeVersion: process.versions.node };
}

export function prepareReleaseMetadata(root, { version, supportedSourceVersions, notes }) {
  if (git(root, ["status", "--porcelain"])) throw new Error("Release source must be clean");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const policy = JSON.parse(readFileSync(join(root, "release-policy.json"), "utf8"));
  if (version !== `v${pkg.version}` || !/^>=\d+\.\d+\.\d+$/.test(pkg.engines.node))
    throw new Error("Release version must match package.json and its explicit Node minimum");
  const catalog = migrationCatalog(root).map(({ file, checksum }) => ({ file, checksum }));
  return parseReleaseMetadata({
    schemaVersion: 1,
    upstream: policy.upstream,
    version,
    sourceCommit: git(root, ["rev-parse", "HEAD"]),
    notes,
    runtime: {
      nodeMinimum: pkg.engines.node.slice(2),
      npmMinimum: policy.npmMinimum,
      postgresMinimum: policy.postgresMinimum,
    },
    migrations: { digest: catalogDigest(catalog), catalog },
    extensions: {
      contractVersion: policy.extensionContract,
      schemaDigest: createHash("sha256")
        .update(readFileSync(join(root, "extensions/module-manifest.schema.json")))
        .digest("hex"),
    },
    supportedSourceVersions,
  });
}

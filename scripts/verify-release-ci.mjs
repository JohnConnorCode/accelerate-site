import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { verifyReleaseCi } from "./lib/release-ci.mjs";
import {
  parseReleaseMetadata,
  githubReader,
  verifyPublishedRelease,
  planReleaseUpgrade,
} from "../src/lib/revenue-os/core-release.mjs";

const [metadataFile, outputFile] = process.argv.slice(2);
if (!metadataFile || !outputFile) throw new Error("Provide metadata and evidence output paths");
const metadata = parseReleaseMetadata(JSON.parse(readFileSync(metadataFile, "utf8")));
const policy = JSON.parse(readFileSync("release-policy.json", "utf8"));
const read = githubReader();
for (const tag of metadata.supportedSourceVersions) {
  const source = await verifyPublishedRelease(read, await read(`/releases/tags/${tag}`));
  if (
    planReleaseUpgrade(source, [source, metadata], metadata.runtime.nodeMinimum).status !==
    "available"
  )
    throw new Error(`Declared source ${tag} is incompatible with this release`);
  execFileSync("git", ["merge-base", "--is-ancestor", source.sourceCommit, metadata.sourceCommit], {
    stdio: "pipe",
  });
}
const api = (path) =>
  JSON.parse(
    execFileSync("gh", ["api", `repos/${policy.upstream}${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
const evidence = [];
for (const workflow of policy.requiredWorkflows) {
  const runs = api(
    `/actions/workflows/${workflow}/runs?head_sha=${metadata.sourceCommit}&per_page=100`,
  ).workflow_runs;
  let verified = null;
  for (const run of runs ?? []) {
    if (run.head_sha !== metadata.sourceCommit || run.conclusion !== "success") continue;
    const page = api(`/actions/runs/${run.id}/jobs?per_page=100&filter=latest`);
    if (page.total_count > 100) continue;
    const receipt = { workflow, run, jobs: page.jobs };
    try {
      verifyReleaseCi(metadata.sourceCommit, [workflow], [receipt]);
      verified = receipt;
      break;
    } catch {
      /* Try another complete receipt for the same source. */
    }
  }
  if (!verified) throw new Error(`No complete exact-source ${workflow} receipt`);
  evidence.push(verified);
}
const result = verifyReleaseCi(metadata.sourceCommit, policy.requiredWorkflows, evidence);
writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sourceIdentity, prepareReleaseMetadata } from "./lib/core-release-source.mjs";
import {
  discoverCoreReleases,
  githubReader,
  parseReleaseMetadata,
  verifyPublishedRelease,
} from "../src/lib/revenue-os/core-release.mjs";

const [command = "check", ...args] = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith("--") || args[i + 1] === undefined || args[i + 1].startsWith("--"))
    throw new Error("Use named options with values");
  options[args[i].slice(2)] = args[i + 1];
}
const allowed = { check: [], adopt: ["tag"], prepare: ["version", "sources", "notes", "output"] }[
  command
];
if (!allowed || Object.keys(options).some((k) => !allowed.includes(k)))
  throw new Error("Unknown release command or option");
const root = process.cwd();
if (command === "check") {
  console.log(JSON.stringify(await discoverCoreReleases(sourceIdentity(root)), null, 2));
} else if (command === "adopt") {
  const read = githubReader();
  if (!/^v\d+\.\d+\.\d+$/.test(options.tag ?? ""))
    throw new Error("Choose an exact published stable tag");
  const core = await verifyPublishedRelease(read, await read(`/releases/tags/${options.tag}`));
  execFileSync("git", ["merge-base", "--is-ancestor", core.sourceCommit, "HEAD"], {
    stdio: "pipe",
  });
  const rawExisting = JSON.parse(readFileSync("core-release.json", "utf8"));
  const existing = rawExisting === null ? null : parseReleaseMetadata(rawExisting);
  if (existing && existing.version !== core.version)
    throw new Error(
      "Existing core identity differs. Complete the reviewed upgrade before changing it.",
    );
  writeFileSync("core-release.json", `${JSON.stringify(core, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        status: "adopted",
        version: core.version,
        sourceCommit: core.sourceCommit,
        file: "core-release.json",
        message:
          "Commit this core identity with your fork, then rebuild. Database state and deployment were not changed.",
      },
      null,
      2,
    ),
  );
} else {
  if (!options.notes || !options.output || !options.version)
    throw new Error("prepare requires --version, --notes and --output");
  const metadata = prepareReleaseMetadata(root, {
    version: options.version,
    supportedSourceVersions: options.sources ? options.sources.split(",") : [],
    notes: readFileSync(options.notes, "utf8"),
  });
  writeFileSync(options.output, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: "prepared",
      version: metadata.version,
      sourceCommit: metadata.sourceCommit,
      output: options.output,
    }),
  );
}

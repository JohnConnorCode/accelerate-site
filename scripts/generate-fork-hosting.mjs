#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { assertForkHosting } from "./lib/neutral-distribution.mjs";

function value(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const target = assertForkHosting({
    projectId: value("--project"),
    teamId: value("--team"),
    projectName: value("--name") || "my-revenue-os",
    canonicalUrl: value("--url"),
  });
  writeFileSync("deployment-target.json", JSON.stringify(target, null, 2) + "\n");
  console.log(JSON.stringify({ result: "wrote", file: "deployment-target.json", target }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Hosting generation failed");
  process.exitCode = 1;
}

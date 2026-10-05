#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { assertForkHosting } from "./lib/neutral-distribution.mjs";

try {
  const options = new Map();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i],
      value = args[i + 1];
    if (
      !["--project", "--team", "--name", "--url"].includes(flag) ||
      options.has(flag) ||
      !value ||
      value.startsWith("--")
    )
      throw new Error("Use --project, --team, --name and --url once each, with values.");
    options.set(flag, value);
  }
  const target = assertForkHosting({
    projectId: options.get("--project"),
    teamId: options.get("--team"),
    projectName: options.get("--name") || "my-revenue-os",
    canonicalUrl: options.get("--url"),
  });
  const file = "deployment-target.local.json";
  writeFileSync(file, JSON.stringify(target, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ result: "wrote", file, target }, null, 2));
} catch (error) {
  console.error(
    error.code === "EEXIST"
      ? "deployment-target.local.json already exists. Review and edit that file; generation never overwrites it."
      : error instanceof Error
        ? error.message
        : "Hosting generation failed",
  );
  process.exitCode = 1;
}

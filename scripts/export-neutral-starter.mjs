#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadInclusionManifest, starterFiles } from "./lib/neutral-distribution.mjs";

const safePath = (path) =>
  typeof path === "string" &&
  path.length > 0 &&
  !isAbsolute(path) &&
  !path.split(/[\\/]/).some((part) => !part || part === "." || part === "..");
const forbidden = (path) =>
  path
    .split(/[\\/]/)
    .some((part) =>
      /^(?:\.git|\.vercel|node_modules|\.next.*|\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx))$/i.test(
        part,
      ),
    );

/** Copy only the manifest's reviewed tracked source into a new, isolated directory. */
export function exportNeutralStarter(root, output) {
  root = realpathSync(root);
  output = resolve(output);
  if (existsSync(output))
    throw new Error(
      "Starter output must be a new directory; existing source is never overwritten.",
    );
  let ancestor = dirname(output);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  output = resolve(realpathSync(ancestor), relative(ancestor, output));
  const inside = relative(root, output);
  if (inside === "" || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside))) {
    throw new Error("Starter output must be outside the source checkout.");
  }
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const sourceDirty = Boolean(
    execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(),
  );
  const manifest = loadInclusionManifest(root);
  const replacements = manifest.replacements || {};
  const files = starterFiles(root).filter((file) => !forbidden(file));
  const plan = files.map((file) => [file, file]);
  for (const [target, source] of Object.entries(replacements)) {
    if (
      !safePath(target) ||
      !safePath(source) ||
      !source.startsWith("distribution/neutral-starter/") ||
      (forbidden(target) &&
        !(
          target === ".env.example" &&
          source === "distribution/neutral-starter/environment.example.txt"
        )) ||
      forbidden(source)
    )
      throw new Error("Unsafe starter replacement path.");
    const existing = plan.findIndex(([file]) => file === target);
    if (existing >= 0) plan.splice(existing, 1);
    plan.push([target, source]);
  }
  // Validate the entire plan before creating output. Symlinks never escape into a starter.
  for (const [target, source] of plan) {
    if (!safePath(target) || !safePath(source)) throw new Error("Unsafe starter source path.");
    const full = resolve(root, source);
    if (!lstatSync(full).isFile() || realpathSync(full) !== full)
      throw new Error(`Starter source must be a regular file: ${source}`);
  }
  if (
    JSON.stringify(manifest.environment) !==
    JSON.stringify({ NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral" })
  ) {
    throw new Error("Starter environment must contain only the public neutral profile flag.");
  }
  mkdirSync(output, { recursive: true });
  const receipts = [];
  for (const [target, source] of plan.sort(([a], [b]) => a.localeCompare(b))) {
    const destination = resolve(output, target);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, source), destination);
    receipts.push({
      path: target,
      source,
      sha256: createHash("sha256").update(readFileSync(destination)).digest("hex"),
    });
  }
  writeFileSync(resolve(output, ".env"), "NEXT_PUBLIC_DISTRIBUTION_PROFILE=neutral\n");
  writeFileSync(
    resolve(output, "neutral-starter-receipt.json"),
    JSON.stringify(
      { schemaVersion: 1, profile: "neutral", sourceCommit, sourceDirty, files: receipts },
      null,
      2,
    ) + "\n",
  );
  return { output, files: receipts.length, receipt: "neutral-starter-receipt.json" };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--output")
      throw new Error("Usage: node scripts/export-neutral-starter.mjs --output /new/absolute/path");
    console.log(JSON.stringify(exportNeutralStarter(process.cwd(), args[1]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

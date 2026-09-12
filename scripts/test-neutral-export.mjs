import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportNeutralStarter } from "./export-neutral-starter.mjs";
const temp = mkdtempSync(join(tmpdir(), "neutral-export-test-"));
try {
  const root = join(temp, "source");
  mkdirSync(root);
  execFileSync("git", ["init", "--quiet", root]);
  const file = (path, data) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), data);
  };
  const manifest = {
    excludePrefixes: ["public/", "distribution/neutral-starter/", "src/content/team.ts"],
    replacements: { "src/content/team.ts": "distribution/neutral-starter/team.txt" },
    environment: { NEXT_PUBLIC_DISTRIBUTION_PROFILE: "neutral" },
  };
  const save = () => file("distribution/inclusion-manifest.json", JSON.stringify(manifest));
  save();
  file("src/content/team.ts", "PRIVATE ORIGINAL BIO");
  file("distribution/neutral-starter/team.txt", "export const TEAM_MEMBERS = [];");
  file("src/lib/runtime.ts", "export const runtime = 'shared';");
  file("public/customer.jpg", "PRIVATE MEDIA");
  file(".env.local", "PRIVATE TEST SECRET");
  execFileSync("git", ["add", "."], { cwd: root });
  file("unknown.txt", "untracked data");
  const output = join(temp, "starter");
  exportNeutralStarter(root, output);
  assert.equal(
    readFileSync(join(output, "src/content/team.ts"), "utf8"),
    "export const TEAM_MEMBERS = [];",
  );
  assert.equal(
    readFileSync(join(output, "src/lib/runtime.ts"), "utf8"),
    "export const runtime = 'shared';",
  );
  for (const path of [
    ".env.local",
    "public/customer.jpg",
    "unknown.txt",
    ".git",
    "distribution/neutral-starter/team.txt",
  ])
    assert.equal(existsSync(join(output, path)), false, path);
  assert.equal(
    readFileSync(join(output, ".env"), "utf8"),
    "NEXT_PUBLIC_DISTRIBUTION_PROFILE=neutral\n",
  );
  assert.throws(() => exportNeutralStarter(root, output), /new directory/);
  assert.throws(() => exportNeutralStarter(root, join(root, "nested")), /outside/);
  manifest.replacements["../escape"] = "distribution/neutral-starter/team.txt";
  save();
  assert.throws(() => exportNeutralStarter(root, join(temp, "escape")), /Unsafe/);
  delete manifest.replacements["../escape"];
  manifest.replacements[".env.local"] = "distribution/neutral-starter/team.txt";
  save();
  assert.throws(() => exportNeutralStarter(root, join(temp, "secret")), /Unsafe/);
  delete manifest.replacements[".env.local"];
  symlinkSync(
    join(temp, "starter", "src/lib/runtime.ts"),
    join(root, "distribution/neutral-starter/link.txt"),
  );
  manifest.replacements["src/content/team.ts"] = "distribution/neutral-starter/link.txt";
  save();
  assert.throws(() => exportNeutralStarter(root, join(temp, "symlink")), /regular file/);
  assert.equal(existsSync(join(temp, "symlink")), false);
  console.log(
    "PASS: actual export replaces protected content, preserves shared code, omits media/private/untracked files, validates before writes and refuses escapes, symlinks and overwrites.",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

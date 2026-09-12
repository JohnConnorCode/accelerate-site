import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { createCheckpoint, prepareSuccessor } from "./lib/agent-checkpoint.mjs";
import { createWorkspace } from "./lib/developer-workspace.mjs";
const temp = mkdtempSync(resolve(tmpdir(), "checkpoint-test-"));
const root = resolve(temp, "source");
const remote = resolve(temp, "remote.git");
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
try {
  mkdirSync(root);
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Checkpoint Test"]);
  git(["config", "user.email", "checkpoint@example.invalid"]);
  writeFileSync(resolve(root, "source.txt"), "base\n");
  git(["add", "."]);
  git(["commit", "-m", "base"]);
  git(["init", "--bare", remote]);
  git(["remote", "add", "origin", pathToFileURL(remote).href]);
  git(["push", "origin", "main"]);
  const base = git(["rev-parse", "HEAD"]);
  const card = {
    id: randomUUID(),
    seed_key: "fixture",
    work_spec: {
      repository: { url: pathToFileURL(remote).href, baseCommit: base, baseBranch: "main" },
    },
  };
  writeFileSync(resolve(root, "source.txt"), "staged\n");
  git(["add", "source.txt"]);
  writeFileSync(resolve(root, "source.txt"), "dirty\n");
  writeFileSync(resolve(root, "explicit.txt"), "recover me\n");
  writeFileSync(resolve(root, "unknown.txt"), "omit me\n");
  const index = readFileSync(resolve(root, ".git/index"));
  const result = createCheckpoint(root, card, randomUUID(), {
    files: ["explicit.txt"],
    remaining: ["verification"],
  });
  assert.equal(git(["rev-parse", "HEAD"]), base);
  assert.deepEqual(readFileSync(resolve(root, ".git/index")), index);
  assert.equal(readFileSync(resolve(root, "source.txt"), "utf8"), "dirty\n");
  assert.equal(git(["show", `${result.checkpoint.commitSha}:source.txt`]), "dirty");
  assert.equal(git(["show", `${result.checkpoint.commitSha}:explicit.txt`]), "recover me");
  assert.deepEqual(result.omittedUntracked, ["unknown.txt"]);
  assert.throws(() => git(["show", `${result.checkpoint.commitSha}:unknown.txt`]));
  for (const file of [
    ".env.local",
    "secrets.json",
    "../escape",
    "/tmp/escape",
    "node_modules/x.js",
    "key.pem",
    ":(glob)*",
  ]) {
    assert.throws(() =>
      createCheckpoint(root, card, randomUUID(), { files: [file] }, { publish: false }),
    );
  }
  assert.throws(() => prepareSuccessor(root, card, randomUUID()), /CHECKPOINT_MISSING/);
  const saved = { ...card, work_checkpoint: { id: randomUUID(), ...result.checkpoint } };
  writeFileSync(resolve(root, "source.txt"), "late predecessor edit\n");
  const plan = prepareSuccessor(root, saved, randomUUID());
  createWorkspace(plan);
  assert.equal(readFileSync(resolve(plan.path, "source.txt"), "utf8"), "dirty\n");
  assert.equal(readFileSync(resolve(root, "source.txt"), "utf8"), "late predecessor edit\n");
  assert.throws(
    () =>
      prepareSuccessor(
        root,
        { ...saved, work_checkpoint: { ...saved.work_checkpoint, baseCommit: "a".repeat(40) } },
        randomUUID(),
      ),
    /BASE_MISMATCH/,
  );
  assert.throws(
    () =>
      createCheckpoint(
        root,
        {
          ...card,
          work_spec: {
            repository: { ...card.work_spec.repository, url: "https://example.invalid/wrong.git" },
          },
        },
        randomUUID(),
      ),
    /ORIGIN_MISMATCH/,
  );
  git(["update-ref", "-d", `refs/heads/${result.checkpoint.branch}`]);
  assert.equal(prepareSuccessor(root, saved, randomUUID()).baseCommit, result.checkpoint.commitSha);
  git(["config", "remote.origin.pushurl", pathToFileURL(resolve(temp, "missing.git")).href]);
  let failure;
  try {
    createCheckpoint(root, card, randomUUID());
  } catch (error) {
    failure = error;
  }
  assert.match(failure.message, /CHECKPOINT_PUBLISH_FAILED/);
  const retained = failure.message.match(/retained at ([^;]+);/)[1];
  assert.match(git(["rev-parse", `refs/heads/${retained}`]), /^[a-f0-9]{40}$/);
  console.log(
    JSON.stringify({
      result: "passed",
      scenarios: [
        "source-index-preserved",
        "explicit-files",
        "unknown-omitted",
        "excluded-paths",
        "missing-checkpoint",
        "isolated-successor",
        "base-origin-validation",
        "remote-recovery",
        "failed-push-retained",
      ],
    }),
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

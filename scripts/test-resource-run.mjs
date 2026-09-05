import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { acquireLock, checkCapacity, groupRss, runHeavyJob } from "./resource-run.mjs";

const GiB = 1024 ** 3;
test("refuses disk exhaustion and memory pressure, with lower running disk threshold", () => {
  assert.throws(() => checkCapacity({ availableBytes: GiB, freePercent: 50 }), /disk/);
  assert.throws(() => checkCapacity({ availableBytes: 10 * GiB, freePercent: 19 }), /memory/);
  assert.throws(() => checkCapacity({ availableBytes: GiB, freePercent: 50 }, false), /disk/);
  assert.doesNotThrow(() => checkCapacity({ availableBytes: 3 * GiB, freePercent: 30 }, false));
  assert.doesNotThrow(() => checkCapacity({ availableBytes: 6 * GiB, freePercent: null }));
});
test("another process cannot acquire a held lock; release permits reuse", () => {
  const parent = mkdtempSync(join(tmpdir(), "accelerate-resource-test-"));
  const directory = join(parent, "lock");
  try {
    const release = acquireLock(directory);
    const attempt = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { acquireLock } from ${JSON.stringify(new URL("./resource-run.mjs", import.meta.url).href)}; acquireLock(${JSON.stringify(directory)});`,
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(attempt.status, 0);
    assert.match(attempt.stderr, /Another heavy job/);
    release();
    acquireLock(directory)();
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("memory accounting includes only the owned process group", () => {
  assert.equal(groupRss(" 123 100\n 123 200\n 999 999999", 123), 300 * 1024);
});

test("real command exit, spawn error and capacity refusal release the lock", async () => {
  const parent = mkdtempSync(join(tmpdir(), "accelerate-resource-lifecycle-"));
  const options = {
    directory: join(parent, "lock"),
    readCapacity: () => ({ availableBytes: 6 * GiB, freePercent: 50 }),
  };
  try {
    assert.equal(await runHeavyJob(process.execPath, ["-e", "process.exit(7)"], options), 7);
    acquireLock(options.directory)();
    await assert.rejects(runHeavyJob(join(parent, "missing-command"), [], options), /ENOENT/);
    acquireLock(options.directory)();
    await assert.rejects(
      runHeavyJob(process.execPath, ["-e", "process.exit(0)"], {
        ...options,
        readCapacity: () => ({ availableBytes: GiB, freePercent: 50 }),
      }),
      /disk/,
    );
    acquireLock(options.directory)();
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("capacity loss stops a running child and returns failure", { timeout: 5000 }, async () => {
  const parent = mkdtempSync(join(tmpdir(), "accelerate-resource-stop-"));
  let reads = 0;
  const options = {
    directory: join(parent, "lock"),
    monitorInterval: 25,
    readCapacity: () => ({ availableBytes: 6 * GiB, freePercent: reads++ === 0 ? 50 : 10 }),
  };
  try {
    assert.equal(
      await runHeavyJob(process.execPath, ["-e", "setInterval(() => {}, 1000)"], options),
      1,
    );
    acquireLock(options.directory)();
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

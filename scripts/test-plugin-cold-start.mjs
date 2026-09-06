/** Every sample uses a new Node process. No warmup, retry or discarded outlier. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  assert.ok(args[index + 1] && !args[index + 1].startsWith("--"), `${name} needs a value`);
  return args[index + 1];
}
const baselineRef = option("--baseline-ref");
if (baselineRef) assert.match(baselineRef, /^[a-f0-9]{40}$/);
const output = option("--output");
const fixture = mkdtempSync(join(tmpdir(), "accelerate-cold-start-"));
const child = `
const assert = require("node:assert/strict");
(async () => {
  const importStarted = performance.now();
  const { evaluateInIsolate } = require(process.argv[1]);
  const importMs = performance.now() - importStarted;
  const start = performance.now();
  const first = await evaluateInIsolate("40 + 2");
  const firstEvaluationMs = performance.now() - start;
  assert.equal(first.value, 42);
  const freshContextsMs = [];
  for (let i = 0; i < 5; i++) {
    const started = performance.now();
    const result = await evaluateInIsolate("40 + 2");
    assert.equal(result.value, 42);
    freshContextsMs.push(performance.now() - started);
  }
  process.stdout.write(JSON.stringify({ importMs, firstEvaluationMs, freshContextsMs }));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
const results = {
  node: process.version,
  platform: platform(),
  osRelease: release(),
  logicalCpus: cpus().length,
  arch: arch(),
  cpu: cpus()[0]?.model,
  baselineRef,
  samples: [],
};
try {
  symlinkSync(realpathSync(join(root, "node_modules")), join(fixture, "node_modules"));
  const candidates = [["candidate", join(root, "src/lib/revenue-os/plugin-isolate.ts")]];
  if (baselineRef) {
    const baseline = join(fixture, "baseline.ts");
    writeFileSync(
      baseline,
      execFileSync("git", ["show", `${baselineRef}:src/lib/revenue-os/plugin-isolate.ts`], {
        cwd: root,
      }),
    );
    candidates.unshift(["baseline", baseline]);
  }
  // Alternate order to reduce systematic filesystem/CPU ordering bias. The OS
  // page cache is uncontrolled; engine/module/context state is fresh each time.
  for (let index = 0; index < 5; index++) {
    for (const [kind, path] of index % 2 ? [...candidates].reverse() : candidates) {
      const started = performance.now();
      const run = spawnSync(
        process.execPath,
        ["--conditions=react-server", "--import", "tsx", "-e", child, path],
        { cwd: root, encoding: "utf8", timeout: 30000 },
      );
      const sample = {
        index,
        kind,
        processWallMs: performance.now() - started,
        status: run.status,
      };
      if (run.status === 0) Object.assign(sample, JSON.parse(run.stdout));
      else
        sample.error = (run.stderr || run.error?.message || "Child did not complete").slice(
          0,
          2000,
        );
      results.samples.push(sample);
    }
  }
  for (const [kind] of candidates) {
    const samples = results.samples.filter((sample) => sample.kind === kind && sample.status === 0);
    const times = samples.map((sample) => sample.firstEvaluationMs).sort((a, b) => a - b);
    results[kind] = { completed: times.length, medianMs: times[2], maxMs: times.at(-1) };
  }
  const json = JSON.stringify(results, null, 2);
  if (output) writeFileSync(output, json + "\n");
  console.log(json);
  assert.ok(
    results.samples.every((sample) => sample.status === 0),
    "Every cold process must complete; failed samples are retained",
  );
  assert.equal(results.candidate.completed, 5);
  assert.ok(
    results.candidate.maxMs < 50,
    `All five cold evaluations must stay under 50ms; slowest ${results.candidate.maxMs}ms`,
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

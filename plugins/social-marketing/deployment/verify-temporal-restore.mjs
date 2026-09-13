// A workflow on an unserved fixture queue cannot execute provider activities.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase));
const baselinePath = "private-temporal-history.json";
function temporal(args) {
  try {
    return execFileSync(
      "docker",
      [
        "compose",
        "-f",
        "compose.yaml",
        "-f",
        "verification.override.yaml",
        "exec",
        "-T",
        "temporal",
        "temporal",
        ...args,
        "--address",
        "temporal:7233",
        "--namespace",
        "default",
        "--output",
        "json",
      ],
      {
        encoding: "utf8",
        timeout: 15000,
        maxBuffer: 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const detail = String(error.stderr || "")
      .replace(/[A-Za-z0-9_-]{24,}/g, "<redacted>")
      .slice(0, 700);
    throw new Error(
      `Temporal fixture operation failed: ${detail || "inspect sanitized service diagnostics"}`,
    );
  }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
async function history(id) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = JSON.parse(temporal(["workflow", "show", "--workflow-id", id]));
      assert.ok(
        Array.isArray(result.events) && result.events.length >= 2,
        "Fixture must have retained start and scheduled-task events",
      );
      return {
        hash: createHash("sha256")
          .update(JSON.stringify(canonical(result)))
          .digest("hex"),
        events: result.events.length,
      };
    } catch (error) {
      if (attempt === 5) throw error;
      await setTimeout(1000);
    }
  }
}
if (phase === "before") {
  const id = `accelerate-restore-fixture-${randomUUID()}`;
  temporal([
    "workflow",
    "start",
    "--workflow-id",
    id,
    "--type",
    "AccelerateRestoreFixture",
    "--task-queue",
    id,
    "--execution-timeout",
    "1h",
  ]);
  writeFileSync(baselinePath, JSON.stringify({ id, ...(await history(id)) }), { mode: 0o600 });
  console.log("Harmless Temporal fixture history recorded on an unserved task queue");
} else {
  const before = JSON.parse(readFileSync(baselinePath, "utf8"));
  const after = await history(before.id);
  assert.equal(after.hash, before.hash, "Restored Temporal event history must match exactly");
  assert.equal(after.events, before.events);
  writeFileSync(
    "evidence/temporal-restore.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        historyMatches: true,
        events: after.events,
        historySha256: after.hash,
        databases: ["temporal", "temporal_visibility"],
        fixtureQueueHasWorkers: false,
        realPublication: false,
      },
      null,
      2,
    ),
  );
  console.log("Temporal database and visibility restore preserved exact fixture event history");
}

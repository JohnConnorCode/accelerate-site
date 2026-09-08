import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAgentConfiguration } from "./lib/agent-profile.mjs";
const base = mkdtempSync(join(tmpdir(), "accelerate-profile-"));
try {
  const common = join(base, "common");
  const root = join(base, "worker");
  mkdirSync(common);
  mkdirSync(root);
  const envFile = join(base, "private.env");
  writeFileSync(envFile, "FIXTURE=private\n");
  const operator = { version: 1, transport: "local-operator", project: "accelerate", envFile };
  writeFileSync(join(common, "work-board-operator.json"), JSON.stringify(operator));
  const loaded = [];
  assert.deepEqual(
    loadAgentConfiguration({ root, common }, {}, (file) => loaded.push(file)),
    operator,
  );
  assert.deepEqual(loaded, [envFile]);
  const second = join(base, "another-worker");
  mkdirSync(second);
  assert.deepEqual(
    loadAgentConfiguration({ root: second, common }, {}, () => {}),
    operator,
    "worktrees share configuration",
  );
  assert.equal(
    loadAgentConfiguration({ root, common }, { ACCELERATE_AGENT_NO_PROFILE: "1" }, () => {
      throw new Error("unexpected load");
    }),
    null,
  );
  const remote = { version: 1, transport: "https", envFile };
  writeFileSync(join(common, "work-board-agent.json"), JSON.stringify(remote));
  assert.deepEqual(
    loadAgentConfiguration({ root, common }, {}, () => {}),
    remote,
    "explicit worker profile takes precedence",
  );
  writeFileSync(join(common, "work-board-agent.json"), "not-json-private-marker");
  assert.throws(
    () => loadAgentConfiguration({ root, common }, {}, () => {}),
    (error) => !error.message.includes("private-marker") && /not valid JSON/.test(error.message),
  );
  writeFileSync(
    join(common, "work-board-agent.json"),
    JSON.stringify({ ...operator, project: "*" }),
  );
  assert.throws(() => loadAgentConfiguration({ root, common }, {}, () => {}), /unsupported shape/);
  writeFileSync(
    join(common, "work-board-agent.json"),
    JSON.stringify({ ...remote, envFile: join(base, "missing") }),
  );
  assert.throws(
    () => loadAgentConfiguration({ root, common }, {}, () => {}),
    /missing environment file/,
  );
  console.log(
    "PASS: shared worktree profiles, worker precedence, explicit isolation, named project and private diagnostics.",
  );
} finally {
  rmSync(base, { recursive: true, force: true });
}

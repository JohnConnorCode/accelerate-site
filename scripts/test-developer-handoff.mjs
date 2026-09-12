import { realpathSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  prepareWorkspace,
  createWorkspace,
  repositoryContext,
  boardEndpoint,
  requestBoard,
  requireBoardProtocol,
} from "./lib/developer-workspace.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const git = (cwd, args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "accelerate-developer-test-"));
  const source = join(dir, "source"),
    remote = join(dir, "remote.git"),
    clone = join(dir, "clone");
  mkdirSync(source);
  git(source, ["init", "-b", "approved"]);
  writeFileSync(join(source, "README.md"), "Controlled developer fixture\n");
  git(source, ["add", "README.md"]);
  git(source, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "Fixture",
  ]);
  const baseCommit = git(source, ["rev-parse", "HEAD"]);
  git(dir, ["clone", "--bare", source, remote]);
  git(dir, ["clone", pathToFileURL(remote).href, clone]);
  return {
    dir,
    source,
    remote,
    clone,
    card: {
      id: randomUUID(),
      seed_key: "fixture-ticket",
      title: "Controlled ticket",
      status: "planned",
      revision: 1,
      labels: ["milestone:now"],
      readiness: [],
      dependencies: [],
      work_spec: {
        repository: { url: pathToFileURL(remote).href, baseBranch: "approved", baseCommit },
      },
    },
  };
}
async function cli(cwd, args, env) {
  // Use the repository's installed TypeScript runner, independent of the target checkout.
  const executable = join(root, "node_modules/.bin/tsx");
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, [join(root, "scripts/agent-dispatch.ts"), ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolveResult({ code, stdout, stderr }));
  });
}

test("fresh clone fetches a published base and uses one safe worktree path from every checkout", () => {
  const f = fixture();
  try {
    git(f.source, ["checkout", "-b", "next-base"]);
    writeFileSync(join(f.source, "next.txt"), "next\n");
    git(f.source, ["add", "next.txt"]);
    git(f.source, [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Next",
    ]);
    git(f.source, ["push", f.remote, "next-base"]);
    f.card.work_spec.repository.baseBranch = "next-base";
    f.card.work_spec.repository.baseCommit = git(f.source, ["rev-parse", "HEAD"]);
    assert.throws(() => prepareWorkspace(f.clone, f.card), /unavailable/);
    const plan = prepareWorkspace(f.clone, f.card, { fetchBase: true });
    assert.equal(plan.mode, "create");
    const path = createWorkspace(plan);
    assert.equal(git(path, ["rev-parse", "HEAD"]), f.card.work_spec.repository.baseCommit);
    assert.equal(prepareWorkspace(path, f.card).path, path);
    assert.equal(repositoryContext(path).sessions, repositoryContext(f.clone).sessions);
    writeFileSync(join(path, "unfinished.txt"), "preserve");
    assert.throws(() => prepareWorkspace(f.clone, f.card), /uncommitted/);
    assert.equal(readFileSync(join(path, "unfinished.txt"), "utf8"), "preserve");
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("wrong repository, unpublished base, unsafe key and occupied path fail before preparation", () => {
  const f = fixture();
  try {
    const wrong = structuredClone(f.card);
    wrong.work_spec.repository.url = "https://example.test/wrong.git";
    assert.throws(() => prepareWorkspace(f.clone, wrong), /does not match/);
    const absent = structuredClone(f.card);
    absent.work_spec.repository.baseCommit = "b".repeat(40);
    assert.throws(() => prepareWorkspace(f.clone, absent), /unavailable/);
    assert.throws(
      () => prepareWorkspace(f.clone, { ...f.card, seed_key: "../../escape" }),
      /safely/,
    );
    const plan = prepareWorkspace(f.clone, f.card);
    mkdirSync(plan.path, { recursive: true });
    writeFileSync(join(plan.path, "other"), "owned");
    assert.throws(() => prepareWorkspace(f.clone, f.card), /occupied/);
    assert.equal(readFileSync(join(plan.path, "other"), "utf8"), "owned");
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("CLI refuses missing bases before POST, claims with revision, returns pure JSON and replays the original request", async () => {
  const f = fixture();
  let posts = 0;
  const bodies = [];
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET")
      return res.end(
        JSON.stringify({
          protocolVersion: 2,
          schemaReady: true,
          features: [f.card],
          nextOffset: null,
        }),
      );
    posts++;
    let text = "";
    for await (const chunk of req) text += chunk;
    bodies.push(JSON.parse(text));
    res.end(
      JSON.stringify({
        card: { ...f.card, status: "in_progress", revision: 2 },
        replayed: posts > 1,
      }),
    );
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const env = {
    WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
    WORK_BOARD_TOKEN: "fixture-private-token",
  };
  try {
    const base = f.card.work_spec.repository.baseCommit;
    f.card.work_spec.repository.baseCommit = "b".repeat(40);
    let result = await cli(f.clone, ["next", "--json"], env);
    assert.equal(result.code, 1);
    assert.equal(posts, 0);
    assert.match(result.stderr, /unavailable/);
    f.card.work_spec.repository.baseCommit = base;
    const requestKey = randomUUID();
    result = await cli(f.clone, ["next", "--json", "--request-key", requestKey], env);
    assert.equal(result.code, 0, result.stderr);
    const packet = JSON.parse(result.stdout);
    assert.equal(packet.schemaVersion, 2);
    assert.equal(packet.controlCheckout, realpathSync(f.clone));
    assert.equal(packet.id, f.card.id);
    assert.ok(existsSync(packet.worktree));
    assert.equal(bodies[0].revision, 1);
    assert.equal(bodies[0].id, f.card.id);
    const claimToken = bodies[0].payload.claimToken;
    assert.ok(!result.stdout.includes(claimToken) && !result.stderr.includes(claimToken));
    assert.ok(
      !result.stdout.includes(env.WORK_BOARD_TOKEN) &&
        !result.stderr.includes(env.WORK_BOARD_TOKEN),
    );
    f.card.revision = 99;
    f.card.status = "in_progress";
    f.card.readiness = ["already_claimed"];
    result = await cli(f.clone, ["next", "--json", "--request-key", requestKey], env);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(bodies[1], bodies[0]);
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("protocol, endpoint and error handling refuse legacy, redirects and credential leakage", async () => {
  assert.throws(() => boardEndpoint({}), /WORK_BOARD_URL/);
  assert.throws(() => boardEndpoint({ WORK_BOARD_URL: "http://remote.example" }), /HTTPS/);
  assert.throws(
    () => boardEndpoint({ WORK_BOARD_URL: "https://user:secret@remote.example" }),
    /HTTPS/,
  );
  assert.throws(() => requireBoardProtocol({ features: [], schemaReady: true }), /protocol v2/);
  const server = createServer((req, res) => {
    res.statusCode = 404;
    res.end("<html>fixture-private-token old app</html>");
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  try {
    await assert.rejects(
      requestBoard(new URL(`http://127.0.0.1:${server.address().port}`), "fixture-private-token"),
      (error) =>
        !error.message.includes("fixture-private-token") && /old application/.test(error.message),
    );
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
  }
});

test("doctor proves shared protocol, operation scopes and enforcement without making writes", async () => {
  let strictWrites = false,
    posts = 0;
  const server = createServer((req, res) => {
    if (req.method !== "GET") posts++;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        protocolVersion: 2,
        schemaReady: true,
        features: [],
        nextOffset: null,
        strictWrites,
        access: {
          scopes: ["read", "claim", "heartbeat", "progress", "release", "block", "submit"],
        },
      }),
    );
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  async function doctor() {
    return new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ["scripts/developer-doctor.mjs", "--board", "--json"], {
        cwd: root,
        env: {
          ...process.env,
          ACCELERATE_AGENT_NO_PROFILE: "1",
          WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
          WORK_BOARD_TOKEN: "doctor-private-token",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("close", (code) => resolveResult({ code, stdout, stderr }));
    });
  }
  try {
    let result = await doctor();
    assert.equal(result.code, 1, result.stderr);
    assert.equal(
      JSON.parse(result.stdout).checks.find((c) => c.id === "shared-write-enforcement").status,
      "blocked",
    );
    strictWrites = true;
    result = await doctor();
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).ready, true);
    assert.equal(posts, 0);
    assert.ok(!result.stdout.includes("doctor-private-token"));
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
  }
});

test("developer completes claim, progress, release, resume and evidence submission from a clean clone", async () => {
  const f = fixture();
  const receipt = [];
  let token, worktree, attemptId;
  f.card.work_spec.acceptance = [
    { id: "AC1", criterion: "Explain the fixture task", environment: "local" },
  ];
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer lifecycle-worker") {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    if (req.method === "GET") {
      res.end(
        JSON.stringify({
          protocolVersion: 2,
          schemaReady: true,
          features: [f.card],
          nextOffset: null,
        }),
      );
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (body.id !== f.card.id || body.revision !== f.card.revision) {
      res.statusCode = 409;
      res.end(JSON.stringify({ error: "Stale card" }));
      return;
    }
    if (body.operation === "claim") {
      if (f.card.status !== "planned") {
        res.statusCode = 409;
        res.end("{}");
        return;
      }
      token = body.payload.claimToken;
      f.card.status = "in_progress";
    } else {
      if (body.payload.claimToken !== token || f.card.status !== "in_progress") {
        res.statusCode = 403;
        res.end("{}");
        return;
      }
      if (body.operation === "release") f.card.status = "planned";
      if (body.operation === "submit") {
        const evidence = body.payload.evidence;
        if (
          evidence.commitSha !== git(worktree, ["rev-parse", "HEAD"]) ||
          evidence.checks[0].acceptanceId !== "AC1" ||
          evidence.checks[0].environment !== "local"
        ) {
          res.statusCode = 400;
          res.end("{}");
          return;
        }
        f.card.status = "in_review";
      }
    }
    f.card.revision++;
    receipt.push({ operation: body.operation, revision: f.card.revision });
    res.end(JSON.stringify({ card: f.card }));
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const env = {
    WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
    WORK_BOARD_TOKEN: "lifecycle-worker",
  };
  async function command(args) {
    const result = await cli(
      f.clone,
      args[0] === "next" || !attemptId ? args : [...args, "--attempt", attemptId],
      env,
    );
    assert.equal(result.code, 0, result.stderr);
    assert.ok(!result.stdout.includes("lifecycle-worker"));
    if (token) assert.ok(!result.stdout.includes(token));
    return JSON.parse(result.stdout);
  }
  try {
    const packet = await command(["next", "--card", f.card.seed_key, "--json"]);
    worktree = packet.worktree;
    attemptId = packet.attemptId;
    await command(["heartbeat", "--card", f.card.seed_key]);
    await command(["progress", "--card", f.card.seed_key, "--message", "Inspecting the fixture"]);
    await command(["release", "--card", f.card.seed_key]);
    assert.ok(existsSync(worktree), "release preserves the checkout");
    const resumed = await command(["next", "--card", f.card.seed_key, "--json"]);
    assert.equal(resumed.worktree, worktree);
    attemptId = resumed.attemptId;
    writeFileSync(
      join(worktree, "README.md"),
      "Open the fixture, inspect the instructions, and record the result.\n",
    );
    git(worktree, ["add", "README.md"]);
    git(worktree, [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Explain the fixture task",
    ]);
    const evidence = join(f.dir, "evidence.json");
    writeFileSync(
      evidence,
      JSON.stringify({
        summary: "The controlled fixture instructions were updated and checked.",
        commitSha: git(worktree, ["rev-parse", "HEAD"]),
        checks: [
          {
            acceptanceId: "AC1",
            environment: "local",
            name: "Inspect fixture instructions",
            status: "passed",
            evidence: "README describes the fixture task.",
          },
        ],
      }),
    );
    await command(["complete", "--card", f.card.seed_key, "--evidence-file", evidence]);
    assert.equal(f.card.status, "in_review", "submission must not mark work shipped");
    assert.ok(existsSync(worktree), "submission preserves the implementation for review");
    assert.equal(git(worktree, ["status", "--porcelain"]), "");
    assert.deepEqual(
      receipt.map((r) => r.operation),
      ["claim", "heartbeat", "progress", "release", "claim", "submit"],
    );
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test("credit exhaustion resumes isolated source; predecessor CLI stays fenced and takeover retry reuses receipt", async () => {
  const f = fixture();
  f.card.project_key = "fixture";
  const attempts = new Map(),
    receipts = new Map();
  let token,
    posts = 0;
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      const expired = Date.parse(f.card.lease_expires_at ?? "") <= Date.now();
      f.card.readiness = f.card.status === "in_progress" ? ["status:in_progress"] : [];
      f.card.resume_readiness =
        expired && f.card.work_checkpoint ? [] : ["resume_requires_expired_lease"];
      res.end(
        JSON.stringify({
          protocolVersion: 2,
          schemaReady: true,
          features: [f.card],
          nextOffset: null,
          resumableAttempts: { version: 1, automaticRecoveryProjects: ["fixture"] },
        }),
      );
      return;
    }
    let raw = "";
    for await (const part of req) raw += part;
    const body = JSON.parse(raw);
    posts++;
    const previous = receipts.get(body.requestKey);
    if (previous) {
      assert.equal(previous.raw, raw);
      res.end(previous.response);
      return;
    }
    if (body.operation === "claim" || body.operation === "resume") {
      if (body.operation === "resume") {
        assert(Date.parse(f.card.lease_expires_at) <= Date.now());
        assert.equal(body.payload.checkpointId, f.card.work_checkpoint.id);
      }
      token = body.payload.claimToken;
      f.card.work_attempt_id = randomUUID();
      attempts.set(f.card.work_attempt_id, token);
      f.card.status = "in_progress";
    } else if (body.payload.claimToken !== token) {
      res.statusCode = 403;
      res.end("{}");
      return;
    }
    if (body.operation === "checkpoint") {
      assert(body.payload.checkpoint.branch.includes(f.card.work_attempt_id));
      f.card.work_checkpoint = {
        ...body.payload.checkpoint,
        id: randomUUID(),
        attemptId: f.card.work_attempt_id,
      };
    }
    f.card.lease_expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
    f.card.revision++;
    const response = JSON.stringify({ card: f.card });
    receipts.set(body.requestKey, { raw, response });
    res.end(response);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const env = (session) => ({
    ACCELERATE_AGENT_NO_PROFILE: "1",
    ACCELERATE_AGENT_SESSION_ID: session,
    WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
    WORK_BOARD_TOKEN: "fixture-worker",
  });
  const run = async (cwd, args, session) => {
    const result = await cli(cwd, args, env(session));
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  try {
    const first = await run(f.clone, ["next", "--json"], "old");
    assert(f.card.work_checkpoint, "initial source is checkpointed without another user step");
    const legacyPath = join(repositoryContext(f.clone).sessions, `${f.card.id}.json`);
    const legacyToken = JSON.parse(readFileSync(legacyPath, "utf8")).claimToken;
    writeFileSync(join(first.worktree, "README.md"), "Interrupted tracked source\n");
    writeFileSync(join(first.worktree, "new.ts"), "export const kept = true;\n");
    const checkpointFile = join(f.dir, "checkpoint.json");
    writeFileSync(
      checkpointFile,
      JSON.stringify({
        summary: "Preserve interrupted implementation and new source",
        files: ["new.ts"],
        remaining: ["Verify task"],
      }),
    );
    await run(
      f.clone,
      [
        "checkpoint",
        "--card",
        f.card.seed_key,
        "--attempt",
        first.attemptId,
        "--checkpoint-file",
        checkpointFile,
      ],
      "old",
    );
    f.card.lease_expires_at = new Date(Date.now() - 1000).toISOString();
    const requestKey = randomUUID();
    const second = await run(f.clone, ["next", "--json", "--request-key", requestKey], "new");
    assert.notEqual(first.worktree, second.worktree);
    assert.equal(
      readFileSync(join(second.worktree, "README.md"), "utf8"),
      "Interrupted tracked source\n",
    );
    assert.equal(
      readFileSync(join(second.worktree, "new.ts"), "utf8"),
      "export const kept = true;\n",
    );
    assert.equal(
      JSON.parse(readFileSync(legacyPath, "utf8")).claimToken,
      legacyToken,
      "old binaries never receive the successor secret",
    );
    writeFileSync(join(first.worktree, "README.md"), "Late predecessor write\n");
    const before = posts;
    const old = await cli(first.worktree, ["heartbeat", "--card", f.card.seed_key], env("old"));
    assert.equal(old.code, 1);
    assert.match(old.stderr, /superseded/i);
    assert.equal(posts, before);
    assert.equal(
      readFileSync(join(second.worktree, "README.md"), "utf8"),
      "Interrupted tracked source\n",
    );
    const retried = await run(f.clone, ["next", "--json", "--request-key", requestKey], "new");
    assert.equal(retried.worktree, second.worktree);
    assert.equal(retried.attemptId, second.attemptId);
    assert.equal(attempts.size, 2);
    // Simulate an unadopted pre-migration pointer sorting before the current session.
    // It must not shadow the successor when both share the returning client identity.
    const staleLegacy = JSON.parse(readFileSync(legacyPath, "utf8"));
    delete staleLegacy.card.work_attempt_id;
    staleLegacy.clientSession = "new";
    writeFileSync(legacyPath, JSON.stringify(staleLegacy));
    const continuedWithoutExplicitAttempt = await run(f.clone, ["next", "--json"], "new");
    assert.equal(continuedWithoutExplicitAttempt.attemptId, second.attemptId);
    const continued = await run(f.clone, ["next", "--json", "--attempt", second.attemptId], "new");
    assert.equal(continued.worktree, second.worktree);
    await run(
      f.clone,
      [
        "progress",
        "--card",
        f.card.seed_key,
        "--attempt",
        second.attemptId,
        "--message",
        "Successor implementation checkpoint",
      ],
      "new",
    );
    const runBounded = (attemptId) =>
      new Promise((done, reject) => {
        const child = spawn(
          process.execPath,
          [
            join(root, "scripts/agent-run.mjs"),
            "--card",
            f.card.seed_key,
            "--attempt",
            attemptId,
            "--",
            process.execPath,
            "-e",
            "console.log(JSON.stringify({cwd:process.cwd(),source:require('node:fs').readFileSync('README.md','utf8')}))",
          ],
          {
            cwd: f.clone,
            env: { ...process.env, ...env("new") },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (data) => {
          stdout += data;
        });
        child.stderr.on("data", (data) => {
          stderr += data;
        });
        child.on("error", reject);
        child.on("close", (code) => done({ code, stdout, stderr }));
      });
    writeFileSync(join(second.worktree, "README.md"), "Source before long verification\n");
    const beforeRun = f.card.work_checkpoint.id;
    const job = await runBounded(second.attemptId);
    assert.equal(job.code, 0, job.stderr);
    assert.deepEqual(JSON.parse(job.stdout), {
      cwd: realpathSync(second.worktree),
      source: "Source before long verification\n",
    });
    assert.notEqual(
      f.card.work_checkpoint.id,
      beforeRun,
      "long job must checkpoint before starting",
    );
    assert.equal(
      git(f.clone, ["show", `${f.card.work_checkpoint.commitSha}:README.md`]),
      "Source before long verification",
    );
    const staleJob = await runBounded(first.attemptId);
    assert.equal(staleJob.code, 1);
    assert.equal(staleJob.stdout, "", "fenced attempt cannot start a verification job");
    const audit = await run(f.clone, ["audit", "--limit", "1"], "new");
    assert.equal(audit.pageCount, 1);
  } finally {
    await new Promise((done) => server.close(done));
    rmSync(f.dir, { recursive: true, force: true });
  }
});

async function legacyAdoptionFixture(lostOperation) {
  const f = fixture();
  git(f.clone, ["config", "user.name", "Fixture"]);
  git(f.clone, ["config", "user.email", "fixture@example.test"]);
  const oldAttempt = randomUUID(),
    assignedAttempt = randomUUID(),
    claimToken = "legacy-private-claim-token";
  f.card.status = "in_progress";
  f.card.readiness = ["status:in_progress"];
  f.card.lease_expires_at = new Date(Date.now() + 30 * 60_000).toISOString();
  const receipts = new Map();
  let lost = false,
    checkpoints = 0,
    activeToken = claimToken;
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET")
      return res.end(
        JSON.stringify({
          protocolVersion: 2,
          schemaReady: true,
          resumableAttempts: { version: 1, automaticRecoveryProjects: [] },
          features: [f.card],
          nextOffset: null,
        }),
      );
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    if (body.payload.claimToken !== activeToken) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: "Claim does not own this work" }));
    }
    if (receipts.has(body.requestKey))
      return res.end(JSON.stringify({ ...receipts.get(body.requestKey), replayed: true }));
    if (body.operation === "heartbeat") f.card.work_attempt_id ??= assignedAttempt;
    else if (body.operation === "checkpoint") {
      assert.equal(body.revision, f.card.revision);
      assert.ok(
        body.payload.checkpoint.branch.startsWith(
          `agent/checkpoints/${f.card.id}/${assignedAttempt}/`,
        ),
      );
      checkpoints++;
      f.card.work_checkpoint = {
        ...body.payload.checkpoint,
        id: randomUUID(),
        attemptId: assignedAttempt,
      };
    } else {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Unexpected operation" }));
    }
    f.card.revision++;
    const result = { card: structuredClone(f.card) };
    receipts.set(body.requestKey, result);
    if (!lost && body.operation === lostOperation) {
      lost = true;
      res.statusCode = 503;
      return res.end(JSON.stringify({ error: "Receipt saved but response lost" }));
    }
    res.end(JSON.stringify(result));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const env = {
    WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
    WORK_BOARD_TOKEN: "legacy-worker",
    ACCELERATE_AGENT_SESSION_ID: randomUUID(),
    ACCELERATE_AGENT_NO_PROFILE: "1",
  };
  const sessions = repositoryContext(f.clone).sessions;
  mkdirSync(sessions, { recursive: true, mode: 0o700 });
  const initial = {
    endpoint: String(boardEndpoint(env)),
    card: structuredClone(f.card),
    claimToken,
    requestKey: oldAttempt,
    attemptId: oldAttempt,
    worktree: realpathSync(f.clone),
    clientSession: env.ACCELERATE_AGENT_SESSION_ID,
  };
  const alias = join(sessions, `attempt-${oldAttempt}.json`);
  writeFileSync(alias, JSON.stringify(initial), { mode: 0o600 });
  writeFileSync(join(sessions, `${f.card.id}.json`), JSON.stringify(initial), { mode: 0o600 });
  return {
    f,
    env,
    alias,
    sessions,
    oldAttempt,
    assignedAttempt,
    claimToken,
    initial,
    checkpoints: () => checkpoints,
    supersede() {
      f.card.work_attempt_id = randomUUID();
      activeToken = "successor-token";
    },
    async close() {
      await new Promise((done) => server.close(done));
      rmSync(f.dir, { recursive: true, force: true });
    },
  };
}

test("continuing a legacy claim persists adoption before emitting its attempt packet", async () => {
  for (const lostOperation of [undefined, "heartbeat"]) {
    const x = await legacyAdoptionFixture(lostOperation);
    try {
      if (lostOperation) {
        const lost = await cli(x.f.clone, ["next", "--json", "--attempt", x.oldAttempt], x.env);
        assert.equal(lost.code, 1);
      }
      const continued = await cli(x.f.clone, ["next", "--json", "--attempt", x.oldAttempt], x.env);
      assert.equal(continued.code, 0, continued.stderr);
      const packet = JSON.parse(continued.stdout);
      assert.equal(packet.attemptId, x.assignedAttempt);
      const saved = JSON.parse(
        readFileSync(join(x.sessions, `attempt-${packet.attemptId}.json`), "utf8"),
      );
      assert.equal(saved.claimToken, x.claimToken);
      assert.equal(saved.card.work_attempt_id, packet.attemptId);
      const renewed = await cli(
        x.f.clone,
        ["heartbeat", "--card", x.f.card.seed_key, "--attempt", packet.attemptId],
        x.env,
      );
      assert.equal(renewed.code, 0, renewed.stderr);
      assert.ok(!continued.stdout.includes(x.claimToken));
    } finally {
      await x.close();
    }
  }
});

test("legacy checkpoint retries survive lost adoption or checkpoint responses without adopting a successor", async () => {
  for (const lostOperation of ["heartbeat", "checkpoint"]) {
    const x = await legacyAdoptionFixture(lostOperation);
    try {
      const input = join(x.f.dir, "checkpoint.json");
      writeFileSync(
        input,
        JSON.stringify({
          summary: "Preserve legacy source before verification",
          remaining: ["Verification remains"],
        }),
      );
      const args = [
        "checkpoint",
        "--card",
        x.f.card.seed_key,
        "--attempt",
        x.oldAttempt,
        "--request-key",
        randomUUID(),
        "--checkpoint-file",
        input,
      ];
      const lost = await cli(x.f.clone, args, x.env);
      assert.equal(lost.code, 1);
      const retry = await cli(x.f.clone, args, x.env);
      assert.equal(retry.code, 0, retry.stderr);
      assert.equal(x.checkpoints(), 1);
      const alias = JSON.parse(readFileSync(x.alias, "utf8"));
      assert.equal(alias.attemptId, x.assignedAttempt);
      assert.equal(alias.card.work_attempt_id, x.assignedAttempt);
      assert.equal(alias.claimToken, x.claimToken);
      assert.ok(existsSync(join(x.sessions, `attempt-${x.assignedAttempt}.json`)));
      x.supersede();
      writeFileSync(x.alias, JSON.stringify(x.initial), { mode: 0o600 });
      const denied = await cli(
        x.f.clone,
        ["heartbeat", "--card", x.f.card.seed_key, "--attempt", x.oldAttempt],
        x.env,
      );
      assert.equal(denied.code, 1);
      assert.equal(
        JSON.parse(readFileSync(x.alias, "utf8")).attemptId,
        x.oldAttempt,
        "failed token validation must not adopt successor identity",
      );
    } finally {
      await x.close();
    }
  }
});

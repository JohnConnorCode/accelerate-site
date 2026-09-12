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
  isExpiredWorkClaim,
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
    const resumed = prepareWorkspace(f.clone, f.card, { preserveRetainedChanges: true });
    assert.equal(resumed.mode, "reuse");
    assert.equal(resumed.path, path);
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
          WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
          WORK_BOARD_TOKEN: "doctor-private-token",
          ACCELERATE_AGENT_NO_PROFILE: "1",
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
  let token, worktree;
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
    const result = await cli(f.clone, args, env);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(!result.stdout.includes("lifecycle-worker"));
    if (token) assert.ok(!result.stdout.includes(token));
    return JSON.parse(result.stdout);
  }
  try {
    const packet = await command(["next", "--card", f.card.seed_key, "--json"]);
    worktree = packet.worktree;
    await command(["heartbeat", "--card", f.card.seed_key]);
    await command(["progress", "--card", f.card.seed_key, "--message", "Inspecting the fixture"]);
    await command(["release", "--card", f.card.seed_key]);
    assert.ok(existsSync(worktree), "release preserves the checkout");
    const resumed = await command(["next", "--card", f.card.seed_key, "--json"]);
    assert.equal(resumed.worktree, worktree);
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

test("expired continuation never treats live, missing or malformed leases as expired", () => {
  const now = Date.parse("2026-09-12T16:00:00Z");
  assert.equal(
    isExpiredWorkClaim({ status: "in_progress", lease_expires_at: "2026-09-12T15:59:00Z" }, now),
    true,
  );
  assert.equal(
    isExpiredWorkClaim({ status: "in_progress", lease_expires_at: "2026-09-12T16:01:00Z" }, now),
    false,
  );
  assert.equal(isExpiredWorkClaim({ status: "in_progress", lease_expires_at: null }, now), false);
  assert.equal(
    isExpiredWorkClaim({ status: "in_progress", lease_expires_at: "invalid" }, now),
    false,
  );
  assert.equal(
    isExpiredWorkClaim({ status: "in_review", lease_expires_at: "2026-09-12T15:59:00Z" }, now),
    false,
  );
});

test("explicit expired pickup preserves dirty retained work while automatic pickup skips it", async () => {
  const f = fixture();
  const path = createWorkspace(prepareWorkspace(f.clone, f.card));
  writeFileSync(join(path, "unfinished.txt"), "retained implementation");
  f.card.status = "in_progress";
  f.card.revision = 5;
  f.card.lease_expires_at = "2000-01-01T00:00:00Z";
  f.card.readiness = ["status:in_progress"];
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
    let body = "";
    for await (const chunk of req) body += chunk;
    bodies.push(JSON.parse(body));
    res.end(
      JSON.stringify({
        card: { ...f.card, revision: 6, lease_expires_at: "2099-01-01T00:00:00Z" },
        replayed: false,
      }),
    );
  });
  await new Promise((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const env = {
    WORK_BOARD_URL: `http://127.0.0.1:${server.address().port}`,
    WORK_BOARD_TOKEN: "fixture-token",
    ACCELERATE_AGENT_NO_PROFILE: "1",
  };
  try {
    const auto = await cli(f.clone, ["next", "--json"], env);
    assert.equal(auto.code, 1);
    assert.equal(bodies.length, 0);
    const explicit = await cli(f.clone, ["next", "--card", f.card.seed_key, "--json"], env);
    assert.equal(explicit.code, 0, explicit.stderr);
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].revision, 5);
    assert.equal(JSON.parse(explicit.stdout).worktree, path);
    assert.equal(readFileSync(join(path, "unfinished.txt"), "utf8"), "retained implementation");
  } finally {
    await new Promise((resolveClosed) => server.close(resolveClosed));
    rmSync(f.dir, { recursive: true, force: true });
  }
});

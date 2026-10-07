#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  symlinkSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const entrypoints = spawnSync("npx", ["tsx", "scripts/agent-go.ts", "--json"], {
  cwd: root,
  env: {
    ...process.env,
    ACCELERATE_AGENT_NO_PROFILE: "1",
    WORK_BOARD_URL: "",
    WORK_BOARD_TOKEN: "",
  },
  encoding: "utf8",
  timeout: 60_000,
});
assert.notEqual(entrypoints.status, 0);
const diagnostic = JSON.parse(entrypoints.stdout);
assert.equal(diagnostic.status, "SETUP_REQUIRED");
assert.match(diagnostic.message, /no card was claimed/i);
assert(!entrypoints.stdout.includes("secret"));
assert(!entrypoints.stdout.includes("?"));
assert(!entrypoints.stdout.match(/paste credentials|work unclaimed|prepare only/i));
assert.match(readFileSync(resolve(root, "AGENTS.md"), "utf8"), /agent:go/);
assert.match(readFileSync(resolve(root, "AGENTS.md"), "utf8"), /Never ask the user to paste/i);
assert.match(
  readFileSync(resolve(root, "docs/contributing/NATURAL-LANGUAGE-AGENT.md"), "utf8"),
  /Never ask the user to paste/i,
);
assert(existsSync(resolve(root, "scripts/verify-agent-entrypoints.mjs")));
console.log("Natural-language runner setup diagnostics and entrypoint contract passed");

async function checkRepositoryDiagnosis() {
  let posts = 0;
  let readiness: string[] = [];
  let repository = {
    url: "https://user:fixture-secret@example.test/repo",
    baseBranch: "main",
    baseCommit: "a".repeat(40),
  };
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.method !== "GET") {
      posts++;
      response.statusCode = 500;
      return response.end(JSON.stringify({ error: "Unexpected claim" }));
    }
    response.end(
      JSON.stringify({
        protocolVersion: 2,
        schemaReady: true,
        nextOffset: null,
        features: [
          {
            id: randomUUID(),
            seed_key: "invalid-repository-fixture",
            title: "Controlled repository fixture",
            status: "planned",
            revision: 1,
            labels: ["milestone:now"],
            readiness,
            work_spec: {
              repository,
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing controlled server");
    const run = promisify(execFile);
    for (const canonical of [false, true]) {
      readiness = canonical ? ["invalid_repository_url"] : [];
      let output = "";
      try {
        await run(resolve(root, "node_modules/.bin/tsx"), ["scripts/agent-go.ts", "--json"], {
          cwd: root,
          timeout: 60_000,
          env: {
            ...process.env,
            ACCELERATE_AGENT_NO_PROFILE: "1",
            WORK_BOARD_URL: `http://127.0.0.1:${address.port}`,
            WORK_BOARD_TOKEN: "fixture-worker-token",
          },
        });
        assert.fail("Unusable repository must refuse pickup");
      } catch (error) {
        const refusal = error as { code?: number; stdout?: string; stderr?: string };
        assert.equal(refusal.code, 1);
        output = refusal.stdout!;
        assert.ok(!`${output}${refusal.stderr}`.includes("fixture-secret"));
        assert.ok(!`${output}${refusal.stderr}`.includes("fixture-worker-token"));
      }
      const result = JSON.parse(output);
      assert.equal(result.status, canonical ? "NO_READY_WORK" : "PREFLIGHT_BLOCKED");
      assert.match(result.message, /invalid-repository-fixture/);
      assert.match(result.next, /revision-checked edit/);
      assert.ok(
        !result.next.includes("agent:setup"),
        "repository repair must not be mistaken for missing credentials",
      );
      assert.equal(posts, 0);
    }
    console.log(
      "Repository diagnosis identifies legacy and canonical blocked cards safely; no claims or credential setup prompts.",
    );
    // Intercept only fetch in child processes; all inspections use native Git.
    // The fixture owns its refs and links only tracked source, never private profiles.
    const fixture = mkdtempSync(join(tmpdir(), "accelerate-source-diagnosis-"));
    const bin = join(fixture, "bin");
    const clone = join(fixture, "clone");
    try {
      mkdirSync(bin);
      mkdirSync(clone);
      const nativeGit = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
      assert.ok(nativeGit);
      const inspect = (...args: string[]) => {
        const result = spawnSync(nativeGit, args, { cwd: clone, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      };
      const tracked = spawnSync(nativeGit, ["ls-tree", "--name-only", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(tracked.status, 0);
      for (const path of [...tracked.stdout.trim().split("\n"), "node_modules"])
        symlinkSync(resolve(root, path), join(clone, path));
      inspect("init", "-b", "approved");
      inspect("config", "user.name", "Fixture");
      inspect("config", "user.email", "fixture@example.test");
      writeFileSync(join(clone, "fixture.txt"), "approved\n");
      inspect("add", "fixture.txt");
      inspect("-c", "core.hooksPath=/dev/null", "commit", "-m", "Approved fixture");
      inspect("checkout", "-b", "candidate");
      writeFileSync(join(clone, "fixture.txt"), "candidate\n");
      inspect("add", "fixture.txt");
      inspect("-c", "core.hooksPath=/dev/null", "commit", "-m", "Candidate fixture");
      inspect("remote", "add", "origin", pathToFileURL(clone).href);
      const beforeRefs = inspect("show-ref");
      const beforeStatus = inspect("status", "--porcelain");
      writeFileSync(
        join(bin, "git"),
        `#!/usr/bin/env node\nconst {spawnSync}=require('node:child_process');\nconst args=process.argv.slice(2);\nif(args[0]==='fetch'){process.stderr.write('fixture-fetch-secret');process.exit(Number(process.env.FIXTURE_GIT_FETCH_STATUS));}\nprocess.exit(spawnSync(${JSON.stringify(nativeGit)},args,{stdio:'inherit'}).status ?? 1);\n`,
        { mode: 0o700 },
      );
      const origin = inspect("remote", "get-url", "origin");
      const head = inspect("rev-parse", "HEAD");
      for (const scenario of [
        {
          baseCommit: "a".repeat(40),
          baseBranch: "approved",
          fetch: "0",
          error: /approved commit .* is unavailable/,
        },
        {
          baseCommit: head,
          baseBranch: "not-published-fixture",
          fetch: "0",
          error: /approved branch .* is unavailable/,
        },
        {
          baseCommit: head,
          baseBranch: "approved",
          fetch: "0",
          error: /approved commit .* is not an ancestor/,
        },
        {
          baseCommit: "a".repeat(40),
          baseBranch: "approved",
          fetch: "1",
          error: /cannot fetch approved branch/,
        },
      ]) {
        readiness = [];
        repository = {
          url: origin,
          baseBranch: scenario.baseBranch,
          baseCommit: scenario.baseCommit,
        };
        try {
          await run(resolve(root, "node_modules/.bin/tsx"), ["scripts/agent-go.ts", "--json"], {
            cwd: clone,
            timeout: 60_000,
            env: {
              ...process.env,
              ACCELERATE_AGENT_NO_PROFILE: "1",
              WORK_BOARD_URL: `http://127.0.0.1:${address.port}`,
              WORK_BOARD_TOKEN: "fixture-worker-token",
              PATH: `${bin}:${process.env.PATH}`,
              FIXTURE_GIT_FETCH_STATUS: scenario.fetch,
            },
          });
          assert.fail("Unavailable approved source must refuse pickup");
        } catch (error) {
          const refusal = error as { code?: number; stdout?: string; stderr?: string };
          assert.equal(refusal.code, 1);
          const result = JSON.parse(refusal.stdout!);
          assert.equal(result.status, "PREFLIGHT_BLOCKED");
          assert.match(result.message, scenario.error);
          assert.match(result.next, /approved-source recovery.*revision-checked edit/);
          assert.ok(!result.next.includes("agent:setup"));
          assert.ok(!`${refusal.stdout}${refusal.stderr}`.includes("fixture-fetch-secret"));
          assert.ok(!`${refusal.stdout}${refusal.stderr}`.includes("fixture-worker-token"));
        }
        assert.equal(posts, 0);
        assert.equal(inspect("show-ref"), beforeRefs);
        assert.equal(inspect("status", "--porcelain"), beforeStatus);
      }
      console.log(
        "Runner preserves source-specific recovery for missing commits, branches, ancestry and failed fetches; zero claims and unchanged refs/source.",
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  } finally {
    await new Promise<void>((accept, reject) =>
      server.close((error) => (error ? reject(error) : accept())),
    );
  }
}
checkRepositoryDiagnosis().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

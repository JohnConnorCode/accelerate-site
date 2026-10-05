import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  RELEASE_UPSTREAM,
  RELEASE_ASSET,
  catalogDigest,
  parseReleaseMetadata,
  compareVersions,
  planReleaseUpgrade,
  discoverCoreReleases,
  verifyPublishedRelease,
  githubReader,
  resolveReleaseCommit,
} from "../src/lib/revenue-os/core-release.mjs";
import { verifyReleaseCi } from "./lib/release-ci.mjs";
import { sourceIdentity } from "./lib/core-release-source.mjs";

const sha = "a".repeat(40);
const checksum = "b".repeat(64);
const catalog = [{ file: "supabase/migration.sql", checksum }];
function metadata(version = "v0.1.0", supportedSourceVersions = [], extra = {}) {
  return parseReleaseMetadata({
    schemaVersion: 1,
    upstream: RELEASE_UPSTREAM,
    version,
    sourceCommit: sha,
    notes: "Reviewed fictional release notes.",
    runtime: { nodeMinimum: "22.16.0", npmMinimum: "10.0.0", postgresMinimum: "15.0.0" },
    migrations: { catalog, digest: catalogDigest(catalog) },
    extensions: { contractVersion: 1, schemaDigest: checksum },
    supportedSourceVersions,
    ...extra,
  });
}
function fixture(data) {
  const bytes = Buffer.from(JSON.stringify(data));
  const release = {
    draft: false,
    prerelease: false,
    published_at: "2026-10-01T12:00:00Z",
    tag_name: data.version,
    html_url: `https://github.com/${RELEASE_UPSTREAM}/releases/tag/${data.version}`,
    assets: [
      {
        id: 7,
        name: RELEASE_ASSET,
        state: "uploaded",
        size: bytes.length,
        url: `https://api.github.com/repos/${RELEASE_UPSTREAM}/releases/assets/7`,
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      },
    ],
  };
  const paths = [];
  const read = async (path) => {
    paths.push(path);
    if (path.startsWith("/git/ref/"))
      return {
        ref: `refs/tags/${data.version}`,
        object: { type: "commit", sha: data.sourceCommit },
      };
    if (path === "/releases/assets/7") return bytes;
    if (path === "/releases?per_page=100") return [release];
    throw new Error("Unexpected fixture request");
  };
  return { release, read, paths, bytes };
}
let checks = 0;
function test(name, run) {
  run();
  checks++;
  console.log(`PASS ${name}`);
}
async function asyncTest(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}
const installed = metadata();
const direct = metadata("v0.3.0", ["v0.1.0"]);
const bridge = metadata("v0.2.0", ["v0.1.0"]);
const bridgedTarget = metadata("v0.3.0", ["v0.2.0"]);
const identity = {
  core: installed,
  forkCommit: "c".repeat(40),
  customized: true,
  nodeVersion: "22.16.0",
};
const discovery = (read) =>
  discoverCoreReleases(identity, { read, now: () => new Date("2026-10-05T12:00:00Z") });

test("strict release metadata binds source, catalog, runtime and extension identity", () => {
  assert.equal(parseReleaseMetadata(installed).sourceCommit, sha);
  for (const bad of [
    { ...installed, upstream: "attacker/repo" },
    { ...installed, version: "v0.1.0-beta.1" },
    { ...installed, sourceCommit: "main" },
    { ...installed, runtime: { ...installed.runtime, nodeMinimum: "latest" } },
    { ...installed, surprise: true },
    { ...installed, migrations: { ...installed.migrations, digest: "0".repeat(64) } },
    { ...installed, supportedSourceVersions: ["v0.1.0"] },
    { ...installed, supportedSourceVersions: ["v0.0.1", "v0.0.1"] },
  ])
    assert.throws(() => parseReleaseMetadata(bad));
});
test("semantic sorting, explicitly supported skip and bridge path", () => {
  assert(compareVersions("v0.10.0", "v0.9.0") > 0);
  assert.deepEqual(planReleaseUpgrade(installed, [direct, installed], "22.16.0").path, ["v0.3.0"]);
  assert.deepEqual(
    planReleaseUpgrade(installed, [bridgedTarget, installed, bridge], "22.16.0").path,
    ["v0.2.0", "v0.3.0"],
  );
  assert.equal(
    planReleaseUpgrade(installed, [installed, bridgedTarget], "22.16.0").status,
    "incompatible",
  );
});
test("unknown identity, downgrade and untrusted installed metadata", () => {
  assert.equal(planReleaseUpgrade(null, [installed], "22.16.0").status, "unknown");
  assert.equal(planReleaseUpgrade(installed, [installed], "22.16.0").status, "current");
  assert.equal(
    planReleaseUpgrade(
      { ...installed, sourceCommit: "d".repeat(40) },
      [installed, direct],
      "22.16.0",
    ).status,
    "unknown",
  );
});
test("runtime, extension and rewritten migration history refuse an upgrade", () => {
  assert.equal(planReleaseUpgrade(installed, [installed, direct], "20.0.0").status, "incompatible");
  for (const target of [
    metadata("v0.3.0", ["v0.1.0"], { extensions: { contractVersion: 2, schemaDigest: checksum } }),
    metadata("v0.3.0", ["v0.1.0"], {
      migrations: {
        catalog: [{ ...catalog[0], checksum: "0".repeat(64) }],
        digest: catalogDigest([{ ...catalog[0], checksum: "0".repeat(64) }]),
      },
    }),
  ])
    assert.equal(
      planReleaseUpgrade(installed, [installed, target], "22.16.0").status,
      "incompatible",
    );
});
await asyncTest(
  "verified lightweight and annotated tags bind the exact asset checksum",
  async () => {
    const f = fixture(installed);
    assert.deepEqual(await verifyPublishedRelease(f.read, f.release), installed);
    const annotated = async (path) =>
      path.includes("/git/ref/")
        ? { ref: "refs/tags/v0.1.0", object: { type: "tag", sha: "c".repeat(40) } }
        : { sha: "c".repeat(40), object: { type: "commit", sha } };
    assert.equal(await resolveReleaseCommit(annotated, "v0.1.0"), sha);
  },
);
await asyncTest("moved tags, malformed assets and foreign upstream URLs fail closed", async () => {
  const f = fixture(installed);
  for (const bad of [
    { ...f.release, draft: true },
    { ...f.release, prerelease: true },
    { ...f.release, html_url: "https://attacker.test/release" },
    { ...f.release, assets: [] },
    { ...f.release, assets: [{ ...f.release.assets[0], digest: `sha256:${"0".repeat(64)}` }] },
  ])
    await assert.rejects(verifyPublishedRelease(f.read, bad));
  await assert.rejects(
    verifyPublishedRelease(
      async (path) =>
        path.startsWith("/git/ref/")
          ? { ref: "refs/tags/v0.1.0", object: { type: "commit", sha: "d".repeat(40) } }
          : f.read(path),
      f.release,
    ),
  );
});
await asyncTest("stable discovery ignores draft and prerelease, records checked time", async () => {
  const f = fixture(installed);
  const result = await discovery(async (path) =>
    path.startsWith("/releases?")
      ? [
          { ...f.release, draft: true },
          { ...f.release, prerelease: true },
          { ...f.release, tag_name: "v9.0.0-beta.1" },
          f.release,
        ]
      : f.read(path),
  );
  assert.equal(result.status, "current");
  assert.equal(result.checkedAt, "2026-10-05T12:00:00.000Z");
  assert.equal(result.channel, "stable");
});
await asyncTest(
  "a supported newer release returns exact target provenance and ordered path",
  async () => {
    const current = fixture(installed);
    const target = fixture(direct);
    target.release.assets[0].id = 8;
    target.release.assets[0].url = `https://api.github.com/repos/${RELEASE_UPSTREAM}/releases/assets/8`;
    const read = async (path) => {
      if (path === "/releases?per_page=100") return [target.release, current.release];
      if (path === "/releases/assets/8") return target.bytes;
      if (path.endsWith("v0.3.0"))
        return { ref: "refs/tags/v0.3.0", object: { type: "commit", sha } };
      return current.read(path);
    };
    const result = await discovery(read);
    assert.equal(result.status, "available");
    assert.equal(result.target.sourceCommit, sha);
    assert.deepEqual(result.path, ["v0.3.0"]);
  },
);
await asyncTest(
  "offline, rate limit, malformed feed and truncated feed never invent availability",
  async () => {
    for (const read of [
      async () => {
        throw new Error("offline secret-token");
      },
      async () => {
        throw new Error("rate_limited");
      },
      async () => ({}),
      async () => Array(100).fill({}),
    ]) {
      const result = await discovery(read);
      assert.equal(result.status, "unavailable");
      assert.equal(result.target, null);
      assert(!JSON.stringify(result).includes("secret-token"));
    }
    assert.equal(
      (await discoverCoreReleases({ ...identity, core: null }, { read: async () => [] })).status,
      "unknown",
    );
  },
);
await asyncTest(
  "public reader sends no install data and rejects redirects and oversized bodies",
  async () => {
    let request;
    const read = githubReader(async (url, options) => {
      request = { url, options };
      return new Response("[]");
    });
    await read("/releases?per_page=100");
    assert(request.url.startsWith(`https://api.github.com/repos/${RELEASE_UPSTREAM}/`));
    assert(!request.options.headers.Authorization);
    assert(!request.options.body);
    await assert.rejects(
      githubReader(
        async () =>
          new Response(null, { status: 302, headers: { location: "https://attacker.test/asset" } }),
      )("/releases/assets/7", { binary: true }),
    );
    await assert.rejects(githubReader(async () => new Response("x".repeat(1000001)))("/releases"));
  },
);
test("publication requires complete exact-source CI, never PR merge or partial suites", () => {
  const run = {
    id: 1,
    head_sha: sha,
    head_branch: "main",
    path: ".github/workflows/ci.yml",
    event: "push",
    status: "completed",
    conclusion: "success",
  };
  const jobs = [
    "checks",
    "build",
    "full-product-fork (missing)",
    "full-product-fork (example)",
    "neutral-starter",
    "verify",
  ].map((name) => ({ name, status: "completed", conclusion: "success" }));
  assert.equal(
    verifyReleaseCi(sha, ["ci.yml"], [{ workflow: "ci.yml", run, jobs }]).sourceCommit,
    sha,
  );
  for (const bad of [
    { ...run, head_sha: "c".repeat(40) },
    { ...run, event: "pull_request" },
    { ...run, conclusion: "failure" },
    { ...run, head_branch: "feature" },
  ])
    assert.throws(() => verifyReleaseCi(sha, ["ci.yml"], [{ workflow: "ci.yml", run: bad, jobs }]));
  assert.throws(() =>
    verifyReleaseCi(sha, ["ci.yml"], [{ workflow: "ci.yml", run, jobs: jobs.slice(1) }]),
  );
  assert.throws(() =>
    verifyReleaseCi(sha, ["ci.yml", "connected-fork.yml"], [{ workflow: "ci.yml", run, jobs }]),
  );
});
test("installed core and customized fork commit remain distinct", () => {
  const dir = mkdtempSync(join(tmpdir(), "accelerate-release-identity-"));
  const git = (args) =>
    execFileSync("git", args, { cwd: dir, stdio: "pipe", encoding: "utf8" }).trim();
  try {
    git(["init", "-q"]);
    git(["config", "user.email", "fictional@example.test"]);
    git(["config", "user.name", "Fictional installer"]);
    writeFileSync(join(dir, "sample"), "core");
    git(["add", "."]);
    git(["commit", "-qm", "core"]);
    const coreCommit = git(["rev-parse", "HEAD"]);
    writeFileSync(
      join(dir, "core-release.json"),
      JSON.stringify(metadata("v0.1.0", [], { sourceCommit: coreCommit })),
    );
    git(["add", "."]);
    git(["commit", "-qm", "fork adoption"]);
    const result = sourceIdentity(dir);
    assert.equal(result.core.sourceCommit, coreCommit);
    assert.notEqual(result.forkCommit, coreCommit);
    assert.equal(result.customized, true);
    writeFileSync(
      join(dir, "core-release.json"),
      JSON.stringify({ ...installed, sourceCommit: "d".repeat(40) }),
    );
    assert.equal(sourceIdentity(dir).core, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
await asyncTest(
  "actual Setup GET refuses unauthorized access before discovery and returns a private redacted result",
  async () => {
    const require = createRequire(import.meta.url);
    const { NextResponse } = require("next/server");
    mkdirSync(".accelerate", { recursive: true });
    const dir = mkdtempSync(join(process.cwd(), ".accelerate/release-route-"));
    const originalFetch = globalThis.fetch;
    const originalIdentity = process.env.ACCELERATE_CORE_IDENTITY;
    let calls = 0;
    try {
      const outfile = join(dir, "route.cjs");
      await build({
        entryPoints: ["src/app/api/admin/setup/release/route.ts"],
        outfile,
        bundle: true,
        format: "cjs",
        platform: "node",
        packages: "external",
        plugins: [
          {
            name: "controlled-auth",
            setup(b) {
              b.onResolve({ filter: /^@\/lib\/admin\/auth$/ }, () => ({
                path: "auth",
                namespace: "controlled",
              }));
              b.onLoad({ filter: /.*/, namespace: "controlled" }, () => ({
                contents:
                  "export async function requirePlatformAdmin() { return globalThis.__releaseAuth; }",
              }));
            },
          },
        ],
      });
      const { GET } = require(outfile);
      globalThis.fetch = async () => {
        calls++;
        return new Response("[]");
      };
      globalThis.__releaseAuth = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      assert.equal((await GET()).status, 401);
      assert.equal(calls, 0);
      globalThis.__releaseAuth = { email: "fictional-owner@example.test" };
      process.env.ACCELERATE_CORE_IDENTITY = JSON.stringify({ ...identity, core: null });
      const response = await GET();
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const result = await response.json();
      assert.equal(result.status, "unknown");
      assert.equal(result.installed.forkCommit, identity.forkCommit);
      assert(!("core" in result.installed));
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
      delete globalThis.__releaseAuth;
      if (originalIdentity === undefined) delete process.env.ACCELERATE_CORE_IDENTITY;
      else process.env.ACCELERATE_CORE_IDENTITY = originalIdentity;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
console.log(JSON.stringify({ contract: "fork-release.v1", checks, result: "passed" }));

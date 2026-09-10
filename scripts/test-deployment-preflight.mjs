import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyDeploymentTarget } from "./deployment-preflight.mjs";

const target = { projectId: "prj_expected", teamId: "team_expected", projectName: "app" };
const linked = { projectId: target.projectId, orgId: target.teamId };
const project = { id: target.projectId, accountId: target.teamId, name: target.projectName };

test("checks the exact intended team/project, independent of default CLI scope", () => {
  assert.equal(
    verifyDeploymentTarget({
      target,
      linked,
      env: {},
      request(endpoint) {
        assert.equal(endpoint, "/v9/projects/prj_expected?teamId=team_expected");
        return project;
      },
    }),
    target,
  );
});

for (const [name, changes] of [
  ["wrong project link", { linked: { ...linked, projectId: "prj_wrong" } }],
  ["wrong team link", { linked: { ...linked, orgId: "team_wrong" } }],
  ["project environment override", { env: { VERCEL_PROJECT_ID: "prj_wrong" } }],
  ["team environment override", { env: { VERCEL_ORG_ID: "team_wrong" } }],
]) {
  test(`rejects ${name} before calling the provider`, () => {
    let called = false;
    assert.throws(() =>
      verifyDeploymentTarget({
        target,
        linked,
        env: {},
        ...changes,
        request() {
          called = true;
          return project;
        },
      }),
    );
    assert.equal(called, false);
  });
}

test("rejects wrong remote owner and inaccessible project", () => {
  assert.throws(
    () =>
      verifyDeploymentTarget({
        target,
        linked,
        env: {},
        request: () => ({ ...project, accountId: "team_wrong" }),
      }),
    /different project/,
  );
  assert.throws(
    () =>
      verifyDeploymentTarget({
        target,
        linked,
        env: {},
        request() {
          throw new Error("Access denied");
        },
      }),
    /Access denied/,
  );
});

for (const shape of [
  "static",
  "dynamic",
  "wrong-static-id",
  "wrong-dynamic-id",
  "runtime-override",
  "missing",
  "unknown-handler",
]) {
  test(`prebuilt release verification: ${shape}`, () => {
    const root = mkdtempSync(resolve(tmpdir(), "accelerate-prebuilt-test-"));
    const id = "123456789abc";
    const put = (name, body) => {
      const path = resolve(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, body);
    };
    try {
      const config = { deploymentId: id, experimental: { runtimeServerDeploymentId: false } };
      put(".next/required-server-files.json", JSON.stringify({ config }));
      if (shape.includes("static"))
        put(
          ".vercel/output/functions/demo/command-center.prerender-fallback.html",
          `<script src="/app.js?dpl=${shape === "static" ? id : "wrong"}"></script>`,
        );
      else if (shape !== "missing") {
        put(
          ".vercel/output/functions/demo/command-center.func/.vc-config.json",
          JSON.stringify({
            handler: shape === "unknown-handler" ? "other.cjs" : "___next_launcher.cjs",
          }),
        );
        put(
          ".vercel/output/functions/demo/command-center.func/___next_launcher.cjs",
          `const conf = ${JSON.stringify({ ...config, deploymentId: shape === "wrong-dynamic-id" ? "wrong" : id, experimental: { runtimeServerDeploymentId: shape === "runtime-override" } })};`,
        );
      }
      const result = spawnSync(
        process.execPath,
        [resolve("scripts/next-release.mjs"), "verify-prebuilt"],
        { cwd: root, env: { ...process.env, NEXT_DEPLOYMENT_ID: id }, encoding: "utf8" },
      );
      if (["static", "dynamic"].includes(shape)) assert.equal(result.status, 0, result.stderr);
      else assert.notEqual(result.status, 0, "An unverified artifact must refuse deployment");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

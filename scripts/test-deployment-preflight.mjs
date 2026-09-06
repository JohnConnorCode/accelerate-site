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

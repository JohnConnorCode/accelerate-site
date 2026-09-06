import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectMaintainerPolicy } from "./lib/maintainer-workflow.mjs";

const policy = { githubAccount: "owner" };
const protection = {
  required_pull_request_reviews: {
    required_approving_review_count: 0,
    require_code_owner_reviews: false,
  },
  required_status_checks: { contexts: ["verify"], strict: true },
  enforce_admins: { enabled: true },
};
const inspect = (changes = {}) =>
  inspectMaintainerPolicy(policy, { login: "owner", protection, ...changes });
test("single owner can use PRs with mandatory CI without self-approval", () => {
  assert.ok(inspect().every((check) => check.status === "pass"));
});
test("wrong account blocks before work is represented as ready", () => {
  assert.equal(inspect({ login: "other" })[0].status, "blocked");
});
for (const reviews of [
  { required_approving_review_count: 1 },
  { required_approving_review_count: 0, require_code_owner_reviews: true },
  { required_approving_review_count: 0, require_last_push_approval: true },
])
  test(`rejects self-approval deadlock ${JSON.stringify(reviews)}`, () => {
    assert.equal(
      inspect({ protection: { ...protection, required_pull_request_reviews: reviews } })[1].status,
      "blocked",
    );
  });
for (const changes of [
  { required_status_checks: null },
  { required_status_checks: { contexts: ["build"], strict: true } },
  { required_status_checks: { contexts: ["verify"], strict: false } },
  { enforce_admins: { enabled: false } },
])
  test(`does not trade the deadlock for weakened CI ${JSON.stringify(changes)}`, () => {
    assert.equal(inspect({ protection: { ...protection, ...changes } })[2].status, "blocked");
  });
test("missing protection is not readiness", () => {
  assert.ok(
    inspect({ protection: null })
      .slice(1)
      .every((check) => check.status === "blocked"),
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSnapshot } from "./verify-backlog-snapshot.mjs";

function fixture() {
  return {
    exportedAt: "2026-09-05T12:00:00Z",
    features: [
      {
        id: "card",
        seed_key: "example",
        status: "planned",
        work_kind: "operations",
        dependencies: [],
        readiness: [],
        work_spec: {
          currentBehavior: "A retry can create a second effect.",
          businessValue: "Retry without duplicates.",
          workflow: ["Interrupt after provider acceptance and retry the same request key."],
          acceptance: [{ id: "AC1", environment: "controlled-integration" }],
          verification: [{ environment: "controlled-integration" }],
        },
      },
    ],
  };
}
test("accepts a packet with a distinct gap, execution step and required environment", () => {
  assert.deepEqual(validateSnapshot(fixture()), []);
});
test("rejects a build-only procedure for integration acceptance", () => {
  const s = fixture();
  s.features[0].work_spec.verification[0].environment = "local";
  assert.match(validateSnapshot(s).join("\n"), /AC1 has no controlled-integration/);
});
test("rejects desired outcomes and acceptance slogans used as execution instructions", () => {
  const s = fixture(),
    spec = s.features[0].work_spec;
  spec.currentBehavior = spec.businessValue;
  spec.workflow = ["Deliver AC1: prevent duplicates"];
  const failures = validateSnapshot(s).join("\n");
  assert.match(failures, /current behavior repeats/);
  assert.match(failures, /workflow repeats/);
});
test("preserves historical and active execution contracts", () => {
  for (const status of ["shipped", "in_progress", "in_review"]) {
    const s = fixture();
    s.features[0].status = status;
    s.features[0].work_spec.verification = [];
    assert.deepEqual(validateSnapshot(s), []);
  }
});

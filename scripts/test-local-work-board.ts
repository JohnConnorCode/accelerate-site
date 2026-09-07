import assert from "node:assert/strict";
import { workEvidenceSchema } from "../src/lib/revenue-os/work-board";
import { localReadOptions, localWorkActor } from "./lib/local-work-board";

for (const invalid of [undefined, "", "*", "../accelerate", "a,b"]) {
  assert.throws(() => localWorkActor(invalid));
}
const actor = localWorkActor("accelerate");
assert.deepEqual(actor.projects, ["accelerate"]);
assert.equal(actor.reviewer, false);
for (const operation of ["review", "recover", "archive", "delivery", "create", "edit", "*"])
  assert(!actor.scopes.includes(operation));
assert(actor.scopes.includes("claim") && actor.scopes.includes("submit"));
assert.deepEqual(localReadOptions("?key=chosen-card&limit=1"), {
  seedKey: "chosen-card",
  limit: 1,
});
assert.deepEqual(localReadOptions("?offset=250&limit=250"), { offset: 250, limit: 250 });
assert.deepEqual(localReadOptions("?id=card-id"), { id: "card-id" });

const evidence = {
  summary: "Controlled local verification",
  checks: [
    {
      name: "Local check",
      status: "passed",
      evidence: "fixture result",
      acceptanceId: "AC1",
      environment: "local",
    },
  ],
};
assert.equal(workEvidenceSchema.parse(evidence).checks[0]!.environment, "local");
assert.throws(() =>
  workEvidenceSchema.parse({
    ...evidence,
    checks: [{ ...evidence.checks[0], environment: "unknown" }],
  }),
);
console.log("Local operator transport boundaries and evidence environment passed");

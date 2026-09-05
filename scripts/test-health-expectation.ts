import assert from "node:assert/strict";
import {
  EXPECTED_CADENCE_LABELS,
  describeExpectedCheck,
  type HealthConcernKind,
} from "../src/lib/revenue-os/health-expectation";

// Every subsystem kind the health service can raise a concern for must have
// operator cadence wording, or the ledger cannot name its expectation.
const kinds: HealthConcernKind[] = ["integration", "job", "source", "webhook"];
for (const kind of kinds) {
  assert.ok(
    typeof EXPECTED_CADENCE_LABELS[kind] === "string" && EXPECTED_CADENCE_LABELS[kind].length > 0,
    `missing cadence label for ${kind}`,
  );
}

const now = 1_800_000_000_000;

assert.equal(
  describeExpectedCheck(now + 42 * 60_000, EXPECTED_CADENCE_LABELS.source, now),
  "Runs hourly · next check in 42m",
);
assert.equal(
  describeExpectedCheck(now + 90 * 60_000, EXPECTED_CADENCE_LABELS.job, now),
  "Runs every 30 minutes · next check in 1h30m",
);
assert.equal(
  describeExpectedCheck(now - 5 * 60_000, EXPECTED_CADENCE_LABELS.job, now),
  "Runs every 30 minutes · check overdue by 5m",
);
assert.equal(
  describeExpectedCheck(now + 20_000, EXPECTED_CADENCE_LABELS.source, now),
  "Runs hourly · next check in less than a minute",
);

// Items without an expectation (integrations) render nothing extra.
assert.equal(describeExpectedCheck(undefined, EXPECTED_CADENCE_LABELS.source, now), null);
assert.equal(describeExpectedCheck(now + 60_000, undefined, now), null);

console.log(JSON.stringify({ result: "passed", kinds: kinds.length }));

#!/usr/bin/env tsx
/**
 * A consequential job's eval evidence is only valid for the contract it was
 * run against. If a prompt, schema, validator, tool registry or job setting
 * changes, the fingerprint moves and this check fails until
 * JOB_CONTRACT_FINGERPRINTS is updated, which in turn retires the stored
 * evidence so the model must be re-evaluated before it runs the job again.
 */
import assert from "node:assert/strict";
import { JOB_CONTRACT_FINGERPRINTS } from "../src/lib/ai/eval-contract";
import { computeJobContractFingerprints } from "../src/lib/ai/eval-contract-sources";
import { AI_JOBS } from "../src/lib/ai/model-registry";

const computed = computeJobContractFingerprints();
for (const [job, fingerprint] of Object.entries(computed))
  assert.equal(
    JOB_CONTRACT_FINGERPRINTS[job],
    fingerprint,
    `${job} contract changed. Set JOB_CONTRACT_FINGERPRINTS["${job}"] = "${fingerprint}" in src/lib/ai/eval-contract.ts, then run npm run eval:consequential-jobs -- --record so the model is re-qualified.`,
  );
const consequential = AI_JOBS.filter((job) => job.consequential).map((job) => job.key);
assert.deepEqual(
  Object.keys(JOB_CONTRACT_FINGERPRINTS).sort(),
  consequential.sort(),
  "every consequential job needs an eval contract, and only those",
);
console.log(JSON.stringify({ result: "passed", jobs: Object.keys(computed) }, null, 2));

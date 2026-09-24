/**
 * Versioned eval evidence for consequential AI jobs.
 *
 * A low-cost model may run a consequential job only with current evidence:
 * produced by this eval suite, against the job's current contract (prompts,
 * schemas, validators, tool registry), passing every run, and recent. A
 * contract change moves its fingerprint here, which retires old evidence
 * until the eval is run again; `test:eval-contract` fails if a contract
 * changes without this table following it.
 *
 * This module is a leaf so the model registry can import it without pulling
 * prompt builders (and their imports) into the gateway.
 */

export const EVAL_SUITE_VERSION = "consequential-jobs.v1";
export const EVAL_MAX_AGE_DAYS = 30;

/** sha256 of each job's contract, computed by `computeJobContractFingerprints`. */
export const JOB_CONTRACT_FINGERPRINTS: Readonly<Record<string, string>> = {
  "copilot-answer": "687421abb4a41892",
  "coworker-task": "cec069858e52a235",
  "responder-draft": "976f33af37e62a94",
  "proposal-draft": "ac715e5474aa2c18",
};

export interface JobEvalEvidence {
  suiteVersion: string;
  fingerprint: string;
  evaluatedAt: string;
  runs: number;
  passes: number;
  cases: number;
  p50LatencyMs?: number;
}

export type EvalEvidence = Record<string, JobEvalEvidence>;

/** Evidence counts only when it is this suite's, matches the job's current
 * contract, passed every run, and is recent. Anything else fails closed. */
export function isEvidenceCurrent(
  job: string,
  evidence: JobEvalEvidence | undefined,
  now = Date.now(),
): boolean {
  if (!evidence) return false;
  const expected = JOB_CONTRACT_FINGERPRINTS[job];
  const evaluatedAt = Date.parse(evidence.evaluatedAt);
  return (
    evidence.suiteVersion === EVAL_SUITE_VERSION &&
    Boolean(expected) &&
    evidence.fingerprint === expected &&
    evidence.runs > 0 &&
    evidence.passes === evidence.runs &&
    Number.isFinite(evaluatedAt) &&
    evaluatedAt <= now &&
    now - evaluatedAt <= EVAL_MAX_AGE_DAYS * 86_400_000
  );
}

/** Parse stored evidence defensively; malformed entries are dropped, never trusted. */
export function parseEvalEvidence(value: unknown): EvalEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const parsed: EvalEvidence = {};
  for (const [job, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (
      typeof entry.suiteVersion !== "string" ||
      typeof entry.fingerprint !== "string" ||
      typeof entry.evaluatedAt !== "string" ||
      typeof entry.runs !== "number" ||
      typeof entry.passes !== "number" ||
      typeof entry.cases !== "number"
    )
      continue;
    parsed[job] = {
      suiteVersion: entry.suiteVersion,
      fingerprint: entry.fingerprint,
      evaluatedAt: entry.evaluatedAt,
      runs: entry.runs,
      passes: entry.passes,
      cases: entry.cases,
      ...(typeof entry.p50LatencyMs === "number" ? { p50LatencyMs: entry.p50LatencyMs } : {}),
    };
  }
  return parsed;
}

/** Test fixtures: evidence that is current for the given jobs right now. */
export function currentEvalEvidence(
  jobs: string[],
  evaluatedAt = new Date().toISOString(),
): EvalEvidence {
  return Object.fromEntries(
    jobs.map((job) => [
      job,
      {
        suiteVersion: EVAL_SUITE_VERSION,
        fingerprint: JOB_CONTRACT_FINGERPRINTS[job] ?? "",
        evaluatedAt,
        runs: 1,
        passes: 1,
        cases: 1,
      },
    ]),
  );
}

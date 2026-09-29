import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Explicit fixture facts only. Never serialize clients, connections or credentials. */
export function writeJourneyEvidence(journey: string, facts: Record<string, unknown>) {
  const directory = process.env.REFERENCE_JOURNEY_OUTPUT;
  if (!directory) return;
  if (!/^[a-z-]+$/.test(journey)) throw new Error("Invalid journey evidence name");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, `${journey}.json`),
    JSON.stringify(
      {
        journey,
        recordedAt: new Date().toISOString(),
        environment: "local",
        providerEvidence: "controlled-adapter",
        ...facts,
      },
      null,
      2,
    ) + "\n",
  );
}

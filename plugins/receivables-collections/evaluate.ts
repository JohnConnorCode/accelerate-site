import "server-only";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateInIsolate } from "../../src/lib/revenue-os/plugin-isolate";
import { collectionsPlanSchema, validateCollectionsSnapshot } from "./contract";

/** Development/conformance entrypoint, not a registered live plugin host.
 * The future live adapter must load authorized provider facts and case policy. */
export async function evaluateCollectionsSnapshot(expectedTenantId: string, raw: unknown) {
  const input = validateCollectionsSnapshot(raw);
  if (input.tenantId !== expectedTenantId)
    throw new Error("Snapshot does not belong to the host tenant");
  const code = readFileSync(new URL("./plan.js", import.meta.url), "utf8");
  const execution = await evaluateInIsolate(code, {
    pluginId: "receivables-collections",
    timeoutMs: 250,
    memoryLimitBytes: 8 * 1024 * 1024,
    bindings: { collectionsSnapshot: () => input },
  });
  return {
    plan: collectionsPlanSchema.parse(execution.value),
    receipt: { ...execution.receipt, sourceHash: createHash("sha256").update(code).digest("hex") },
  };
}

import { z } from "zod";

export const blueprintReadSchema = z.object({ blueprintId: z.uuid().optional() }).strict();
export const blueprintPatchSchema = z
  .object({
    blueprintId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    proposal: z.string().trim().min(1).max(32000),
    changeSummary: z.string().trim().min(1).max(2000),
    requestId: z.uuid(),
  })
  .strict();
export const blueprintProposalSchema = blueprintPatchSchema
  .extend({
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const blueprintSimulationSchema = z
  .object({
    blueprintId: z.uuid(),
    event: z.string().trim().max(500).optional(),
  })
  .strict();
export type BlueprintPatch = z.infer<typeof blueprintPatchSchema>;
export interface BlueprintPatchPreview {
  command: BlueprintPatch;
  before: { businessSummary: string };
  next: { businessSummary: string };
  diff: { added: string[]; removed: string[]; changed: string[] };
  digest: string;
  review: Record<string, string>;
}

export const ENTIRE_ACCOUNT_REFUSED = "Entire-account context is refused";
export function assertArchitectReviewScope(value: unknown): void {
  const text = String(JSON.stringify(value) ?? "").toLowerCase();
  if (
    text.includes("entire account") ||
    text.includes("entire-account") ||
    text.includes("all tenants") ||
    text.includes("chain-of-thought") ||
    text.includes("chain of thought")
  ) {
    throw new Error(ENTIRE_ACCOUNT_REFUSED);
  }
}

export function proposalToTypedPatch(proposal: string): Record<string, unknown> {
  const text = proposal.trim();
  if (!text) throw new Error("proposal is required");
  assertArchitectReviewScope(text);
  if (text.startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("proposal JSON must be an object");
    }
    assertArchitectReviewScope(parsed);
    const allowed = new Set([
      "businessSummary",
      "assumptions",
      "unresolvedQuestions",
      "evidenceRefs",
      "navigation",
      "entities",
      "relationships",
      "workTypes",
      "boards",
      "views",
      "dashboards",
      "workflows",
      "triggers",
      "coworkers",
      "skills",
      "attentionRules",
      "reports",
      "integrationRequirements",
      "permissionPolicies",
      "autonomyPolicies",
      "installedAppRecommendations",
      "approvalGates",
      "migrationPlan",
    ]);
    if (Object.keys(parsed).some((key) => !allowed.has(key)))
      throw new Error("Unsupported Blueprint section");
    return parsed as Record<string, unknown>;
  }
  const summary = text.match(
    /^(?:please\s+)?(?:set\s+)?(?:the\s+)?(?:business\s+)?summary(?:\s+to|:)\s+(.+)$/i,
  );
  if (summary?.[1]) return { businessSummary: summary[1].trim() };
  throw new Error("Could not turn that proposal into a Blueprint patch");
}

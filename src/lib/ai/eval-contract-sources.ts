import { createHash } from "node:crypto";
import { AI_JOBS, DEFAULT_JOB_REASONING } from "./model-registry";
import { approvedPricingPromptContext } from "./approved-pricing";
import { PROPOSAL_SCHEMA, PROPOSAL_SYSTEM_PROMPT, validateProposal } from "./proposal-draft";
import {
  AI_CONTEXT_VERSION,
  buildCoworkerGroundingContract,
  buildRevenueAiGroundingContract,
  unsourcedDollarFigures,
  validateGroundedRevenueAnswer,
} from "@/lib/revenue-os/ai-context";
import { AI_TOOL_REGISTRY_VERSION } from "@/lib/revenue-os/ai-tool-contract";
import { MAX_TOOL_TURNS, SYSTEM_CONTRACT } from "@/lib/revenue-os/ai-agent";
import { coworkerSystemPrompt, MAX_COWORKER_TOOL_TURNS } from "@/lib/revenue-os/coworker-agent";
import {
  checkGrounding,
  RESPONDER_POLICY_VERSION,
  RESPONDER_SYSTEM_PROMPT,
} from "@/lib/revenue-os/auto-responder";

/**
 * The inputs that define each consequential job's behaviour. Changing any of
 * them changes the job's fingerprint, which retires its eval evidence.
 */
function jobContractParts(job: string): unknown[] {
  const registration = AI_JOBS.find((candidate) => candidate.key === job);
  const shared = [registration, registration?.reasoning ?? DEFAULT_JOB_REASONING];
  switch (job) {
    case "copilot-answer":
      return [
        ...shared,
        SYSTEM_CONTRACT,
        MAX_TOOL_TURNS,
        AI_CONTEXT_VERSION,
        AI_TOOL_REGISTRY_VERSION,
        buildRevenueAiGroundingContract({
          today: "<today>",
          learningSignals: "<signals>",
          pageContext: "<page>",
          toolPack: "<pack>",
        }),
        validateGroundedRevenueAnswer.toString(),
        unsourcedDollarFigures.toString(),
      ];
    case "coworker-task":
      return [
        ...shared,
        coworkerSystemPrompt("<role>", "<id>", "<workspace>"),
        MAX_COWORKER_TOOL_TURNS,
        AI_CONTEXT_VERSION,
        AI_TOOL_REGISTRY_VERSION,
        buildCoworkerGroundingContract({ today: "<today>", toolPack: "<pack>" }),
        validateGroundedRevenueAnswer.toString(),
        unsourcedDollarFigures.toString(),
      ];
    case "responder-draft":
      return [
        ...shared,
        RESPONDER_POLICY_VERSION,
        RESPONDER_SYSTEM_PROMPT,
        checkGrounding.toString(),
      ];
    case "proposal-draft":
      return [
        ...shared,
        PROPOSAL_SYSTEM_PROMPT,
        PROPOSAL_SCHEMA,
        approvedPricingPromptContext(),
        validateProposal.toString(),
      ];
    default:
      throw new Error(`No eval contract is defined for job ${job}`);
  }
}

export function computeJobContractFingerprint(job: string): string {
  return createHash("sha256")
    .update(JSON.stringify(jobContractParts(job)))
    .digest("hex")
    .slice(0, 16);
}

export function computeJobContractFingerprints(): Record<string, string> {
  return Object.fromEntries(
    ["copilot-answer", "coworker-task", "responder-draft", "proposal-draft"].map((job) => [
      job,
      computeJobContractFingerprint(job),
    ]),
  );
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAutonomyPolicies, grantStandingPermission, type AutonomyLevel } from "./autonomy-policy";
import { recordAudit } from "./audit";
import { createWorkItem } from "./work-items";
import { registerWorkKindHandler, type WorkKindHandler } from "./work-executor";
import { storeAgentMemory } from "./memory";

// ---------------------------------------------------------------------------
// Trust graduation engine: propose autonomy level upgrades based on
// accumulated approval signals.
//
// Northstar §27 / §7: "AI may propose policy. Humans establish policy."
// The system observes repeated human behavior (approvals) and proposes
// autonomy promotions, but a human must confirm each upgrade.
//
// The autonomy ladder is:
//   prohibited → always_ask → ask_until_trusted → standing_permission → autonomous
//
// Trust graduation proposes moves from ask_until_trusted → standing_permission
// when enough consecutive approvals accumulate for a given action key.
// It never proposes jumps over levels, and it never touches hard floors.
// ---------------------------------------------------------------------------

const AUTONOMY_LADDER: AutonomyLevel[] = [
  "prohibited",
  "always_ask",
  "ask_until_trusted",
  "standing_permission",
  "autonomous",
];

const MIN_APPROVALS_FOR_PROMOTION = 3;
const MIN_DAYS_OF_OBSERVATION = 7;

export interface TrustGraduationCandidate {
  actionKey: string;
  coworkerId: string | null;
  currentLevel: AutonomyLevel;
  proposedLevel: AutonomyLevel;
  approvalCount: number;
  rejectionCount: number;
  firstApprovalAt: string;
  lastApprovalAt: string;
  eligible: boolean;
  reason: string;
}

/**
 * Scan for action keys at `ask_until_trusted` that have accumulated enough
 * consecutive approvals to merit a standing_permission proposal.
 */
export async function scanTrustGraduationCandidates(
  supabase: SupabaseClient,
): Promise<TrustGraduationCandidate[]> {
  // Find all ask_until_trusted policies.
  const policies = await listAutonomyPolicies(supabase, { level: "ask_until_trusted" });

  const candidates: TrustGraduationCandidate[] = [];

  for (const policy of policies) {
    const actionKey = policy.action_key;
    const coworkerId = policy.coworker_id;

    // Count approved actions of this type (by the same coworker if scoped).
    let approvedQuery = supabase
      .from("action_queue")
      .select("id, approved_at, action_type", { count: "exact" })
      .eq("action_type", actionKey)
      .eq("status", "executed")
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: true });

    if (coworkerId) {
      approvedQuery = approvedQuery.eq("proposed_by", `coworker:${coworkerId}`);
    }

    const { count: approvalCount, data: approvals } = await approvedQuery;

    // Count rejections.
    let rejectedQuery = supabase
      .from("action_queue")
      .select("id", { count: "exact", head: true })
      .eq("action_type", actionKey)
      .eq("status", "rejected");

    if (coworkerId) {
      rejectedQuery = rejectedQuery.eq("proposed_by", `coworker:${coworkerId}`);
    }

    const { count: rejectionCount } = await rejectedQuery;

    const firstApproval = approvals?.[0]?.approved_at;
    const lastApproval = approvals?.[(approvals?.length ?? 0) - 1]?.approved_at;

    // Check observation period.
    const daysObserved = firstApproval
      ? (Date.now() - new Date(firstApproval).getTime()) / (24 * 60 * 60 * 1000)
      : 0;

    const eligible =
      (approvalCount ?? 0) >= MIN_APPROVALS_FOR_PROMOTION &&
      daysObserved >= MIN_DAYS_OF_OBSERVATION &&
      (rejectionCount ?? 0) === 0;

    // Find the next level up the ladder.
    const currentIdx = AUTONOMY_LADDER.indexOf(policy.level);
    const proposedLevel: AutonomyLevel =
      currentIdx >= 0 && currentIdx < AUTONOMY_LADDER.length - 1
        ? AUTONOMY_LADDER[currentIdx + 1]!
        : policy.level;

    candidates.push({
      actionKey,
      coworkerId,
      currentLevel: policy.level,
      proposedLevel,
      approvalCount: approvalCount ?? 0,
      rejectionCount: rejectionCount ?? 0,
      firstApprovalAt: firstApproval ?? "",
      lastApprovalAt: lastApproval ?? "",
      eligible,
      reason: eligible
        ? `${approvalCount} approvals with 0 rejections over ${Math.round(daysObserved)}d — ready for ${proposedLevel}`
        : `Not yet: ${approvalCount ?? 0}/${MIN_APPROVALS_FOR_PROMOTION} approvals, ${rejectionCount ?? 0} rejections, ${Math.round(daysObserved)}/${MIN_DAYS_OF_OBSERVATION}d observation`,
    });
  }

  return candidates;
}

/**
 * Run the trust graduation scan and create work items for eligible promotions.
 * Each eligible candidate gets a work item that surfaces in the operator inbox
 * for human confirmation. The system proposes; the human decides.
 */
export async function runTrustGraduationScan(
  supabase: SupabaseClient,
): Promise<{ scanned: number; eligible: number; proposed: number }> {
  const candidates = await scanTrustGraduationCandidates(supabase);
  const eligible = candidates.filter((c) => c.eligible);
  let proposed = 0;

  for (const candidate of eligible) {
    // Create a work item for the human to review the proposed promotion.
    // Dedupe by action_key + coworker so we don't spam.
    const dedupeKey = `trust-graduation:${candidate.actionKey}:${candidate.coworkerId ?? "global"}`;
    const result = await createWorkItem(supabase, {
      kind: "review_trust_promotion",
      objective: `Propose autonomy upgrade: ${candidate.actionKey} from ${candidate.currentLevel} → ${candidate.proposedLevel}`,
      reason: candidate.reason,
      source: "trust_graduation_engine",
      priority: "medium",
      coworkerId: candidate.coworkerId ?? undefined,
      entityType: "autonomy_policy",
      entityId: candidate.actionKey,
      dedupeKey,
      maxAttempts: 2,
      actorEmail: "system",
      surfaceInInbox: true,
    });

    if (result.workItem && !result.deduplicated) {
      proposed++;
      await recordAudit(supabase, {
        actorEmail: "system",
        action: "trust_graduation.promotion_proposed",
        entityType: "autonomy_policy",
        entityId: candidate.actionKey,
        source: "automation",
        after: {
          action_key: candidate.actionKey,
          current_level: candidate.currentLevel,
          proposed_level: candidate.proposedLevel,
          approval_count: candidate.approvalCount,
          rejection_count: candidate.rejectionCount,
          observation_days: candidate.firstApprovalAt
            ? Math.round(
                (Date.now() - new Date(candidate.firstApprovalAt).getTime()) /
                  (24 * 60 * 60 * 1000),
              )
            : 0,
        },
      });
    }
  }

  return { scanned: candidates.length, eligible: eligible.length, proposed };
}

/**
 * Execute a trust promotion: upgrade the autonomy level for an action key.
 * This is called when a human approves the review_trust_promotion work item.
 */
export async function executeTrustPromotion(
  supabase: SupabaseClient,
  input: {
    actionKey: string;
    coworkerId: string | null;
    proposedLevel: AutonomyLevel;
    approvedBy: string;
  },
): Promise<{ policyId: string }> {
  if (input.proposedLevel === "standing_permission") {
    const policyId = await grantStandingPermission(supabase, {
      actionKey: input.actionKey,
      coworkerId: input.coworkerId,
      approvedBy: input.approvedBy,
    });
    return { policyId };
  }

  // For other level changes, use the upsert RPC.
  const { registerAutonomyPolicy } = await import("./autonomy-policy");
  const policyId = await registerAutonomyPolicy(supabase, {
    actionKey: input.actionKey,
    label: `Upgraded to ${input.proposedLevel} by trust graduation`,
    level: input.proposedLevel,
    coworkerId: input.coworkerId,
    source: "trust_graduation",
    actorEmail: input.approvedBy,
  });

  return { policyId };
}

// ---------------------------------------------------------------------------
// Work kind handler for review_trust_promotion work items.
//
// When the trust graduation scan proposes a promotion, a work item is created
// with kind "review_trust_promotion". This handler presents the evidence
// (approval count, rejection count, observation period) and waits for human
// decision. The actual promotion happens when the human approves via the
// autonomy policy admin surface.
// ---------------------------------------------------------------------------

const reviewTrustPromotionHandler: WorkKindHandler = async (supabase, wi) => {
  const actionKey = wi.entity_id;
  if (!actionKey) return { status: "skipped", outcome: "No action key linked — cannot review promotion" };

  // Re-check current eligibility at execution time (not creation time).
  const candidates = await scanTrustGraduationCandidates(supabase);
  const candidate = candidates.find(
    (c) => c.actionKey === actionKey && (c.coworkerId === wi.coworker_id || !c.coworkerId),
  );

  if (!candidate) {
    return { status: "completed", outcome: `No eligible trust graduation candidate found for ${actionKey}` };
  }

  if (!candidate.eligible) {
    const outcome = `Trust promotion no longer eligible for ${actionKey}: ${candidate.reason}`;
    await storeAgentMemory(supabase, {
      coworkerId: wi.coworker_id ?? undefined,
      category: "prior_work",
      subject: `review_trust_promotion: ${actionKey} not eligible`,
      body: outcome,
      relevanceHorizon: "weekly",
    }).catch(() => {});
    return { status: "completed", outcome };
  }

  // The work item surfaces in the operator inbox with the evidence.
  // Human decides whether to approve the promotion via the autonomy policy UI.
  const summary = [
    `Trust promotion proposal for ${actionKey}:`,
    `  Current level: ${candidate.currentLevel}`,
    `  Proposed level: ${candidate.proposedLevel}`,
    `  Approvals: ${candidate.approvalCount}`,
    `  Rejections: ${candidate.rejectionCount}`,
    `  Observation: ${Math.round(
      (Date.now() - new Date(candidate.firstApprovalAt).getTime()) / (24 * 60 * 60 * 1000),
    )}d`,
    `Review this proposal in Settings > Autonomy Policies.`,
  ].join("\n");

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "trust_graduation.review_surfaces",
    entityType: "autonomy_policy",
    entityId: actionKey,
    source: "automation",
    after: {
      current_level: candidate.currentLevel,
      proposed_level: candidate.proposedLevel,
      approval_count: candidate.approvalCount,
      rejection_count: candidate.rejectionCount,
    },
  });

  await storeAgentMemory(supabase, {
    coworkerId: wi.coworker_id ?? undefined,
    category: "prior_work",
    subject: `review_trust_promotion: ${actionKey}`,
    body: summary,
    relevanceHorizon: "weekly",
  }).catch(() => {});

  return { status: "completed", outcome: summary };
};

export function registerTrustGraduationHandlers(): void {
  registerWorkKindHandler("review_trust_promotion", reviewTrustPromotionHandler);
}

import { diffDrafts } from "@/lib/revenue-os/correction-diff";
import {
  LEARNING_PROPOSAL_TYPES,
  type LearningProposal,
} from "@/lib/revenue-os/learning-inbox-types";
import type { DemoBusinessState } from "./business-runtime";
import type { DemoScenarioPack } from "./scenarios";

export interface DemoLearningState {
  proposals: LearningProposal[];
  signals: Array<{
    id: string;
    kind: string;
    details: string;
    category: string;
    remedy: string;
    processed_at: string;
  }>;
}
export const initialDemoLearning = (): DemoLearningState => ({ proposals: [], signals: [] });
const response = (body: unknown, status = 200) => Response.json(body, { status });
/** The same workspace screens run on fictional state. External storage, model
 * inference and worker execution stay explicitly unavailable in the demo. */
export function handleDemoLearning(
  state: DemoLearningState,
  business: DemoBusinessState,
  pack: DemoScenarioPack,
  url: URL,
  method: string,
  body: Record<string, unknown>,
  completedTasks: string[],
) {
  const path = url.pathname;
  if (path === "/api/admin/corrections/detect" && method === "POST") {
    try {
      return response({
        candidate: diffDrafts({
          before: String(body.before ?? ""),
          after: String(body.after ?? ""),
        }),
        simulated: true,
      });
    } catch {
      return response({ error: "Draft comparison exceeds its supported size" }, 400);
    }
  }
  if (path === "/api/admin/knowledge/documents")
    return method === "GET"
      ? response({ documents: [], simulated: true })
      : response(
          {
            error:
              "Private file uploads require your own workspace. The fictional demo does not store your documents.",
          },
          422,
        );
  if (path === "/api/admin/learning/signals" && method === "GET")
    return response({ signals: state.signals, simulated: true });
  if (path === "/api/admin/learning" && method === "GET")
    return response({
      proposals: state.proposals.filter(
        (p) => !url.searchParams.get("status") || p.status === url.searchParams.get("status"),
      ),
      displaced: [],
      simulated: true,
    });
  if (
    (path === "/api/admin/learning" || path === "/api/admin/learning/signals") &&
    method === "POST"
  ) {
    const type = path.endsWith("signals") ? "messaging" : body.type;
    if (
      !LEARNING_PROPOSAL_TYPES.includes(type as never) ||
      typeof body.rule !== "string" ||
      !body.rule.trim() ||
      body.rule.length > 10000
    )
      return response({ error: "Choose a proposal type and a rule up to 10000 characters" }, 400);
    let proposal = state.proposals.find((p) => p.rule === body.rule && p.proposal_type === type);
    if (!proposal) {
      if (state.proposals.length >= 50)
        return response({ error: "Reset the demo before adding more proposals" }, 409);
      proposal = {
        id: crypto.randomUUID(),
        tenant_id: pack.id,
        proposal_type: type as LearningProposal["proposal_type"],
        rule: body.rule,
        rationale: String(body.rationale ?? body.details ?? ""),
        scope: null,
        confidence: "low",
        conflicts: null,
        affected_workers: Array.isArray(body.affectedWorkers)
          ? body.affectedWorkers.filter((v): v is string => typeof v === "string")
          : [],
        supersedes_policy_id: null,
        source_refs: { demo: true },
        authority: "working",
        status: "proposed",
        dedupe_key: body.rule,
        learned_policy_id: null,
        approval_action_id: null,
        created_at: new Date().toISOString(),
        decided_at: null,
      };
      state.proposals.unshift(proposal);
      if (path.endsWith("signals"))
        state.signals.unshift({
          id: crypto.randomUUID(),
          kind: String(body.kind),
          details: proposal.rationale,
          category: "guidance",
          remedy: "Review the proposed correction in Learning Inbox.",
          processed_at: new Date().toISOString(),
        });
    }
    return response({ proposal, simulated: true });
  }
  if (path.startsWith("/api/admin/learning/") && method === "PUT") {
    const p = state.proposals.find((p) => p.id === path.split("/").at(-1));
    if (!p) return response({ error: "Proposal not found" }, 404);
    if (body.action === "request-approval") {
      if (p.status !== "proposed")
        return response({ error: "Only proposed learning can enter approvals" }, 409);
      if (!p.approval_action_id) {
        p.approval_action_id = crypto.randomUUID();
        business.actions.unshift({
          id: p.approval_action_id,
          action_type: "approve_learning",
          title: "Approve learning: " + p.rule.slice(0, 100),
          description: p.rationale,
          status: "pending",
          error: null,
          payload: { proposalId: p.id },
          result: null,
          pluginId: "core",
          created_at: new Date().toISOString(),
        });
      }
    } else if (
      ["rejected", "ignored", "conversation_only", "proposed"].includes(String(body.disposition)) &&
      p.status !== "approved"
    )
      p.status = body.disposition as LearningProposal["status"];
    else return response({ error: "Invalid learning decision" }, 400);
    return response({ proposal: p, simulated: true });
  }
  if (path === "/api/admin/revenue-os/actions" && method === "PATCH") {
    const a = business.actions.find(
      (a) => a.id === body.id && a.action_type === "approve_learning",
    );
    if (!a) return null;
    const p = state.proposals.find((p) => p.id === a.payload.proposalId);
    if (!p || a.status !== "pending" || !["approve", "reject"].includes(String(body.decision)))
      return response({ error: "Learning action is unavailable or already handled" }, 409);
    a.status = body.decision === "approve" ? "executed" : "rejected";
    p.status = body.decision === "approve" ? "approved" : "rejected";
    if (p.status === "approved") {
      p.authority = "approved";
      p.learned_policy_id = crypto.randomUUID();
    }
    p.decided_at = new Date().toISOString();
    a.result = { simulated: true, proposalId: p.id };
    return response({ action: a, simulated: true });
  }
  if (path === "/api/admin/get-started" && method === "GET") {
    const opportunity = pack.opportunities[0];
    const result = pack.tasks.some(
      (t) =>
        t.personId === opportunity?.personId &&
        (t.status === "completed" || completedTasks.includes(t.id)),
    );
    const items = [
      [
        "workspace",
        "Confirm your business",
        "Review the fictional workspace identity.",
        "branding",
        true,
      ],
      [
        "inquiry",
        "Add an inquiry and opportunity",
        "Open the fictional inquiry in Pipeline.",
        "pipeline",
        !!opportunity,
      ],
      [
        "reference",
        "Add a business reference",
        "Upload a reference in your own workspace. Private uploads are unavailable in the demo.",
        "learning",
        false,
      ],
      [
        "next_action",
        "Give the inquiry a dated next step",
        "Review the inquiry and its linked task.",
        "work",
        !!opportunity?.nextAction,
      ],
      [
        "result",
        "Complete the follow-up task",
        "Complete a fictional follow-up task to see saved progress.",
        "work",
        result,
      ],
      [
        "correction",
        "Review a reusable correction",
        "Propose a rule in Learning Inbox, then approve it in Tasks & approvals.",
        "learning",
        state.proposals.some((p) => p.status === "approved"),
      ],
      [
        "reuse",
        "Check guidance in later work",
        "Use your own workspace to verify guidance in a real model run.",
        "ai",
        false,
      ],
    ];
    return response({
      simulated: true,
      opportunityId: opportunity?.id ?? null,
      generatedAt: new Date().toISOString(),
      steps: items.map(([id, title, description, href, complete]) => ({
        id,
        title,
        description,
        href: "/admin/" + href,
        complete,
        receiptId: null,
      })),
      readiness: [
        "AI connection",
        "Document index",
        "Retrieval",
        "Model execution",
        "Scheduler",
        "Follow-up outcome",
      ].map((label) => ({
        label,
        state: "demo",
        detail: "Fictional workspace. Verify this capability in your own installation.",
      })),
    });
  }
  return null;
}

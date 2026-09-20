import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";

export interface FirstUseStep {
  id: string;
  title: string;
  description: string;
  href: string;
  complete: boolean;
  receiptId: string | null;
}
export interface FirstUseProgress {
  steps: FirstUseStep[];
  readiness: Array<{ label: string; state: string; detail: string }>;
  opportunityId: string | null;
  generatedAt: string;
}
/** Progress is derived from persisted business records, never browser checkboxes.
 * Invited tenants and self-hosted owners use exactly the same service. */
export async function getFirstUseProgress(db: SupabaseClient): Promise<FirstUseProgress> {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("First-use progress requires a tenant workspace");
  const results = await Promise.all([
    db.from("tenants").select("id,name,status").eq("id", tenantId).single(),
    db
      .from("opportunities")
      .select("id,contact_id,next_action,name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from("knowledge_documents")
      .select("id,status")
      .eq("status", "indexed")
      .limit(1)
      .maybeSingle(),
    db
      .from("learning_proposals")
      .select("id,learned_policy_id,decided_at")
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(20),
    db
      .from("agent_run_events")
      .select("id,output,created_at")
      .eq("event_type", "context_loaded")
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("integration_connections")
      .select("provider,status")
      .in("provider", ["openrouter", "google"]),
    db
      .from("job_runs")
      .select("id,status,finished_at")
      .eq("job_key", "work-engine")
      .order("claimed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("agent_runs")
      .select("id,status,finished_at")
      .eq("provider", "openrouter")
      .eq("status", "completed")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("agent_run_events")
      .select("id,output")
      .eq("tool_name", "search_knowledge_base")
      .eq("event_type", "tool_result")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Progress could not be verified. Check workspace migrations and retry.");
  const [
    workspace,
    opportunity,
    document,
    learnings,
    contexts,
    connections,
    scheduler,
    model,
    retrievals,
  ] = results;
  if (workspace.data?.status !== "active") throw new Error("Workspace is not active");
  const opportunityId = opportunity.data?.id ?? null;
  // Ask whether proof exists rather than looking through the latest tasks:
  // adding more work must not erase an earlier completed onboarding result.
  const taskResults = opportunityId
    ? await Promise.all([
        db
          .from("tasks")
          .select("id")
          .eq("related_type", "opportunity")
          .eq("related_id", opportunityId)
          .not("due_date", "is", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        db
          .from("tasks")
          .select("id")
          .eq("related_type", "opportunity")
          .eq("related_id", opportunityId)
          .eq("status", "completed")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])
    : [];
  if (taskResults.some((result) => result.error))
    throw new Error("Linked task progress could not be verified");
  const task = taskResults[0]?.data;
  const completed = taskResults[1]?.data;
  const reused = contexts.data?.find((context) =>
    learnings.data?.some(
      (proposal) =>
        proposal.learned_policy_id &&
        context.created_at >= proposal.decided_at &&
        Array.isArray(context.output?.guidance) &&
        context.output.guidance.some(
          (item: { id?: string }) => item.id === proposal.learned_policy_id,
        ),
    ),
  );
  const connection = (provider: string) =>
    connections.data?.find((c) => c.provider === provider)?.status === "connected";
  const retrieval = retrievals.data?.find((event) => event.output?.result?.found === true);
  const schedulerRecent =
    scheduler.data?.status === "success" &&
    scheduler.data.finished_at &&
    Date.now() - Date.parse(scheduler.data.finished_at) < 24 * 60 * 60 * 1000;
  return {
    opportunityId,
    generatedAt: new Date().toISOString(),
    steps: [
      {
        id: "workspace",
        title: "Confirm your business",
        description:
          "Review the workspace identity and your access. Hosted owners enter through their invitation; self-hosted owners use the installation setup.",
        href: "/admin/branding",
        complete: Boolean(workspace.data?.name),
        receiptId: workspace.data?.id ?? null,
      },
      {
        id: "inquiry",
        title: "Add an inquiry and opportunity",
        description:
          "Import or create a contact, then create a linked opportunity in Pipeline. This checklist follows your first saved opportunity.",
        href: "/admin/pipeline",
        complete: Boolean(opportunityId && opportunity.data?.contact_id),
        receiptId: opportunityId,
      },
      {
        id: "reference",
        title: "Add a business reference",
        description:
          "Upload a service description or policy in Learning Inbox and wait for its Searchable status.",
        href: "/admin/learning",
        complete: Boolean(document.data),
        receiptId: document.data?.id ?? null,
      },
      {
        id: "next_action",
        title: "Give the inquiry a dated next step",
        description:
          "Record a next action on the opportunity and create a dated task linked to it. Tasks work without AI or email credentials.",
        href: "/admin/work",
        complete: Boolean(opportunity.data?.next_action && task),
        receiptId: task?.id ?? null,
      },
      {
        id: "result",
        title: "Complete the follow-up task",
        description:
          "Do the work, then mark the linked task complete and inspect its saved result. A queued draft is not a completed follow-up.",
        href: "/admin/work",
        complete: Boolean(completed),
        receiptId: completed?.id ?? null,
      },
      {
        id: "correction",
        title: "Review a reusable correction",
        description:
          "Propose a general rule in Learning Inbox or save a correction from an edited reply. Approve it through Tasks & approvals.",
        href: "/admin/learning",
        complete: Boolean(learnings.data?.length),
        receiptId: learnings.data?.[0]?.id ?? null,
      },
      {
        id: "reuse",
        title: "Check guidance in later work",
        description:
          "Run another AI task after approval. Its context receipt records which rules were supplied. Review the result to judge whether it improved.",
        href: "/admin/ai",
        complete: Boolean(reused),
        receiptId: reused?.id ?? null,
      },
    ],
    readiness: [
      {
        label: "AI connection",
        state: connection("openrouter") ? "connected" : "optional",
        detail: "Needed for AI drafts; manual task completion does not require it.",
      },
      {
        label: "Document index",
        state: document.data ? "verified" : "not verified",
        detail: "Verified only after at least one uploaded reference is indexed.",
      },
      {
        label: "Retrieval",
        state: retrieval ? "verified" : "not verified",
        detail: "Verified by a saved knowledge-search result containing evidence.",
      },
      {
        label: "Model execution",
        state: model.data ? "verified" : "not verified",
        detail: "A completed model run is separate from a configured API key.",
      },
      {
        label: "Scheduler",
        state: schedulerRecent ? "verified" : "not verified",
        detail: "Requires a successful work-engine receipt in the last 24 hours.",
      },
      {
        label: "Follow-up outcome",
        state: completed ? "verified" : "not verified",
        detail: "Requires a completed task linked to the opportunity used in this checklist.",
      },
    ],
  };
}

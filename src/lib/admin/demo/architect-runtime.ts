import {
  blueprintPatchSchema,
  blueprintProposalSchema,
  blueprintSimulationSchema,
  proposalToTypedPatch,
} from "@/lib/revenue-os/architect-review-contract";
import { DEMO_BLUEPRINT_DETAIL } from "./blueprint-fixture";
import { demoBusinessDigest, type DemoBusinessState } from "./business-runtime";

type ArchitectState = {
  blueprintEdits?: {
    version: number;
    summary: string;
    changeSummary: string;
    createdAt: string;
  } | null;
};

/** Fictional draft review only. The original demo's approved apply path remains separate. */
export async function handleDemoArchitect(
  state: ArchitectState,
  business: DemoBusinessState,
  path: string,
  method: string,
  body: Record<string, unknown>,
  save: () => void,
): Promise<Response | null> {
  const target = path.match(/^\/api\/admin\/blueprints\/([^/]+)\/(patch|simulate)$/);
  const action =
    path === "/api/admin/revenue-os/actions" && method === "PATCH"
      ? business.actions.find(
          (item) => item.id === body.id && item.action_type === "blueprint_draft_change",
        )
      : undefined;
  if (!target && !action) return null;
  const respond = (value: object, status = 200) =>
    Response.json({ ...value, simulated: true }, { status });
  try {
    if (method !== "POST" && !action)
      return respond({ error: "Unsupported Blueprint operation" }, 405);
    if (target && target[1] !== DEMO_BLUEPRINT_DETAIL.blueprintId)
      return respond({ error: "Blueprint not found in this fictional workspace" }, 404);
    const version = state.blueprintEdits?.version ?? DEMO_BLUEPRINT_DETAIL.version;
    const before = {
      ...DEMO_BLUEPRINT_DETAIL.document,
      businessSummary:
        state.blueprintEdits?.summary ?? DEMO_BLUEPRINT_DETAIL.document.businessSummary,
    };
    if (action) {
      if (!["approve", "reject"].includes(String(body.decision)))
        return respond({ error: "Choose an exact decision" }, 400);
      if (
        action.status !== "pending" ||
        !action.expires_at ||
        Date.parse(action.expires_at) <= Date.now()
      )
        return respond({ error: "This proposal is already handled or expired" }, 409);
      if (body.decision === "reject") {
        action.status = "rejected";
        save();
        return respond({ result: { message: "Blueprint change rejected." } });
      }
      const command = blueprintPatchSchema.parse(action.payload.command);
      if (command.expectedVersion !== version)
        return respond(
          { error: "Blueprint version conflict. Reload before reviewing again." },
          409,
        );
      const next = action.payload.next as { businessSummary: string };
      state.blueprintEdits = {
        version: version + 1,
        summary: next.businessSummary,
        changeSummary: command.changeSummary,
        createdAt: new Date().toISOString(),
      };
      action.status = "executed";
      action.result = {
        blueprintId: command.blueprintId,
        version: version + 1,
        applied: false,
        message: `Simulated · Blueprint draft version ${version + 1} saved. No live changes were made.`,
      };
      save();
      return respond({ result: action.result });
    }
    if (target?.[2] === "simulate") {
      const input = blueprintSimulationSchema.parse({ ...body, blueprintId: target[1] });
      const workflows = DEMO_BLUEPRINT_DETAIL.document.workflows as Array<{
        key: string;
        trigger: { ref: string };
        steps: Array<{ key: string; description: string }>;
      }>;
      return respond({
        kind: "simulation",
        writes: [],
        sends: [],
        moduleEnablement: [],
        traces: workflows
          .filter((item) => !input.event || item.trigger.ref.includes(input.event))
          .map((item) => ({
            workflowKey: item.key,
            event: item.trigger.ref,
            steps: item.steps.map((step) => ({
              ...step,
              outcome: "Would inspect this step. No live send or write.",
            })),
          })),
        plan: {
          ready: [],
          approvals: DEMO_BLUEPRINT_DETAIL.approvals,
          blocked: DEMO_BLUEPRINT_DETAIL.blocked,
        },
      });
    }
    const { mode, ...raw } = body;
    if (mode !== "preview" && mode !== "propose")
      return respond({ error: "Choose preview or propose" }, 400);
    const parsed =
      mode === "preview"
        ? blueprintPatchSchema.parse({ ...raw, blueprintId: target![1] })
        : blueprintProposalSchema.parse({ ...raw, blueprintId: target![1] });
    const { digest: expected, ...command } = parsed as typeof parsed & { digest?: string };
    const prior = business.actions.find(
      (item) =>
        item.action_type === "blueprint_draft_change" &&
        (item.payload.command as { requestId?: string })?.requestId === command.requestId,
    );
    if (mode === "propose" && prior) {
      if (prior.payload.digest !== expected)
        return respond({ error: "Blueprint request identity conflict" }, 409);
      return respond(prior);
    }
    if (command.expectedVersion !== version)
      return respond({ error: "Blueprint version conflict. Reload before reviewing again." }, 409);
    const patch = proposalToTypedPatch(command.proposal);
    if (
      Object.keys(patch).some((key) => key !== "businessSummary") ||
      typeof patch.businessSummary !== "string" ||
      !patch.businessSummary.trim() ||
      patch.businessSummary.length > 4000
    )
      return respond(
        {
          error:
            "This fictional scenario supports business summary patches. The connected Blueprint schema supports additional sections.",
        },
        400,
      );
    const next = { ...before, businessSummary: patch.businessSummary };
    const review = {
      Operation: "Save a new Blueprint draft version",
      "Current version": String(version),
      "Change summary": command.changeSummary,
      "Current business summary": String(before.businessSummary),
      "Proposed business summary": next.businessSummary,
      Consequence:
        "Saves a fictional draft version. It does not apply the workspace, enable modules or send messages.",
    };
    const preview = {
      command,
      before,
      next,
      review,
      diff: {
        added: [],
        removed: [],
        changed: before.businessSummary === next.businessSummary ? [] : ["businessSummary"],
      },
      digest: await demoBusinessDigest({ command, before, next, review }),
    };
    if (mode === "preview") return respond(preview);
    if (preview.digest !== expected)
      return respond({ error: "Blueprint details changed. Prepare a fresh review." }, 409);
    const proposed = {
      id: crypto.randomUUID(),
      action_type: "blueprint_draft_change",
      title: review.Operation,
      description: review.Consequence,
      status: "pending",
      error: null,
      payload: preview,
      result: null,
      pluginId: "core-intelligence",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
    business.actions.unshift(proposed);
    save();
    return respond(proposed);
  } catch (error) {
    return respond(
      { error: error instanceof Error ? error.message : "Blueprint simulation failed" },
      422,
    );
  }
}

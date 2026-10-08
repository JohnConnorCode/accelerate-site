import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KanbanBoardKey } from "../kanban/types";
import {
  compileBlueprintPlan,
  type BlueprintCompilePlan,
  type CustomAppBrief,
} from "./workspace-blueprint-compiler";
import {
  parseBlueprint,
  collectBlueprintLiveContext,
  type BlueprintLiveContext,
  type CapabilityStatus,
  type WorkspaceBlueprint,
} from "./workspace-blueprint";

/**
 * Workspace Architect — Generated Operations.
 *
 * The Architect never invents a second board, task-status model, or approval
 * runtime. This module composes a reviewed operating setup — boards, views,
 * navigation, workflow proposals and Coworker recommendations — entirely from
 * an approved or applied Blueprint over the existing Kanban board/column
 * primitive (`kanban_columns`), capability-cited recommendations (never
 * unregistered action types),
 * and the compiler's own capability validation. Unknown capabilities remain
 * Custom App Briefs (never a guessed primitive); unmapped board source types
 * remain unsupported rather than being forced onto the platform Feature
 * Board's fixed lifecycle.
 *
 * OWNERSHIP: this is the only module that turns a Blueprint into board
 * columns, workflow proposals and Coworker recommendations. Callers (admin
 * routes, AI tools) call `generateWorkspaceOperations`; they never write
 * `kanban_columns` or `action_queue` rows for this purpose directly.
 */

// ---------------------------------------------------------------------------
// Reuse boundary: only entity source types with an existing Kanban board are
// eligible for a generated board. Everything else is a view/nav-only
// projection or a Custom App Brief — never a forced Task-status board.
// ---------------------------------------------------------------------------

const SOURCE_TYPE_TO_KANBAN_BOARD: Partial<Record<string, KanbanBoardKey>> = {
  opportunity: "pipeline",
  content: "content",
};

function resolveKanbanBoard(sourceType: string): KanbanBoardKey | null {
  return SOURCE_TYPE_TO_KANBAN_BOARD[sourceType] ?? null;
}

export type GeneratedItemStatus = "ready" | "blocked" | "unsupported";

export interface GeneratedNavigationItem {
  ref: string;
  label: string;
  targetType: string;
  targetKey: string;
  status: GeneratedItemStatus;
  reason: string | null;
}

export interface GeneratedBoardColumn {
  columnKey: string;
  label: string;
  /**
   * Descriptive projection only. The authoritative lifecycle state remains
   * the source entity's own status/stage column; this list documents which
   * states this column represents, it does not create a second one (AC3).
   */
  lifecycleStates: string[];
}

export interface GeneratedBoardOperation {
  ref: string;
  blueprintBoardKey: string;
  name: string;
  sourceType: string;
  targetBoardKey: KanbanBoardKey | null;
  columns: GeneratedBoardColumn[];
  status: GeneratedItemStatus;
  reason: string | null;
}

export interface GeneratedViewOperation {
  ref: string;
  name: string;
  sourceType: string;
  filters: Record<string, unknown>[];
  sort: string[];
  columns: string[];
  status: GeneratedItemStatus;
  reason: string | null;
}

export interface GeneratedWorkflowStepCitation {
  key: string;
  kind: string;
  capabilityKey: string | null;
  status: GeneratedItemStatus;
  reason: string | null;
}

export interface GeneratedWorkflowProposal {
  ref: string;
  key: string;
  name: string;
  triggerRef: string;
  steps: GeneratedWorkflowStepCitation[];
  approvalRequired: boolean;
  status: GeneratedItemStatus;
  dedupeKey: string;
}

export interface GeneratedCoworkerRecommendation {
  ref: string;
  key: string;
  name: string;
  purpose: string;
  requiredCapabilities: string[];
  missingCapabilities: string[];
  autonomyPolicy: string;
  status: GeneratedItemStatus;
  dedupeKey: string;
}

export interface WorkspaceOperationsPlan {
  navigation: GeneratedNavigationItem[];
  boards: GeneratedBoardOperation[];
  views: GeneratedViewOperation[];
  workflows: GeneratedWorkflowProposal[];
  coworkers: GeneratedCoworkerRecommendation[];
  customAppBriefs: CustomAppBrief[];
  canApply: boolean;
}

function statusFromRef(
  ref: string,
  compiled: BlueprintCompilePlan,
): { status: GeneratedItemStatus; reason: string | null } {
  const blocked = compiled.blocked.find((item) => item.ref === ref);
  if (blocked) return { status: "blocked", reason: blocked.reason };
  const unsupported = compiled.customAppBriefs.find((brief) =>
    brief.id.startsWith(`brief:${ref}:`),
  );
  if (unsupported) return { status: "blocked", reason: unsupported.why };
  return { status: "ready", reason: null };
}

/**
 * Pure planning: from an approved Blueprint + its live capability context,
 * compose the generated-operations proposal. No I/O. Deterministic for the
 * same (blueprint, context) pair, so calling it twice never disagrees with
 * itself — the async apply step below is what makes re-generation idempotent
 * against the database.
 */
export function planWorkspaceOperations(
  blueprint: WorkspaceBlueprint,
  context: BlueprintLiveContext,
): WorkspaceOperationsPlan {
  const compiled = compileBlueprintPlan(blueprint, context);
  const capabilityByKey = new Map<string, CapabilityStatus>(
    context.capabilities.map((entry) => [entry.key, entry]),
  );
  const entityTypes = new Set(context.entityTypes);

  const navigation: GeneratedNavigationItem[] = blueprint.navigation.map((item) => {
    const resolved = statusFromRef(`navigation:${item.label}`, compiled);
    return {
      ref: `navigation:${item.label}`,
      label: item.label,
      targetType: item.targetType,
      targetKey: item.targetKey,
      status: resolved.status,
      reason: resolved.reason,
    };
  });

  const additionalUnsupportedBriefs: CustomAppBrief[] = [];
  const boards: GeneratedBoardOperation[] = blueprint.boards.map((board) => {
    const ref = `board:${board.key}`;
    if (!entityTypes.has(board.sourceType)) {
      const resolved = statusFromRef(ref, compiled);
      return {
        ref,
        blueprintBoardKey: board.key,
        name: board.name,
        sourceType: board.sourceType,
        targetBoardKey: null,
        columns: board.columns.map((column) => ({
          columnKey: column.key,
          label: column.label,
          lifecycleStates: column.lifecycleStates,
        })),
        status: resolved.status,
        reason: resolved.reason,
      };
    }
    const targetBoardKey = resolveKanbanBoard(board.sourceType);
    if (!targetBoardKey) {
      additionalUnsupportedBriefs.push({
        id: `brief:board:${board.key}`,
        title: `Custom App Brief for board "${board.name}"`,
        missingKey: `board_lifecycle:${board.sourceType}`,
        why: `No existing Kanban board projects "${board.sourceType}"; a lifecycle board cannot reuse an existing primitive here.`,
        boundary:
          "Keep using existing primitives. Do not force this onto the platform Feature Board's Task lifecycle or invent a second board runtime. A bounded Custom App can be designed later if this stays a real requirement.",
      });
      return {
        ref,
        blueprintBoardKey: board.key,
        name: board.name,
        sourceType: board.sourceType,
        targetBoardKey: null,
        columns: board.columns.map((column) => ({
          columnKey: column.key,
          label: column.label,
          lifecycleStates: column.lifecycleStates,
        })),
        status: "unsupported",
        reason: `No Kanban board is registered for source type "${board.sourceType}"`,
      };
    }
    return {
      ref,
      blueprintBoardKey: board.key,
      name: board.name,
      sourceType: board.sourceType,
      targetBoardKey,
      columns: board.columns.map((column) => ({
        columnKey: column.key,
        label: column.label,
        lifecycleStates: column.lifecycleStates,
      })),
      status: "ready",
      reason: null,
    };
  });

  const views: GeneratedViewOperation[] = blueprint.views.map((view) => {
    const ref = `view:${view.key}`;
    const resolved = entityTypes.has(view.sourceType)
      ? statusFromRef(ref, compiled)
      : { status: "blocked" as GeneratedItemStatus, reason: "Unregistered source type" };
    return {
      ref,
      name: view.name,
      sourceType: view.sourceType,
      filters: view.filters,
      sort: view.sort,
      columns: view.columns,
      status: resolved.status,
      reason: resolved.reason,
    };
  });

  const workflows: GeneratedWorkflowProposal[] = blueprint.workflows.map((workflow) => {
    const steps: GeneratedWorkflowStepCitation[] = workflow.steps.map((step) => {
      const stepRef = `workflow:${workflow.key}/step:${step.key}`;
      const resolved = statusFromRef(stepRef, compiled);
      return {
        key: step.key,
        kind: step.kind,
        capabilityKey: step.capabilityKey ?? null,
        status: resolved.status,
        reason: resolved.reason,
      };
    });
    const blockedSteps = steps.filter((step) => step.status === "blocked").length;
    const approvalRequired = workflow.steps.some((step) => {
      if (!step.capabilityKey) return false;
      const capability = capabilityByKey.get(step.capabilityKey);
      return capability?.policy === "approval_required";
    });
    return {
      ref: `workflow:${workflow.key}`,
      key: workflow.key,
      name: workflow.name,
      triggerRef: workflow.trigger.ref,
      steps,
      approvalRequired,
      status:
        blockedSteps > 0 ? "blocked" : statusFromRef(`workflow:${workflow.key}`, compiled).status,
      dedupeKey: `generate-ops:workflow:${workflow.key}`,
    };
  });

  const coworkers: GeneratedCoworkerRecommendation[] = blueprint.coworkers.map((coworker) => {
    const missingCapabilities = coworker.requiredCapabilities.filter((key) => {
      const capability = capabilityByKey.get(key);
      return !capability || !capability.available;
    });
    return {
      ref: `coworker:${coworker.key}`,
      key: coworker.key,
      name: coworker.name,
      purpose: coworker.purpose,
      requiredCapabilities: coworker.requiredCapabilities,
      missingCapabilities,
      autonomyPolicy: coworker.autonomyPolicy,
      status: missingCapabilities.length > 0 ? "blocked" : "ready",
      dedupeKey: `generate-ops:coworker:${coworker.key}`,
    };
  });

  const customAppBriefs = [...compiled.customAppBriefs, ...additionalUnsupportedBriefs];

  return {
    navigation,
    boards,
    views,
    workflows,
    coworkers,
    customAppBriefs,
    canApply: compiled.canApply,
  };
}

// ---------------------------------------------------------------------------
// Apply: idempotent generation against the database. Board columns are
// added to the existing `kanban_columns` table (the same primitive the
// Kanban UI/API reads). Workflows and Coworkers stay capability-cited
// recommendations until a registered executor exists — nothing here
// auto-applies or enqueues an action type the executor cannot run.
// ---------------------------------------------------------------------------

function requireUuid(value: string, field: string): string {
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`${field} must be a UUID`);
  }
  return trimmed;
}

export interface GeneratedOperationsReceipt {
  auditId: string;
  blueprintId: string;
  version: number;
  navigation: GeneratedNavigationItem[];
  boards: Array<GeneratedBoardOperation & { columnsCreated: string[] }>;
  views: GeneratedViewOperation[];
  workflows: Array<GeneratedWorkflowProposal & { actionId: null }>;
  coworkers: Array<GeneratedCoworkerRecommendation & { actionId: null }>;
  customAppBriefs: CustomAppBrief[];
}

export interface GenerateOperationsAdapters {
  collectContext?: (supabase: SupabaseClient, tenantId: string) => Promise<BlueprintLiveContext>;
}

const GENERATION_UNCONFIRMED =
  "Operating setup could not be confirmed. Reload the review, or retry this save.";

export class WorkspaceOperationsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function getGeneratedWorkspaceOperations(
  supabase: SupabaseClient,
  input: { tenantId: string; blueprintId: string; version: number },
): Promise<{
  state: "not_generated" | "saved" | "reconciliation_required";
  receipt: GeneratedOperationsReceipt | null;
}> {
  const { data, error } = await supabase
    .from("workspace_generated_operations")
    .select("id,receipt,audit_id")
    .eq("tenant_id", input.tenantId)
    .eq("blueprint_id", input.blueprintId)
    .eq("version", input.version)
    .maybeSingle();
  if (error)
    throw new WorkspaceOperationsError(
      "generation_unavailable",
      "Operating setup is unavailable. Ask the maintainer to check the installation migrations.",
    );
  if (!data) return { state: "not_generated", receipt: null };
  const receipt = data.receipt as GeneratedOperationsReceipt | null;
  if (
    !data.audit_id ||
    !receipt ||
    receipt?.auditId !== data.audit_id ||
    receipt.blueprintId !== input.blueprintId ||
    receipt.version !== input.version
  ) {
    return { state: "reconciliation_required", receipt: null };
  }
  const { data: audit, error: auditError } = await supabase
    .from("audit_log")
    .select("id,metadata")
    .eq("tenant_id", input.tenantId)
    .eq("id", data.audit_id)
    .eq("action", "workspace_operations.generated")
    .eq("entity_type", "workspace_blueprint")
    .eq("entity_id", input.blueprintId)
    .maybeSingle();
  if (auditError)
    throw new WorkspaceOperationsError(
      "generation_unavailable",
      "Operating setup could not be verified. Reload before trying again.",
    );
  if (!audit || audit.metadata?.operationId !== data.id)
    return { state: "reconciliation_required", receipt: null };
  return { state: "saved", receipt };
}

export async function generateWorkspaceOperations(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    blueprintId: string;
    version: number;
    requestKey: string;
    actorEmail: string;
  },
  adapters: GenerateOperationsAdapters = {},
): Promise<{ replayed: boolean; receipt: GeneratedOperationsReceipt }> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const blueprintId = requireUuid(input.blueprintId, "blueprintId");
  const requestKey = input.requestKey.trim();
  if (!requestKey || requestKey.length > 180) {
    throw new Error("requestKey must be 1 to 180 characters");
  }
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version is required");

  const { data: blueprintRow, error: blueprintError } = await supabase
    .from("workspace_blueprints")
    .select("id,status,latest_version")
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .maybeSingle();
  if (blueprintError || !blueprintRow) throw new Error("Blueprint not found in this workspace");
  const status = (blueprintRow as { status: string }).status;
  const latestVersion = Number((blueprintRow as { latest_version?: number }).latest_version ?? 0);
  if (status !== "applied" && status !== "approved") {
    throw new Error("Only an approved or applied Blueprint can generate operations");
  }
  if (input.version !== latestVersion) {
    throw new Error("version must match the current approved Blueprint version");
  }

  const { data: versionRow, error: versionError } = await supabase
    .from("workspace_blueprint_versions")
    .select("document,version")
    .eq("tenant_id", tenantId)
    .eq("blueprint_id", blueprintId)
    .eq("version", input.version)
    .maybeSingle();
  if (versionError || !versionRow) throw new Error("Blueprint version was not found");
  const document = parseBlueprint((versionRow as { document: unknown }).document);
  const context = await (adapters.collectContext ?? collectBlueprintLiveContext)(
    supabase,
    tenantId,
  );
  const plan = planWorkspaceOperations(document, context);

  // The database rechecks approval under lock and commits columns, receipt,
  // request bindings and audit together. No application-side write can escape it.
  let result;
  try {
    result = await supabase.rpc("generate_workspace_operations", {
      p_tenant_id: tenantId,
      p_blueprint_id: blueprintId,
      p_version: input.version,
      p_request_key: requestKey,
      p_actor_email: input.actorEmail,
      p_document: document,
      p_plan: plan,
    });
  } catch {
    throw new WorkspaceOperationsError("generation_save_failed", GENERATION_UNCONFIRMED);
  }
  const { data, error } = result;
  if (error) {
    const known = (
      [
        [
          "generation_reconciliation_required",
          "A previous setup save needs maintainer reconciliation. Existing columns are preserved.",
        ],
        [
          "generation_request_conflict",
          "This request belongs to a different Blueprint version. Reload before trying again.",
        ],
        [
          "generation_approval_changed",
          "The approved Blueprint changed. Reload and review its current version.",
        ],
        [
          "generation_forbidden",
          "This workspace cannot save operating setup with the current access.",
        ],
      ] as const
    ).find(([code]) => error.message.includes(code));
    throw new WorkspaceOperationsError(
      known?.[0] ?? "generation_save_failed",
      known?.[1] ?? GENERATION_UNCONFIRMED,
    );
  }
  if (!data?.receipt?.auditId)
    throw new WorkspaceOperationsError(
      "generation_save_failed",
      "Operating setup could not be verified. Reload before trying again.",
    );
  return data as { replayed: boolean; receipt: GeneratedOperationsReceipt };
}

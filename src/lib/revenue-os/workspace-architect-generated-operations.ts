import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { proposeAction } from "./actions";
import { recordAudit } from "./audit";
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
 * runtime. This module composes the visible "wow moment" — boards, views,
 * navigation, workflow proposals and Coworker recommendations — entirely from
 * an approved+applied Blueprint over the existing Kanban board/column
 * primitive (`kanban_columns`), the existing approval queue (`proposeAction`),
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
      status: blockedSteps > 0 ? "blocked" : "ready",
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
// Kanban UI/API reads); workflow and Coworker proposals go through the
// existing approval queue (`proposeAction`) — nothing here auto-applies.
// ---------------------------------------------------------------------------

function requireUuid(value: string, field: string): string {
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`${field} must be a UUID`);
  }
  return trimmed;
}

export interface GeneratedOperationsReceipt {
  blueprintId: string;
  version: number;
  navigation: GeneratedNavigationItem[];
  boards: Array<GeneratedBoardOperation & { columnsCreated: string[] }>;
  views: GeneratedViewOperation[];
  workflows: Array<{ ref: string; key: string; actionId: string | null; status: GeneratedItemStatus }>;
  coworkers: Array<{ ref: string; key: string; actionId: string | null; status: GeneratedItemStatus }>;
  customAppBriefs: CustomAppBrief[];
}

export interface GenerateOperationsAdapters {
  collectContext?: (supabase: SupabaseClient, tenantId: string) => Promise<BlueprintLiveContext>;
  proposeAction?: typeof proposeAction;
}

async function ensureBoardColumns(
  supabase: SupabaseClient,
  tenantId: string,
  boardKey: KanbanBoardKey,
  columns: GeneratedBoardColumn[],
): Promise<string[]> {
  if (columns.length === 0) return [];
  const { data: existing, error: existingError } = await supabase
    .from("kanban_columns")
    .select("column_key,sort_order")
    .eq("board_key", boardKey)
    .eq("tenant_id", tenantId);
  if (existingError) throw new Error(`Reading kanban columns failed: ${existingError.message}`);
  const existingKeys = new Set(
    ((existing ?? []) as Array<{ column_key: string }>).map((row) => row.column_key),
  );
  let maxSortOrder = ((existing ?? []) as Array<{ sort_order: number }>).reduce(
    (max, row) => Math.max(max, Number(row.sort_order) || 0),
    0,
  );
  const created: string[] = [];
  for (const column of columns) {
    if (existingKeys.has(column.columnKey)) continue;
    maxSortOrder += 1000;
    const { error } = await supabase.from("kanban_columns").insert({
      board_key: boardKey,
      tenant_id: tenantId,
      column_key: column.columnKey,
      label: column.label,
      color: null,
      sort_order: maxSortOrder,
      is_default: false,
      // Documents which lifecycle states this column projects; the source
      // entity's own status/stage column remains authoritative (AC3).
      metadata: { generatedFrom: "workspace_blueprint", lifecycleStates: column.lifecycleStates },
    });
    if (error) {
      if ((error as { code?: string }).code === "23505") continue; // concurrent create
      throw new Error(`Creating kanban column ${column.columnKey} failed: ${error.message}`);
    }
    existingKeys.add(column.columnKey);
    created.push(column.columnKey);
  }
  return created;
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
  if (!requestKey) throw new Error("requestKey is required");
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error("version is required");

  const { data: existing } = await supabase
    .from("workspace_generated_operations")
    .select("receipt")
    .eq("tenant_id", tenantId)
    .eq("request_key", requestKey)
    .maybeSingle();
  if (existing?.receipt) {
    return { replayed: true, receipt: existing.receipt as GeneratedOperationsReceipt };
  }

  // Generating twice for the same approved version must not duplicate boards
  // or workflows: a prior successful generation for this exact version wins,
  // even under a different request key (e.g. a retried operator click).
  const { data: existingForVersion } = await supabase
    .from("workspace_generated_operations")
    .select("receipt")
    .eq("tenant_id", tenantId)
    .eq("blueprint_id", blueprintId)
    .eq("version", input.version)
    .maybeSingle();
  if (existingForVersion?.receipt) {
    return { replayed: true, receipt: existingForVersion.receipt as GeneratedOperationsReceipt };
  }

  const { data: blueprintRow, error: blueprintError } = await supabase
    .from("workspace_blueprints")
    .select("id,status")
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .maybeSingle();
  if (blueprintError || !blueprintRow) throw new Error("Blueprint not found in this workspace");
  const status = (blueprintRow as { status: string }).status;
  if (status !== "applied" && status !== "approved") {
    throw new Error("Only an approved or applied Blueprint can generate operations");
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

  const propose = adapters.proposeAction ?? proposeAction;

  const boardsWithColumns: Array<GeneratedBoardOperation & { columnsCreated: string[] }> = [];
  for (const board of plan.boards) {
    if (board.status === "ready" && board.targetBoardKey) {
      const columnsCreated = await ensureBoardColumns(
        supabase,
        tenantId,
        board.targetBoardKey,
        board.columns,
      );
      boardsWithColumns.push({ ...board, columnsCreated });
    } else {
      boardsWithColumns.push({ ...board, columnsCreated: [] });
    }
  }

  const workflows: GeneratedOperationsReceipt["workflows"] = [];
  for (const workflow of plan.workflows) {
    if (workflow.status !== "ready") {
      workflows.push({ ref: workflow.ref, key: workflow.key, actionId: null, status: workflow.status });
      continue;
    }
    const dedupeKey = `generated-operations:${blueprintId}:v${input.version}:workflow:${workflow.key}`;
    const capabilityCitations = workflow.steps
      .map((step) => step.capabilityKey)
      .filter((key): key is string => Boolean(key));
    const action = await propose(supabase, {
      actionType: "generate_workspace_workflow",
      title: `Enable workflow: ${workflow.name}`,
      description: `Generated from Blueprint ${blueprintId} v${input.version}. Cites capabilities: ${
        capabilityCitations.join(", ") || "none"
      }.`,
      payload: {
        blueprintId,
        version: input.version,
        workflowKey: workflow.key,
        triggerRef: workflow.triggerRef,
        capabilityCitations,
        approvalRequired: workflow.approvalRequired,
      },
      sourceContext: "workspace-architect-generated-operations",
      entityType: "workspace_blueprint",
      entityId: blueprintId,
      dedupeKey,
      proposedBy: input.actorEmail,
      evidence: { steps: workflow.steps },
    });
    workflows.push({
      ref: workflow.ref,
      key: workflow.key,
      actionId: (action as { id?: string } | null)?.id ?? null,
      status: "ready",
    });
  }

  const coworkers: GeneratedOperationsReceipt["coworkers"] = [];
  for (const coworker of plan.coworkers) {
    if (coworker.status !== "ready") {
      coworkers.push({ ref: coworker.ref, key: coworker.key, actionId: null, status: coworker.status });
      continue;
    }
    const dedupeKey = `generated-operations:${blueprintId}:v${input.version}:coworker:${coworker.key}`;
    const action = await propose(supabase, {
      actionType: "recommend_workspace_coworker",
      title: `Recommend Coworker: ${coworker.name}`,
      description: `Generated from Blueprint ${blueprintId} v${input.version}. Purpose: ${coworker.purpose}. Cites capabilities: ${
        coworker.requiredCapabilities.join(", ") || "none"
      }.`,
      payload: {
        blueprintId,
        version: input.version,
        coworkerKey: coworker.key,
        requiredCapabilities: coworker.requiredCapabilities,
        autonomyPolicy: coworker.autonomyPolicy,
      },
      sourceContext: "workspace-architect-generated-operations",
      entityType: "workspace_blueprint",
      entityId: blueprintId,
      dedupeKey,
      proposedBy: input.actorEmail,
    });
    coworkers.push({
      ref: coworker.ref,
      key: coworker.key,
      actionId: (action as { id?: string } | null)?.id ?? null,
      status: "ready",
    });
  }

  const receipt: GeneratedOperationsReceipt = {
    blueprintId,
    version: input.version,
    navigation: plan.navigation,
    boards: boardsWithColumns,
    views: plan.views,
    workflows,
    coworkers,
    customAppBriefs: plan.customAppBriefs,
  };

  const { error: insertError } = await supabase.from("workspace_generated_operations").insert({
    tenant_id: tenantId,
    blueprint_id: blueprintId,
    version: input.version,
    request_key: requestKey,
    receipt,
  });
  if (insertError) {
    if ((insertError as { code?: string }).code === "23505") {
      const { data: replayed } = await supabase
        .from("workspace_generated_operations")
        .select("receipt")
        .eq("tenant_id", tenantId)
        .eq("request_key", requestKey)
        .maybeSingle();
      if (replayed?.receipt)
        return { replayed: true, receipt: replayed.receipt as GeneratedOperationsReceipt };
    }
    throw new Error(insertError.message);
  }

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "workspace_operations.generated",
    entityType: "workspace_blueprint",
    entityId: blueprintId,
    source: "admin",
    after: {
      version: input.version,
      boards: boardsWithColumns.length,
      workflows: workflows.length,
      coworkers: coworkers.length,
    },
  });

  return { replayed: false, receipt };
}

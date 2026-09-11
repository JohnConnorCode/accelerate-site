import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { recordAudit } from "./audit";
import { listWorkspaceCapabilities } from "./capabilities";
import { getActiveModules } from "./modules";
import { listEntityTypeKeys } from "./entity-registry";

/**
 * Workspace Architect — Blueprint Foundation (WA-01).
 *
 * The Architect works as a compiler, not a free-form generator: AI proposes a
 * machine-readable WorkspaceBlueprint, deterministic services validate it
 * against live capabilities, a human approves a version, and only then does a
 * compiler apply it through existing domain services.
 *
 * This module owns:
 * - the versioned WorkspaceBlueprint document schema (spec §8),
 * - the fact / inference / recommendation / missing classification (spec §9),
 * - capability-aware validation that fails closed on unknown commands
 *   (spec §21, §35.7–8),
 * - preflight summaries, diffs, and impact analysis (spec §25, §28, §29),
 * - append-only versioned persistence (spec §27).
 *
 * OWNERSHIP: every Blueprint write goes through this module. Reads are
 * tenant-scoped. Secrets must never appear inside Blueprint JSON (spec §35.11);
 * persistence refuses documents whose keys look like credentials.
 */

export const BLUEPRINT_SCHEMA_VERSION = "workspace-blueprint.v1" as const;

// ---------------------------------------------------------------------------
// Classification (§9): every major recommendation carries exactly one kind.
// A verified fact must cite source evidence with a direct quote; anything
// else must not masquerade as one.
// ---------------------------------------------------------------------------

export const EvidenceKindSchema = z.enum(["fact", "inference", "recommendation", "missing"]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceRefSchema = z
  .object({
    kind: EvidenceKindSchema,
    statement: z.string().min(1).max(2000),
    /** Provenance links back to the original source (spec §37). */
    sources: z.array(z.string().min(1).max(500)).min(1).max(25),
    /** Direct supporting quote; required for verified facts. */
    quote: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "fact" && !value.quote?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Verified facts require a direct source quote",
      });
    }
  });
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/, "lowercase slug required");

// ---------------------------------------------------------------------------
// Blueprint sections (§8). Sub-schemas stay structural: the compiler in later
// cards interprets them against live registries; this card only guarantees
// shape, classification, and identifier discipline.
// ---------------------------------------------------------------------------

const ClassifiedSchema = z.object({
  classification: EvidenceKindSchema,
  evidence: z.array(EvidenceRefSchema).max(25).default([]),
});

export const NavigationItemSchema = z
  .object({
    label: z.string().min(1).max(80),
    targetType: z.enum(["module", "board", "view", "page"]),
    /** Registered module key, board key, view key, or route path. */
    targetKey: z.string().min(1).max(200),
  })
  .strict();

export const EntityProposalSchema = ClassifiedSchema.extend({
  key: slug,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  /** Reuse-hierarchy decision level (§10): 1 reuse core … 5 custom App. */
  reuseLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  existingTypeKey: z.string().min(1).max(80).optional(),
  confidence: z.enum(["low", "medium", "high"]),
  unresolvedQuestions: z.array(z.string().min(1).max(500)).max(25).default([]),
}).strict();

export const RelationshipProposalSchema = ClassifiedSchema.extend({
  fromEntity: z.string().min(1).max(80),
  toEntity: z.string().min(1).max(80),
  kind: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
}).strict();

export const WorkTypeProposalSchema = ClassifiedSchema.extend({
  key: slug,
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
}).strict();

export const BoardColumnSchema = z
  .object({
    key: slug,
    label: z.string().min(1).max(80),
    /** Authoritative lifecycle state(s) this column projects (§12). */
    lifecycleStates: z.array(z.string().min(1).max(80)).min(1).max(50),
  })
  .strict();

export const BoardDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(80),
  /** Entity or work-type key whose state the board projects. */
  sourceType: z.string().min(1).max(80),
  groupingField: z.string().min(1).max(80),
  columns: z.array(BoardColumnSchema).min(1).max(50),
  cardFields: z.array(z.string().min(1).max(80)).max(25).default([]),
}).strict();

export const ViewDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(80),
  sourceType: z.string().min(1).max(80),
  filters: z.array(z.record(z.string(), z.unknown())).max(25).default([]),
  sort: z.array(z.string().min(1).max(120)).max(10).default([]),
  columns: z.array(z.string().min(1).max(80)).max(25).default([]),
}).strict();

export const DashboardWidgetSchema = z
  .object({
    key: slug,
    title: z.string().min(1).max(120),
    /** Declared real data source / query ref; never invented data (§18). */
    queryRef: z.string().min(1).max(200),
  })
  .strict();

export const DashboardDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  widgets: z.array(DashboardWidgetSchema).min(1).max(25),
}).strict();

export const WorkflowStepSchema = z
  .object({
    key: slug,
    kind: z.enum(["deterministic", "ai_judgment", "action", "approval", "external"]),
    description: z.string().min(1).max(1000),
    /** Registered capability key required to execute this step (§21). */
    capabilityKey: z.string().min(1).max(120).optional(),
  })
  .strict();

export const WorkflowDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(120),
  trigger: z
    .object({
      kind: z.string().min(1).max(80),
      ref: z.string().min(1).max(200),
    })
    .strict(),
  steps: z.array(WorkflowStepSchema).min(1).max(50),
  requiredIntegrations: z.array(z.string().min(1).max(120)).max(25).default([]),
  failureBehavior: z.string().min(1).max(1000),
}).strict();

export const TriggerDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  event: z.string().min(1).max(200),
  workflowKey: z.string().min(1).max(80),
}).strict();

export const CoworkerProposalSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(80),
  purpose: z.string().min(1).max(2000),
  workKinds: z.array(z.string().min(1).max(80)).min(1).max(25),
  requiredCapabilities: z.array(z.string().min(1).max(120)).max(25).default([]),
  relevantEntities: z.array(z.string().min(1).max(80)).max(25).default([]),
  autonomyPolicy: z.string().min(1).max(80),
  escalation: z.string().min(1).max(1000),
}).strict();

export const SkillProposalSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(120),
  outcome: z.string().min(1).max(2000),
  procedure: z.array(z.string().min(1).max(1000)).min(1).max(50),
  allowedTools: z.array(z.string().min(1).max(120)).max(25).default([]),
  approvalRequired: z.boolean(),
}).strict();

export const AttentionRuleSchema = ClassifiedSchema.extend({
  key: slug,
  entityType: z.string().min(1).max(80),
  condition: z.string().min(1).max(1000),
  severity: z.enum(["watch", "work", "decision"]),
}).strict();

export const ReportDefinitionSchema = ClassifiedSchema.extend({
  key: slug,
  name: z.string().min(1).max(120),
  queryRef: z.string().min(1).max(200),
}).strict();

export const IntegrationRequirementSchema = z
  .object({
    capability: z.string().min(1).max(120),
    reason: z.string().min(1).max(1000),
    preferredProvider: z.string().min(1).max(80).optional(),
    requiredFor: z.array(z.string().min(1).max(120)).min(1).max(25),
  })
  .strict();

export const PolicySchema = z
  .object({
    key: slug,
    statement: z.string().min(1).max(2000),
  })
  .strict();

export const AppRecommendationSchema = ClassifiedSchema.extend({
  appKey: slug,
  reason: z.string().min(1).max(1000),
}).strict();

export const MigrationPlanSchema = z
  .object({
    behavior: z.string().min(1).max(2000),
    retainExistingState: z.boolean(),
    operatorReview: z.string().max(2000).optional(),
  })
  .strict();

export const WorkspaceBlueprintSchema = z
  .object({
    schemaVersion: z.literal(BLUEPRINT_SCHEMA_VERSION),
    businessSummary: z.string().min(1).max(5000),
    evidenceRefs: z.array(EvidenceRefSchema).max(100).default([]),
    assumptions: z.array(z.string().min(1).max(1000)).max(100).default([]),
    unresolvedQuestions: z.array(z.string().min(1).max(1000)).max(100).default([]),
    navigation: z.array(NavigationItemSchema).max(50).default([]),
    entities: z.array(EntityProposalSchema).max(50).default([]),
    relationships: z.array(RelationshipProposalSchema).max(100).default([]),
    workTypes: z.array(WorkTypeProposalSchema).max(50).default([]),
    boards: z.array(BoardDefinitionSchema).max(25).default([]),
    views: z.array(ViewDefinitionSchema).max(50).default([]),
    dashboards: z.array(DashboardDefinitionSchema).max(25).default([]),
    workflows: z.array(WorkflowDefinitionSchema).max(50).default([]),
    triggers: z.array(TriggerDefinitionSchema).max(50).default([]),
    coworkers: z.array(CoworkerProposalSchema).max(25).default([]),
    skills: z.array(SkillProposalSchema).max(50).default([]),
    attentionRules: z.array(AttentionRuleSchema).max(50).default([]),
    reports: z.array(ReportDefinitionSchema).max(50).default([]),
    integrationRequirements: z.array(IntegrationRequirementSchema).max(50).default([]),
    permissionPolicies: z.array(PolicySchema).max(50).default([]),
    autonomyPolicies: z.array(PolicySchema).max(50).default([]),
    installedAppRecommendations: z.array(AppRecommendationSchema).max(25).default([]),
    migrationPlan: MigrationPlanSchema.optional(),
  })
  .strict();

export type WorkspaceBlueprint = z.infer<typeof WorkspaceBlueprintSchema>;

// ---------------------------------------------------------------------------
// Structure validation: model output is data until it passes this gate.
// ---------------------------------------------------------------------------

export interface BlueprintStructureResult {
  ok: boolean;
  blueprint: WorkspaceBlueprint | null;
  issues: string[];
}

export function validateBlueprintStructure(document: unknown): BlueprintStructureResult {
  const parsed = WorkspaceBlueprintSchema.safeParse(document);
  if (!parsed.success) {
    return {
      ok: false,
      blueprint: null,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, blueprint: parsed.data, issues: [] };
}

export function parseBlueprint(document: unknown): WorkspaceBlueprint {
  const result = validateBlueprintStructure(document);
  if (!result.ok || !result.blueprint) {
    throw new Error(`Invalid WorkspaceBlueprint: ${result.issues.join("; ")}`);
  }
  assertNoSecrets(result.blueprint);
  assertNoExecutableMarkup(result.blueprint);
  return result.blueprint;
}

// ---------------------------------------------------------------------------
// Secrets guard (§35.11): credential-shaped keys must never appear in JSON.
// ---------------------------------------------------------------------------

const FORBIDDEN_KEY_PATTERN =
  /(secret|passwd|password|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|webhook[_-]?secret|connection[_-]?string)/i;

export function assertNoSecrets(value: unknown, path = "(root)"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecrets(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_PATTERN.test(key)) {
        throw new Error(`Blueprint must not contain secrets (${path}.${key})`);
      }
      assertNoSecrets(entry, `${path}.${key}`);
    }
  }
}

const EXECUTABLE_MARKUP = /<\/?[a-z][\s\S]*>|javascript:|on\w+\s*=/i;

export function assertNoExecutableMarkup(value: unknown, path = "(root)"): void {
  if (typeof value === "string" && EXECUTABLE_MARKUP.test(value)) {
    throw new Error(`Blueprint must not contain executable markup (${path})`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoExecutableMarkup(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertNoExecutableMarkup(entry, `${path}.${key}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Capability-aware validation (§21): the Architect must never plan as though
// unavailable capabilities already exist. Unknown commands fail closed.
// ---------------------------------------------------------------------------

export interface CapabilityStatus {
  key: string;
  available: boolean;
  policy: "automatic" | "approval_required" | "prohibited" | null;
}

export interface BlueprintLiveContext {
  capabilities: CapabilityStatus[];
  /** Enabled module keys. */
  modules: string[];
  /** Registered entity/work-type keys (core + custom). */
  entityTypes: string[];
  /** Registered navigation routes/pages. */
  routes: string[];
}

export interface BlockedItem {
  ref: string;
  kind:
    | "unknown_capability"
    | "unavailable_capability"
    | "unknown_entity"
    | "unknown_navigation_target"
    | "unknown_integration";
  key: string;
  reason: string;
}

export interface ApprovalItem {
  ref: string;
  kind: string;
  key: string;
  reason: string;
}

export interface CapabilityValidation {
  ready: string[];
  blocked: BlockedItem[];
  approvals: ApprovalItem[];
}

export function validateAgainstCapabilities(
  blueprint: WorkspaceBlueprint,
  context: BlueprintLiveContext,
): CapabilityValidation {
  const capabilityByKey = new Map(context.capabilities.map((entry) => [entry.key, entry]));
  const entityTypes = new Set(context.entityTypes);
  const modules = new Set(context.modules);
  const routes = new Set(context.routes);
  const ready: string[] = [];
  const blocked: BlockedItem[] = [];
  const approvals: ApprovalItem[] = [];

  const checkCapability = (ref: string, kind: string, key: string | undefined) => {
    if (!key) return;
    const entry = capabilityByKey.get(key);
    if (!entry) {
      blocked.push({ ref, kind: "unknown_capability", key, reason: "Capability not registered" });
      return;
    }
    if (!entry.available) {
      blocked.push({ ref, kind: "unavailable_capability", key, reason: "Capability unavailable" });
      return;
    }
    if (entry.policy === "approval_required") {
      approvals.push({ ref, kind, key, reason: "Approval required" });
      return;
    }
    if (entry.policy === "prohibited") {
      blocked.push({ ref, kind: "unavailable_capability", key, reason: "Capability prohibited" });
      return;
    }
    ready.push(`${ref}:${key}`);
  };

  for (const workflow of blueprint.workflows) {
    for (const step of workflow.steps) {
      checkCapability(
        `workflow:${workflow.key}/step:${step.key}`,
        "workflow_step",
        step.capabilityKey,
      );
    }
    for (const integration of workflow.requiredIntegrations) {
      if (!capabilityByKey.has(integration)) {
        blocked.push({
          ref: `workflow:${workflow.key}`,
          kind: "unknown_integration",
          key: integration,
          reason: "Integration capability not registered",
        });
      } else {
        checkCapability(`workflow:${workflow.key}`, "workflow_integration", integration);
      }
    }
  }
  for (const board of blueprint.boards) {
    if (!entityTypes.has(board.sourceType)) {
      blocked.push({
        ref: `board:${board.key}`,
        kind: "unknown_entity",
        key: board.sourceType,
        reason: "Board source type is not a registered entity",
      });
    } else {
      ready.push(`board:${board.key}`);
    }
  }
  for (const view of blueprint.views) {
    if (!entityTypes.has(view.sourceType)) {
      blocked.push({
        ref: `view:${view.key}`,
        kind: "unknown_entity",
        key: view.sourceType,
        reason: "View source type is not a registered entity",
      });
    } else {
      ready.push(`view:${view.key}`);
    }
  }
  for (const item of blueprint.navigation) {
    const known =
      item.targetType === "module"
        ? modules.has(item.targetKey)
        : item.targetType === "page"
          ? routes.has(item.targetKey)
          : true;
    if (!known) {
      blocked.push({
        ref: `navigation:${item.label}`,
        kind: "unknown_navigation_target",
        key: item.targetKey,
        reason: `Unregistered ${item.targetType}`,
      });
    } else if (item.targetType === "board" || item.targetType === "view") {
      const owned =
        item.targetType === "board"
          ? blueprint.boards.some((board) => board.key === item.targetKey)
          : blueprint.views.some((view) => view.key === item.targetKey);
      if (!owned) {
        blocked.push({
          ref: `navigation:${item.label}`,
          kind: "unknown_navigation_target",
          key: item.targetKey,
          reason: `Navigation points to a ${item.targetType} this Blueprint does not define`,
        });
      } else {
        ready.push(`navigation:${item.label}`);
      }
    } else {
      ready.push(`navigation:${item.label}`);
    }
  }
  for (const requirement of blueprint.integrationRequirements) {
    const entry = capabilityByKey.get(requirement.capability);
    if (!entry) {
      blocked.push({
        ref: "integration",
        kind: "unknown_integration",
        key: requirement.capability,
        reason: "Integration capability not registered",
      });
    } else if (!entry.available) {
      blocked.push({
        ref: "integration",
        kind: "unavailable_capability",
        key: requirement.capability,
        reason: "Integration not connected",
      });
    } else {
      ready.push(`integration:${requirement.capability}`);
    }
  }
  for (const coworker of blueprint.coworkers) {
    for (const key of coworker.requiredCapabilities) {
      checkCapability(`coworker:${coworker.key}`, "coworker_capability", key);
    }
  }
  return { ready, blocked, approvals };
}

// ---------------------------------------------------------------------------
// Preflight (§25): counts before execution. V1 never declares destructive
// operations; the compiler must report zero.
// ---------------------------------------------------------------------------

export interface BlueprintPreflight {
  navigation: number;
  newEntityTypes: number;
  boards: number;
  views: number;
  dashboards: number;
  workflows: number;
  coworkers: number;
  skills: number;
  attentionRules: number;
  appEnablements: number;
  destructiveOperations: number;
}

export function summarizePreflight(blueprint: WorkspaceBlueprint): BlueprintPreflight {
  return {
    navigation: blueprint.navigation.length,
    newEntityTypes: blueprint.entities.filter((entity) => entity.reuseLevel === 4).length,
    boards: blueprint.boards.length,
    views: blueprint.views.length,
    dashboards: blueprint.dashboards.length,
    workflows: blueprint.workflows.length,
    coworkers: blueprint.coworkers.length,
    skills: blueprint.skills.length,
    attentionRules: blueprint.attentionRules.length,
    appEnablements: blueprint.installedAppRecommendations.length,
    destructiveOperations: 0,
  };
}

// ---------------------------------------------------------------------------
// Diffs (§28) and impact analysis (§29): what changed and what it touches.
// ---------------------------------------------------------------------------

const DIFFABLE_SECTIONS = [
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
] as const;

export interface BlueprintDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

function sectionSignature(section: unknown): string {
  return JSON.stringify(section ?? null);
}

export function diffBlueprints(
  previous: WorkspaceBlueprint,
  next: WorkspaceBlueprint,
): BlueprintDiff {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const section of DIFFABLE_SECTIONS) {
    const before = sectionSignature(previous[section]);
    const after = sectionSignature(next[section]);
    if (before === after) continue;
    const beforeEmpty = before === "[]" || before === "null";
    const afterEmpty = after === "[]" || after === "null";
    if (beforeEmpty && !afterEmpty) added.push(section);
    else if (!beforeEmpty && afterEmpty) removed.push(section);
    else changed.push(section);
  }
  return { added, removed, changed };
}

export interface BlueprintImpact {
  affectedBoards: string[];
  affectedViews: string[];
  affectedWorkflows: string[];
  affectedCoworkers: string[];
  affectedAttentionRules: string[];
  requiresMigration: boolean;
  notes: string[];
}

export function analyzeImpact(
  previous: WorkspaceBlueprint,
  next: WorkspaceBlueprint,
): BlueprintImpact {
  const notes: string[] = [];
  const previousEntities = new Map(previous.entities.map((entity) => [entity.key, entity]));
  const changedEntities = next.entities
    .filter((entity) => {
      const before = previousEntities.get(entity.key);
      return !before || sectionSignature(before) !== sectionSignature(entity);
    })
    .map((entity) => entity.key);
  const removedEntities = previous.entities
    .filter((entity) => !next.entities.some((candidate) => candidate.key === entity.key))
    .map((entity) => entity.key);
  const touched = new Set([...changedEntities, ...removedEntities]);

  const mentions = (value: unknown) =>
    [...touched].some((key) => JSON.stringify(value ?? null).includes(key));

  const affectedBoards = next.boards
    .filter((board) => touched.has(board.sourceType))
    .map((b) => b.key);
  const affectedViews = next.views.filter((view) => touched.has(view.sourceType)).map((v) => v.key);
  const affectedWorkflows = next.workflows
    .filter((workflow) => mentions(workflow))
    .map((w) => w.key);
  const affectedCoworkers = next.coworkers
    .filter((coworker) => mentions(coworker))
    .map((c) => c.key);
  const affectedAttentionRules = next.attentionRules
    .filter((rule) => touched.has(rule.entityType))
    .map((rule) => rule.key);

  if (removedEntities.length > 0) {
    notes.push(`Removed entities require explicit migration: ${removedEntities.join(", ")}`);
  }
  if (next.migrationPlan && !next.migrationPlan.retainExistingState && changedEntities.length > 0) {
    notes.push("Migration plan restages existing records; operator review required");
  }
  return {
    affectedBoards,
    affectedViews,
    affectedWorkflows,
    affectedCoworkers,
    affectedAttentionRules,
    requiresMigration: removedEntities.length > 0 || changedEntities.length > 0,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Versioned persistence (§27): append-only. A revision never overwrites its
// parent; saving always inserts a new version row.
// ---------------------------------------------------------------------------

export interface BlueprintVersionRecord {
  tenant_id: string;
  blueprint_id: string;
  version: number;
  parent_version: number | null;
  document: WorkspaceBlueprint;
  change_summary: string;
  created_by: string | null;
  source_agent_run_id: string | null;
  created_at: string;
}

export interface SaveBlueprintInput {
  tenantId: string;
  blueprintId?: string;
  title?: string;
  document: unknown;
  changeSummary: string;
  createdBy?: string | null;
  sourceAgentRunId?: string | null;
  actorEmail?: string | null;
}

function requireUuid(value: string, field: string): string {
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error(`${field} must be a UUID`);
  }
  return trimmed;
}

export async function saveBlueprintVersion(
  supabase: SupabaseClient,
  input: SaveBlueprintInput,
): Promise<{ blueprintId: string; version: BlueprintVersionRecord }> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const changeSummary = input.changeSummary.trim();
  if (!changeSummary) throw new Error("changeSummary is required");
  const document = parseBlueprint(input.document);

  let blueprintId = input.blueprintId?.trim() || null;
  if (blueprintId) requireUuid(blueprintId, "blueprintId");

  if (!blueprintId) {
    const { data, error } = await supabase
      .from("workspace_blueprints")
      .insert({
        tenant_id: tenantId,
        title: input.title?.trim() || "Workspace Blueprint",
        status: "draft",
        latest_version: 0,
        created_by: input.createdBy ?? null,
        source_agent_run_id: input.sourceAgentRunId ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Blueprint create failed: ${error?.message ?? "no row"}`);
    blueprintId = (data as { id: string }).id;
  }

  const { data: blueprint, error: blueprintError } = await supabase
    .from("workspace_blueprints")
    .select("id,latest_version")
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .maybeSingle();
  if (blueprintError || !blueprint) {
    throw new Error("Blueprint not found in this workspace");
  }
  const nextVersion = ((blueprint as { latest_version: number }).latest_version ?? 0) + 1;
  const parentVersion = nextVersion > 1 ? nextVersion - 1 : null;

  const { data: inserted, error: versionError } = await supabase
    .from("workspace_blueprint_versions")
    .insert({
      tenant_id: tenantId,
      blueprint_id: blueprintId,
      version: nextVersion,
      parent_version: parentVersion,
      document,
      change_summary: changeSummary,
      created_by: input.createdBy ?? null,
      source_agent_run_id: input.sourceAgentRunId ?? null,
    })
    .select(
      "tenant_id,blueprint_id,version,parent_version,document,change_summary,created_by,source_agent_run_id,created_at",
    )
    .single();
  if (versionError || !inserted) {
    throw new Error(`Blueprint version save failed: ${versionError?.message ?? "no row"}`);
  }

  const { error: bumpError } = await supabase
    .from("workspace_blueprints")
    .update({ latest_version: nextVersion, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", blueprintId)
    .eq("latest_version", nextVersion - 1);
  if (bumpError) throw new Error(`Blueprint version bump failed: ${bumpError.message}`);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail ?? input.createdBy ?? null,
    action: "blueprint.version_saved",
    entityType: "workspace_blueprint",
    entityId: blueprintId,
    source: "admin",
    after: { version: nextVersion, parentVersion, changeSummary },
  });

  return { blueprintId, version: inserted as unknown as BlueprintVersionRecord };
}

export async function listBlueprintVersions(
  supabase: SupabaseClient,
  input: { tenantId: string; blueprintId: string; limit?: number },
): Promise<BlueprintVersionRecord[]> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const blueprintId = requireUuid(input.blueprintId, "blueprintId");
  const limit = Math.min(100, Math.max(1, input.limit ?? 25));
  const { data, error } = await supabase
    .from("workspace_blueprint_versions")
    .select(
      "tenant_id,blueprint_id,version,parent_version,document,change_summary,created_by,source_agent_run_id,created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("blueprint_id", blueprintId)
    .order("version", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Blueprint version list failed: ${error.message}`);
  return (data ?? []) as unknown as BlueprintVersionRecord[];
}

export async function getBlueprintVersion(
  supabase: SupabaseClient,
  input: { tenantId: string; blueprintId: string; version: number },
): Promise<BlueprintVersionRecord> {
  const tenantId = requireUuid(input.tenantId, "tenantId");
  const blueprintId = requireUuid(input.blueprintId, "blueprintId");
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new Error("version must be a positive integer");
  }
  const { data, error } = await supabase
    .from("workspace_blueprint_versions")
    .select(
      "tenant_id,blueprint_id,version,parent_version,document,change_summary,created_by,source_agent_run_id,created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("blueprint_id", blueprintId)
    .eq("version", input.version)
    .maybeSingle();
  if (error || !data) throw new Error("Blueprint version not found in this workspace");
  return data as unknown as BlueprintVersionRecord;
}

export async function getLatestBlueprintVersion(
  supabase: SupabaseClient,
  input: { tenantId: string; blueprintId: string },
): Promise<BlueprintVersionRecord> {
  const versions = await listBlueprintVersions(supabase, { ...input, limit: 1 });
  if (!versions[0]) throw new Error("Blueprint version not found in this workspace");
  return versions[0];
}

// ---------------------------------------------------------------------------
// Live-context adapter (WA-02, spec §21): assemble the validation context
// from the workspace's actual registries — capabilities table, enabled
// modules, registered entity types, and module-owned routes. The Architect
// never plans as though unavailable capabilities already exist.
// ---------------------------------------------------------------------------

async function readTenantModuleConfig(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ modules?: Partial<Record<string, boolean>> }> {
  const { data, error } = await supabase
    .from("tenants")
    .select("config,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) throw new Error("Workspace configuration is unavailable");
  const row = data as unknown as { config?: unknown; status?: unknown };
  if (row.status !== "active") throw new Error("Workspace is not active");
  const config = (row.config ?? {}) as { modules?: Partial<Record<string, boolean>> };
  return { modules: config.modules };
}

export async function collectBlueprintLiveContext(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<BlueprintLiveContext> {
  const id = requireUuid(tenantId, "tenantId");
  const [capabilities, config, entityTypes] = await Promise.all([
    listWorkspaceCapabilities(supabase),
    readTenantModuleConfig(supabase, id),
    listEntityTypeKeys(supabase, id),
  ]);
  const activeModules = getActiveModules(config);
  const routes = [
    ...new Set(
      activeModules.flatMap((module) => [
        ...(module.routes ?? []),
        ...(module.historyRoute ? [module.historyRoute] : []),
      ]),
    ),
  ].sort();
  return {
    capabilities: capabilities.map((capability) => ({
      key: capability.capability_key,
      available: capability.available,
      policy: capability.policy,
    })),
    modules: activeModules.map((module) => module.id).sort(),
    entityTypes,
    routes,
  };
}

export interface LiveBlueprintValidation {
  blueprint: WorkspaceBlueprint;
  validation: CapabilityValidation;
  preflight: BlueprintPreflight;
}

export async function validateBlueprintAgainstLive(
  supabase: SupabaseClient,
  tenantId: string,
  document: unknown,
): Promise<LiveBlueprintValidation> {
  const blueprint = parseBlueprint(document);
  const context = await collectBlueprintLiveContext(supabase, tenantId);
  return {
    blueprint,
    validation: validateAgainstCapabilities(blueprint, context),
    preflight: summarizePreflight(blueprint),
  };
}

// ---------------------------------------------------------------------------
// Impact classification (WA-03, spec §26): every Blueprint item carries an
// authority class so the review surface can gate correctly.
// - low_risk: one Blueprint-level approval may cover these.
// - structural: explicit workspace-change approval required.
// - external_authority: provider / autonomy approval flows, never covered by
//   a Blueprint approval alone.
// ---------------------------------------------------------------------------

export type BlueprintImpactLevel = "low_risk" | "structural" | "external_authority";

export interface BlueprintImpactItem {
  ref: string;
  label: string;
  level: BlueprintImpactLevel;
}

export function classifyBlueprintImpact(blueprint: WorkspaceBlueprint): BlueprintImpactItem[] {
  const items: BlueprintImpactItem[] = [];
  for (const item of blueprint.navigation) {
    items.push({
      ref: `navigation:${item.label}`,
      label: `Navigation: ${item.label}`,
      level: "low_risk",
    });
  }
  for (const view of blueprint.views) {
    items.push({ ref: `view:${view.key}`, label: `Saved view: ${view.name}`, level: "low_risk" });
  }
  for (const dashboard of blueprint.dashboards) {
    items.push({
      ref: `dashboard:${dashboard.key}`,
      label: `Dashboard: ${dashboard.name}`,
      level: "low_risk",
    });
  }
  for (const report of blueprint.reports) {
    items.push({ ref: `report:${report.key}`, label: `Report: ${report.name}`, level: "low_risk" });
  }
  for (const entity of blueprint.entities) {
    items.push({
      ref: `entity:${entity.key}`,
      label: `Entity: ${entity.label}`,
      level: entity.reuseLevel === 4 ? "structural" : "low_risk",
    });
  }
  for (const workType of blueprint.workTypes) {
    items.push({
      ref: `worktype:${workType.key}`,
      label: `Work type: ${workType.label}`,
      level: "structural",
    });
  }
  for (const relationship of blueprint.relationships) {
    items.push({
      ref: `relationship:${relationship.fromEntity}:${relationship.toEntity}`,
      label: `Relationship: ${relationship.fromEntity} → ${relationship.toEntity}`,
      level: "structural",
    });
  }
  for (const board of blueprint.boards) {
    items.push({ ref: `board:${board.key}`, label: `Board: ${board.name}`, level: "structural" });
  }
  for (const workflow of blueprint.workflows) {
    items.push({
      ref: `workflow:${workflow.key}`,
      label: `Workflow: ${workflow.name}`,
      level: "structural",
    });
    for (const step of workflow.steps) {
      if (step.kind === "external") {
        items.push({
          ref: `workflow:${workflow.key}/step:${step.key}`,
          label: `External step: ${step.description}`,
          level: "external_authority",
        });
      }
    }
  }
  for (const trigger of blueprint.triggers) {
    items.push({
      ref: `trigger:${trigger.key}`,
      label: `Trigger: ${trigger.event}`,
      level: "structural",
    });
  }
  for (const coworker of blueprint.coworkers) {
    items.push({
      ref: `coworker:${coworker.key}`,
      label: `Coworker: ${coworker.name}`,
      level: "structural",
    });
  }
  for (const skill of blueprint.skills) {
    items.push({
      ref: `skill:${skill.key}`,
      label: `Skill draft: ${skill.name}`,
      level: "structural",
    });
  }
  for (const rule of blueprint.attentionRules) {
    items.push({
      ref: `attention:${rule.key}`,
      label: `Attention rule: ${rule.key}`,
      level: "structural",
    });
  }
  for (const requirement of blueprint.integrationRequirements) {
    items.push({
      ref: `integration:${requirement.capability}`,
      label: `Integration: ${requirement.capability}`,
      level: "external_authority",
    });
  }
  for (const policy of blueprint.permissionPolicies) {
    items.push({
      ref: `permission:${policy.key}`,
      label: `Permission: ${policy.key}`,
      level: "external_authority",
    });
  }
  for (const policy of blueprint.autonomyPolicies) {
    items.push({
      ref: `autonomy:${policy.key}`,
      label: `Autonomy: ${policy.key}`,
      level: "external_authority",
    });
  }
  for (const app of blueprint.installedAppRecommendations) {
    items.push({
      ref: `app:${app.appKey}`,
      label: `App: ${app.appKey}`,
      level: "external_authority",
    });
  }
  return items;
}

export interface ApprovalGateSummary {
  blueprintLevel: BlueprintImpactItem[];
  explicitWorkspaceChange: BlueprintImpactItem[];
  externalAuthority: BlueprintImpactItem[];
}

export function summarizeApprovalGates(blueprint: WorkspaceBlueprint): ApprovalGateSummary {
  const gates: ApprovalGateSummary = {
    blueprintLevel: [],
    explicitWorkspaceChange: [],
    externalAuthority: [],
  };
  for (const item of classifyBlueprintImpact(blueprint)) {
    if (item.level === "low_risk") gates.blueprintLevel.push(item);
    else if (item.level === "structural") gates.explicitWorkspaceChange.push(item);
    else gates.externalAuthority.push(item);
  }
  return gates;
}

// ---------------------------------------------------------------------------
// Review model (WA-03, spec §23): a UI-ready projection of the Blueprint plus
// its live validation. Pure: the page renders this, it decides nothing.
// ---------------------------------------------------------------------------

export type BlueprintItemStatus = "ready" | "blocked" | "approval" | "info";

export interface ReviewSectionItem {
  ref: string;
  title: string;
  detail: string;
  status: BlueprintItemStatus;
  statusReason: string | null;
  impact: BlueprintImpactLevel | null;
}

export interface BlueprintReviewModel {
  businessSummary: string;
  businessModel: ReviewSectionItem[];
  workflows: ReviewSectionItem[];
  boards: ReviewSectionItem[];
  coworkers: ReviewSectionItem[];
  integrations: ReviewSectionItem[];
  questions: ReviewSectionItem[];
  gates: ApprovalGateSummary;
  preflight: BlueprintPreflight;
  blockedCount: number;
  approvalCount: number;
}

export function buildReviewModel(
  blueprint: WorkspaceBlueprint,
  validation: CapabilityValidation,
): BlueprintReviewModel {
  const blockedByRef = new Map(validation.blocked.map((item) => [item.ref, item]));
  const approvalByRef = new Map(validation.approvals.map((item) => [item.ref, item]));
  const impactByRef = new Map(
    classifyBlueprintImpact(blueprint).map((item) => [item.ref, item.level]),
  );

  const statusOf = (
    ref: string,
    fallback: BlueprintItemStatus = "ready",
  ): { status: BlueprintItemStatus; reason: string | null } => {
    const blocked = blockedByRef.get(ref);
    if (blocked) return { status: "blocked", reason: blocked.reason };
    const approval = approvalByRef.get(ref);
    if (approval) return { status: "approval", reason: approval.reason };
    return { status: fallback, reason: null };
  };

  const businessModel: ReviewSectionItem[] = [
    ...blueprint.entities.map((entity) => {
      const resolved = statusOf(`entity:${entity.key}`);
      return {
        ref: `entity:${entity.key}`,
        title: entity.label,
        detail: entity.existingTypeKey
          ? `Reuses ${entity.existingTypeKey} (level ${entity.reuseLevel}) · ${entity.description}`
          : `New type (level ${entity.reuseLevel}) · ${entity.description}`,
        status: resolved.status,
        statusReason: resolved.reason,
        impact: impactByRef.get(`entity:${entity.key}`) ?? null,
      };
    }),
    ...blueprint.workTypes.map((workType) => ({
      ref: `worktype:${workType.key}`,
      title: workType.label,
      detail: workType.description,
      status: "info" as BlueprintItemStatus,
      statusReason: null,
      impact: impactByRef.get(`worktype:${workType.key}`) ?? null,
    })),
  ];

  const workflows: ReviewSectionItem[] = blueprint.workflows.map((workflow) => {
    const stepStates = workflow.steps.map((step) => {
      const resolved = statusOf(`workflow:${workflow.key}/step:${step.key}`);
      return `${step.kind}:${resolved.status}`;
    });
    const blockedSteps = stepStates.filter((state) => state.endsWith(":blocked")).length;
    const approvalSteps = stepStates.filter((state) => state.endsWith(":approval")).length;
    const status: BlueprintItemStatus =
      blockedSteps > 0 ? "blocked" : approvalSteps > 0 ? "approval" : "ready";
    return {
      ref: `workflow:${workflow.key}`,
      title: workflow.name,
      detail: `Trigger ${workflow.trigger.kind} ${workflow.trigger.ref} · ${workflow.steps.length} steps (${blockedSteps} blocked, ${approvalSteps} need approval)`,
      status,
      statusReason:
        status === "ready" ? null : `${blockedSteps} blocked, ${approvalSteps} need approval`,
      impact: impactByRef.get(`workflow:${workflow.key}`) ?? null,
    };
  });

  const boards: ReviewSectionItem[] = blueprint.boards.map((board) => {
    const resolved = statusOf(`board:${board.key}`);
    return {
      ref: `board:${board.key}`,
      title: board.name,
      detail: `Projects ${board.sourceType}.${board.groupingField} across ${board.columns.length} columns`,
      status: resolved.status,
      statusReason: resolved.reason,
      impact: impactByRef.get(`board:${board.key}`) ?? null,
    };
  });

  const coworkers: ReviewSectionItem[] = blueprint.coworkers.map((coworker) => {
    const missing = coworker.requiredCapabilities.filter(
      (key) =>
        blockedByRef.has(`coworker:${coworker.key}`) &&
        blockedByRef.get(`coworker:${coworker.key}`)?.key === key,
    );
    return {
      ref: `coworker:${coworker.key}`,
      title: coworker.name,
      detail: `${coworker.purpose} · ${coworker.workKinds.join(", ")}`,
      status: missing.length > 0 ? "blocked" : "ready",
      statusReason: missing.length > 0 ? `Missing capabilities: ${missing.join(", ")}` : null,
      impact: impactByRef.get(`coworker:${coworker.key}`) ?? null,
    };
  });

  const integrations: ReviewSectionItem[] = blueprint.integrationRequirements.map((requirement) => {
    const match =
      validation.blocked.find(
        (item) => item.ref === "integration" && item.key === requirement.capability,
      ) ??
      validation.blocked.find(
        (item) => item.ref.startsWith("workflow:") && item.key === requirement.capability,
      );
    return {
      ref: `integration:${requirement.capability}`,
      title: requirement.capability,
      detail: `${requirement.reason} · for ${requirement.requiredFor.join(", ")}`,
      status: match ? "blocked" : "ready",
      statusReason: match?.reason ?? null,
      impact: impactByRef.get(`integration:${requirement.capability}`) ?? null,
    };
  });

  const questions: ReviewSectionItem[] = [
    ...blueprint.unresolvedQuestions.map((question, index) => ({
      ref: `question:${index}`,
      title: question,
      detail: "Needs an operator answer before apply",
      status: "info" as BlueprintItemStatus,
      statusReason: null,
      impact: null,
    })),
    ...blueprint.assumptions.map((assumption, index) => ({
      ref: `assumption:${index}`,
      title: assumption,
      detail: "Architect assumption — confirm or correct",
      status: "info" as BlueprintItemStatus,
      statusReason: null,
      impact: null,
    })),
  ];

  return {
    businessSummary: blueprint.businessSummary,
    businessModel,
    workflows,
    boards,
    coworkers,
    integrations,
    questions,
    gates: summarizeApprovalGates(blueprint),
    preflight: summarizePreflight(blueprint),
    blockedCount: validation.blocked.length,
    approvalCount: validation.approvals.length,
  };
}

// ---------------------------------------------------------------------------
// Blueprint listing for the review surface.
// ---------------------------------------------------------------------------

export interface BlueprintSummary {
  id: string;
  title: string;
  status: string;
  latest_version: number;
  updated_at: string;
}

export async function listBlueprints(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<BlueprintSummary[]> {
  const id = requireUuid(tenantId, "tenantId");
  const { data, error } = await supabase
    .from("workspace_blueprints")
    .select("id,title,status,latest_version,updated_at")
    .eq("tenant_id", id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Blueprint list failed: ${error.message}`);
  return (data ?? []) as unknown as BlueprintSummary[];
}

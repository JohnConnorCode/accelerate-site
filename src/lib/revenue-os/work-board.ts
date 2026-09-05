/** Canonical platform work service. Never import into tenant-scoped tool catalogues. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const WORK_OPERATIONS = [
  "create",
  "edit",
  "dependencies",
  "claim",
  "heartbeat",
  "progress",
  "block",
  "release",
  "submit",
  "review",
  "transition",
  "recover",
  "reopen",
  "archive",
  "delivery",
  "reorder",
] as const;
export type WorkOperation = (typeof WORK_OPERATIONS)[number];
export type WorkActor = {
  id: string;
  projects: string[];
  scopes: string[];
  reviewer: boolean;
  capabilities?: string[];
};
const line = z.string().max(500);
const reference = z
  .object({ path: line, reason: z.string().min(1).max(2000), revision: line.optional() })
  .strict();
export const workSpecSchema = z
  .object({
    businessValue: z.string().max(10000).optional(),
    scope: z.array(line).max(100).optional(),
    exclusions: z.array(line).max(100).optional(),
    references: z.array(reference).max(100).optional(),
    verification: z
      .array(z.object({ command: line, expected: z.string().max(2000) }).strict())
      .max(100)
      .optional(),
    requiredCapabilities: z.array(line).max(50).optional(),
    unresolvedDependencies: z.array(line).nullable().optional(),
    repository: z
      .object({ url: line, baseBranch: line, baseCommit: z.string().regex(/^[a-f0-9]{40}$/) })
      .strict()
      .optional(),
    workflow: z.array(line).max(100).optional(),
    acceptance: z
      .array(z.object({ id: line, criterion: z.string().max(4000) }).strict())
      .max(100)
      .optional(),
  })
  .strict();
export const workEvidenceSchema = z
  .object({
    summary: z.string().min(10).max(10000),
    commitSha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    checks: z
      .array(
        z
          .object({
            name: line.min(1),
            status: z.literal("passed"),
            evidence: z.string().min(1).max(4000),
            acceptanceId: line.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    artifacts: z.array(line).max(100).optional(),
    pullRequest: z.string().url().optional(),
  })
  .strict();
const editSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().max(100000).nullable(),
    acceptance_criteria: z.string().max(100000).nullable(),
    notes: z.string().max(200000).nullable(),
    priority: z.enum(["urgent", "high", "medium", "low"]),
    labels: z.array(z.string().min(1).max(64)).max(24),
    owner: z.string().max(120).nullable(),
    target_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    subtasks: z
      .array(z.object({ id: line, title: z.string().min(1).max(180), done: z.boolean() }).strict())
      .max(100),
    initiative: line,
    parent_id: z.string().uuid().nullable(),
    work_kind: z.enum(["initiative", "feature", "bug", "research", "operations"]),
    work_spec: workSpecSchema,
    sort_order: z.number().finite(),
  })
  .partial()
  .strict();
export const workMutationSchema = z
  .object({
    operation: z.enum(WORK_OPERATIONS),
    id: z.string().uuid().optional(),
    revision: z.number().int().positive().optional(),
    requestKey: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export class WorkBoardError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function validateWorkMutation(raw: unknown) {
  const input = workMutationSchema.parse(raw);
  input.payload = workPayloadSchema(input.operation).parse(input.payload) as Record<
    string,
    unknown
  >;
  if (!["claim", "create", "reorder"].includes(input.operation) && !input.id)
    throw new WorkBoardError("Card id required");
  if (
    !["create", "claim", "heartbeat", "progress", "block", "release", "submit", "reorder"].includes(
      input.operation,
    ) &&
    !input.revision
  )
    throw new WorkBoardError("Revision required", 428);
  return input;
}
export function workPayloadSchema(operation: WorkOperation) {
  const session = { claimToken: z.string().min(43).max(128) };
  const message = z.string().trim().min(10).max(10000);
  let schema: z.ZodType = z.object({}).strict();
  switch (operation) {
    case "reorder":
      schema = z
        .object({
          updates: z
            .array(
              z
                .object({
                  id: z.string().uuid(),
                  revision: z.number().int().positive(),
                  status: z.enum([
                    "backlog",
                    "planned",
                    "blocked",
                    "in_progress",
                    "in_review",
                    "shipped",
                  ]),
                  sort_order: z.number().finite(),
                })
                .strict(),
            )
            .min(1)
            .max(500),
        })
        .strict();
      break;
    case "create":
      schema = editSchema.extend({
        title: z.string().trim().min(1).max(180),
        project_key: z.string().regex(/^[a-z0-9-]{1,80}$/),
        seed_key: z
          .string()
          .regex(/^[a-z0-9-]{1,160}$/)
          .optional(),
      });
      break;
    case "edit":
      schema = editSchema;
      break;
    case "dependencies":
      schema = z.object({ dependencies: z.array(z.string().uuid()).max(100) }).strict();
      break;
    case "claim":
      schema = z.object(session).strict();
      break;
    case "heartbeat":
    case "release":
      schema = z.object(session).strict();
      break;
    case "progress":
    case "block":
      schema = z.object({ ...session, message }).strict();
      break;
    case "submit":
      schema = z.object({ ...session, evidence: workEvidenceSchema }).strict();
      break;
    case "delivery":
      schema = z
        .object({
          message,
          mergedCommit: z
            .string()
            .regex(/^[a-f0-9]{40}$/)
            .optional(),
          mergedAt: z.string().datetime().optional(),
          deploymentUrl: z.string().url().optional(),
          deployedAt: z.string().datetime().optional(),
        })
        .strict()
        .refine(
          (p) => Boolean((p.mergedCommit && p.mergedAt) || (p.deploymentUrl && p.deployedAt)),
          "Supply a merge commit/time or deployment URL/time",
        );
      break;
    case "review":
      schema = z.object({ accept: z.boolean(), message }).strict();
      break;
    case "transition":
      schema = z.object({ status: z.enum(["backlog", "planned", "blocked"]), message }).strict();
      break;
    case "recover":
    case "reopen":
    case "archive":
      schema = z.object({ message }).strict();
      break;
  }
  return schema;
}
export async function mutateWorkBoard(db: SupabaseClient, actor: WorkActor, raw: unknown) {
  const input = validateWorkMutation(raw);
  if (!actor.scopes.includes(input.operation) && !actor.scopes.includes("*"))
    throw new WorkBoardError("Operation not allowed by this credential", 403);
  const payload = { ...input.payload };
  if (input.operation === "claim")
    payload.worker_capabilities = actor.reviewer ? ["*"] : (actor.capabilities ?? []);
  if (typeof payload.claimToken === "string") {
    payload.claim_token_hash = digest(payload.claimToken);
    delete payload.claimToken;
  }
  const { data, error } = await db.rpc(
    input.operation === "reorder" ? "reorder_work_board" : "mutate_work_board",
    {
      p_actor: actor.id,
      p_operation: input.operation,
      p_id: input.id ?? null,
      p_expected_revision: input.revision ?? null,
      p_request_key: input.requestKey,
      p_request_hash: digest(canonical(input)),
      p_payload: payload,
      p_projects: actor.projects,
      p_reviewer: actor.reviewer,
    },
  );
  if (error)
    throw new WorkBoardError(
      error.message,
      (
        { "42501": 403, P0002: 404, "40001": 409, PT409: 409, "23505": 409 } as Record<
          string,
          number
        >
      )[error.code] ?? 400,
    );
  return data;
}
export const WORK_CARD_COLUMNS =
  "id,seed_key,title,description,acceptance_criteria,notes,status,priority,labels,sort_order,owner,target_date,subtasks,source,archived_at,created_at,updated_at,revision,project_key,initiative,parent_id,work_kind,work_spec,work_delivery,work_blocker,lease_owner,lease_expires_at,claimed_at";
export async function listWorkBoard(
  db: SupabaseClient,
  actor: WorkActor,
  options: { offset?: number; limit?: number; id?: string; seedKey?: string } = {},
) {
  if (!actor.scopes.includes("read") && !actor.scopes.includes("*"))
    throw new WorkBoardError("Read scope required", 403);
  if (
    (options.offset !== undefined &&
      (!Number.isSafeInteger(options.offset) || options.offset < 0)) ||
    (options.limit !== undefined && !Number.isSafeInteger(options.limit))
  )
    throw new WorkBoardError("Invalid pagination");
  const offset = Math.max(0, options.offset ?? 0),
    limit = Math.min(500, Math.max(1, options.limit ?? 250));
  let query = db.from("feature_requests").select(WORK_CARD_COLUMNS);
  if (!options.id) query = query.is("archived_at", null);
  if (!actor.projects.includes("*")) query = query.in("project_key", actor.projects);
  if (options.id) query = query.eq("id", options.id);
  if (options.seedKey) query = query.eq("seed_key", options.seedKey);
  const { data, error } = await query
    .order("sort_order")
    .order("id")
    .range(offset, offset + limit);
  if (error) throw new WorkBoardError(error.message, 500);
  const rows = (data ?? []).slice(0, limit);
  const ids = rows.map((row) => row.id);
  const edges = ids.length
    ? await db.from("feature_dependencies").select("card_id,depends_on_id").in("card_id", ids)
    : { data: [], error: null };
  if (edges.error) throw new WorkBoardError(edges.error.message, 500);
  // One SQL call per page, including canonical readiness; never guess readiness in an adapter.
  const readiness = ids.length
    ? await db.rpc("work_board_readiness_many", { p_ids: ids })
    : { data: [], error: null };
  if (readiness.error) throw new WorkBoardError(readiness.error.message, 500);
  const reasons = new Map<string, string[]>(
    (readiness.data ?? []).map((row: { id: string; reasons: string[] }) => [row.id, row.reasons]),
  );
  return {
    schemaReady: true,
    features: rows.map((row) => ({
      ...row,
      readiness: [
        ...(reasons.get(row.id) ?? []),
        ...(!actor.reviewer &&
        (row.work_spec?.requiredCapabilities ?? []).some(
          (cap: string) => !actor.capabilities?.includes(cap),
        )
          ? ["worker_capabilities_missing"]
          : []),
      ],
      dependencies: (edges.data ?? [])
        .filter((e) => e.card_id === row.id)
        .map((e) => e.depends_on_id),
    })),
    nextOffset: (data?.length ?? 0) > limit ? offset + limit : null,
  };
}
export async function authenticateWorkAgent(
  db: SupabaseClient,
  token: string | null,
): Promise<WorkActor> {
  if (!token || !/^awb_[A-Za-z0-9_-]{43}$/.test(token))
    throw new WorkBoardError("Agent credential required", 401);
  const { data, error } = await db
    .from("work_board_agents")
    .select("id,projects,scopes,capabilities")
    .eq("token_hash", digest(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data)
    throw new WorkBoardError("Agent credential is invalid, expired or revoked", 401);
  return {
    id: `agent:${data.id}`,
    projects: data.projects,
    scopes: data.scopes,
    capabilities: data.capabilities,
    reviewer: false,
  };
}
export async function issueWorkAgent(db: SupabaseClient, input: unknown) {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      projects: z
        .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
        .min(1)
        .max(20),
      scopes: z
        .array(
          z.enum([
            "read",
            "create",
            "edit",
            "dependencies",
            "claim",
            "heartbeat",
            "progress",
            "block",
            "release",
            "submit",
          ]),
        )
        .min(1),
      capabilities: z
        .array(z.string().regex(/^[a-z0-9-]{1,80}$/))
        .max(50)
        .default([]),
      days: z.number().int().min(1).max(90).default(30),
    })
    .strict()
    .parse(input);
  const token = `awb_${randomBytes(32).toString("base64url")}`;
  const { data, error } = await db
    .from("work_board_agents")
    .insert({
      name: parsed.name,
      projects: parsed.projects,
      capabilities: parsed.capabilities,
      scopes: [...new Set(parsed.scopes)],
      token_hash: digest(token),
      expires_at: new Date(Date.now() + parsed.days * 86400000).toISOString(),
    })
    .select("id,name,projects,scopes,expires_at")
    .single();
  if (error) throw new WorkBoardError(error.message, 500);
  return { ...data, token };
}
export async function workHistory(db: SupabaseClient, actor: WorkActor, id: string) {
  const context = await listWorkBoard(db, actor, { id });
  if (!context.features.length) throw new WorkBoardError("Card not found", 404);
  const { data, error } = await db
    .from("work_board_events")
    .select("id,actor,operation,revision,created_at,payload")
    .eq("card_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new WorkBoardError(error.message, 500);
  return data;
}

export async function revokeWorkAgent(db: SupabaseClient, id: string) {
  z.string().uuid().parse(id);
  const { error } = await db
    .from("work_board_agents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new WorkBoardError(error.message, 500);
}
export const workViewSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    shared: z.boolean(),
    filters: z
      .object({
        search: z.string().max(500),
        milestone: z.string().max(100),
        category: z.string().max(100),
        capability: z.string().max(100),
        ownerFilter: z.string().max(120),
        priority: z.string().max(20),
        queue: z.string().max(30),
      })
      .strict(),
  })
  .strict();
export async function saveWorkView(db: SupabaseClient, owner: string, raw: unknown) {
  const body = workViewSchema.parse(raw);
  const { data, error } = await db
    .from("work_board_views")
    .insert({ ...body, owner })
    .select()
    .single();
  if (error) throw new WorkBoardError(error.message, 500);
  return data;
}
export async function deleteWorkView(db: SupabaseClient, owner: string, id: string) {
  z.string().uuid().parse(id);
  const { data, error } = await db
    .from("work_board_views")
    .delete()
    .eq("id", id)
    .eq("owner", owner)
    .select("id")
    .maybeSingle();
  if (error) throw new WorkBoardError(error.message, 500);
  if (!data) throw new WorkBoardError("Saved view not found or owned by another operator", 404);
}

/** Public intake has create-only authority and never accepts work metadata. */
export async function submitPublicWorkSuggestion(db: SupabaseClient, raw: unknown) {
  const input = z
    .object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().min(1).max(2000),
      email: z.string().max(254).email().optional(),
    })
    .strict()
    .parse(raw);
  const requestKey = randomUUID();
  const result = await mutateWorkBoard(
    db,
    {
      id: "public-roadmap-submission",
      projects: ["accelerate"],
      scopes: ["create"],
      reviewer: false,
    },
    {
      operation: "create",
      requestKey,
      payload: {
        project_key: "accelerate",
        seed_key: `community-${requestKey}`,
        title: input.title,
        description: input.description,
        priority: "low",
        labels: [],
        notes: `Submitted ${new Date().toISOString()} via the public roadmap suggestion form.${input.email ? ` Contact: ${input.email}` : " No contact provided."}`,
      },
    },
  );
  try {
    const { error } = await db.from("admin_notifications").insert({
      type: "roadmap_suggestion",
      title: `New roadmap suggestion: ${input.title}`,
      description: input.description.slice(0, 200),
      link: "/admin/features",
    });
    if (error) console.error("Roadmap suggestion saved; operator notification failed");
  } catch {
    console.error("Roadmap suggestion saved; operator notification failed");
  }
  return result;
}

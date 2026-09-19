import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  callFormBuilderRpc,
  createPlatformServiceRoleClient,
  tenantIdForDatabase,
} from "@/lib/supabase/server";
import { ingestInboundLead } from "./inbound";
import { isModuleEnabled } from "./modules";
import { proposeAction } from "./actions";
import {
  formDigestSchema,
  prepareFormDraftInputSchema,
  proposeFormDraftInputSchema,
  proposeFormPublishInputSchema,
} from "./form-builder-contract";

export const FORM_BUILDER_CONTRACT = "form-builder.v1";
const SCHEMA_MAX_BYTES = 32 * 1024;
const MAX_ELEMENTS = 40;
const MAX_CHOICES = 30;

const choiceSchema = z.string().trim().min(1).max(200);
const baseElement = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]{0,63}$/),
  title: z.string().trim().max(200).optional(),
  isRequired: z.boolean().optional(),
});
const fieldElement = baseElement.extend({
  type: z.enum(["text", "comment", "dropdown", "radiogroup", "checkbox", "boolean", "rating"]),
  inputType: z.enum(["text", "email", "tel", "number", "date"]).optional(),
  choices: z.array(choiceSchema).min(1).max(MAX_CHOICES).optional(),
  rateMax: z.number().int().min(2).max(10).optional(),
});
const panelElement = baseElement.extend({
  type: z.literal("panel"),
  elements: z.array(fieldElement).min(1).max(MAX_ELEMENTS),
});
const formElementSchema = z.union([fieldElement, panelElement]);

/** Bounded SurveyJS-compatible definition. The renderer receives this exact shape. */
const formMetaShape = {
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
};
export const formSchemaValidator = z
  .object({
    ...formMetaShape,
    elements: z.array(formElementSchema).min(1).max(MAX_ELEMENTS),
  })
  .strict()
  .superRefine((schema, context) => {
    const names = new Set<string>();
    const collect = (elements: Array<z.infer<typeof formElementSchema>>) => {
      for (const element of elements) {
        if (names.has(element.name)) {
          context.addIssue({ code: "custom", message: `Duplicate field name: ${element.name}` });
          return;
        }
        names.add(element.name);
        if (element.type === "panel") collect(element.elements);
        if (
          (element.type === "dropdown" ||
            element.type === "radiogroup" ||
            element.type === "checkbox") &&
          !element.choices
        ) {
          context.addIssue({
            code: "custom",
            message: `Choice field needs options: ${element.name}`,
          });
        }
      }
    };
    collect(schema.elements);
    if (names.size > MAX_ELEMENTS)
      context.addIssue({
        code: "custom",
        message: "Forms support at most 40 elements, including panel fields",
      });
  });

export type FormSchema = z.infer<typeof formSchemaValidator>;

/** Stored rows include empty new drafts, so reads accept zero elements.
 * Writes and publication always go through formSchemaValidator. */
const storedFormSchemaValidator = z
  .object({
    ...formMetaShape,
    elements: z.array(formElementSchema).max(MAX_ELEMENTS),
  })
  .strict();

export type StoredFormSchema = z.infer<typeof storedFormSchemaValidator>;

const responseValueSchema = z.union([
  z.string().trim().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().max(200).or(z.number().finite()).or(z.boolean())).max(MAX_CHOICES),
]);
export const formResponseValidator = z.record(z.string().max(64), responseValueSchema);

/** The public renderer is not a trust boundary. Validate every answer here. */
export function validateFormResponse(schema: FormSchema, input: unknown) {
  const response = formResponseValidator.parse(input);
  const fields = schema.elements.flatMap((element) =>
    element.type === "panel" ? element.elements : [element],
  );
  const names = new Set(fields.map((field) => field.name));
  if (Object.keys(response).some((key) => !names.has(key)))
    throw new Error("Response contains an unknown field");
  for (const field of fields) {
    const value = response[field.name];
    const empty = value === undefined || value === "" || (Array.isArray(value) && !value.length);
    if (empty) {
      if (field.isRequired) throw new Error(`Answer required: ${field.name}`);
      continue;
    }
    let valid: boolean;
    switch (field.type) {
      case "boolean":
        valid = typeof value === "boolean";
        break;
      case "rating":
        valid =
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= (field.rateMax ?? 5);
        break;
      case "checkbox":
        valid =
          Array.isArray(value) &&
          new Set(value).size === value.length &&
          value.every((choice) => typeof choice === "string" && field.choices?.includes(choice));
        break;
      case "dropdown":
      case "radiogroup":
        valid = typeof value === "string" && !!field.choices?.includes(value);
        break;
      default:
        valid =
          field.type === "text" && field.inputType === "number"
            ? typeof value === "number" && Number.isFinite(value)
            : typeof value === "string";
        if (valid && field.inputType === "email") valid = z.email().safeParse(value).success;
        if (valid && field.inputType === "date")
          valid =
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(value) &&
            !Number.isNaN(Date.parse(value)) &&
            new Date(value).toISOString().slice(0, 10) === value;
    }
    if (!valid) throw new Error(`Invalid answer: ${field.name}`);
  }
  return response;
}

/** The high-entropy token is the only cross-tenant public lookup credential.
 * The privileged client stays inside this bounded service. */
export async function readPublicForm(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const database = createPlatformServiceRoleClient("forms:public-token");
  const form = await getPublishedFormByToken(database, token);
  return form && (await isFormModuleEnabled(database, form.tenantId)) ? form : null;
}

export type FormDefinition = {
  id: string;
  name: string;
  description: string;
  schema: StoredFormSchema;
  status: "draft" | "published" | "archived";
  share_token: string;
  published_at: string | null;
  updated_at: string;
};

export type FormSubmission = {
  id: string;
  form_id: string;
  response: Record<string, unknown>;
  contact_name: string | null;
  contact_email: string | null;
  status: "pending_review" | "accepted" | "rejected";
  created_at: string;
  intake?: { id: string; status: string; expiresAt: string | null };
};

function newShareToken() {
  return randomBytes(32).toString("hex");
}

function assertSchemaSize(schema: unknown) {
  if (Buffer.byteLength(JSON.stringify(schema), "utf8") > SCHEMA_MAX_BYTES) {
    throw new Error("Form definition exceeds the 32 KiB limit");
  }
}

function toDefinition(row: Record<string, unknown>): FormDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    schema: storedFormSchemaValidator.parse(row.schema),
    status: row.status as FormDefinition["status"],
    share_token: row.share_token as string,
    published_at: (row.published_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

export async function listFormDefinitions(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<FormDefinition[]> {
  const { data, error } = await supabase
    .from("form_definitions")
    .select("id,name,description,schema,status,share_token,published_at,updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toDefinition);
}

async function writeFormDefinition(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string; expectedUpdatedAt?: string },
  operation: "create" | "save" | "status",
  patch: Record<string, unknown>,
) {
  if (tenantIdForDatabase(supabase) !== input.tenantId)
    throw new Error("Form command does not match its workspace");
  const { data, error } = await callFormBuilderRpc(supabase, "write_form_definition", {
    p_operation: operation,
    p_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_patch: patch,
    p_actor_email: input.actorEmail,
  });
  if (error) throw new Error(error.message);
  return toDefinition(data as Record<string, unknown>);
}

export async function createFormDefinition(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    name: string;
    description?: string;
    actorEmail: string;
    schema?: unknown;
  },
): Promise<FormDefinition> {
  const name = z.string().trim().min(1).max(120).parse(input.name);
  const schema =
    input.schema === undefined ? { elements: [] } : formSchemaValidator.parse(input.schema);
  assertSchemaSize(schema);
  return writeFormDefinition(supabase, { ...input, id: randomUUID() }, "create", {
    name,
    description: z
      .string()
      .trim()
      .max(2000)
      .parse(input.description ?? ""),
    schema,
    share_token: newShareToken(),
  });
}

export async function saveFormDefinition(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    id: string;
    name?: string;
    description?: string;
    schema: unknown;
    actorEmail: string;
    expectedUpdatedAt: string;
  },
): Promise<FormDefinition> {
  const schema = formSchemaValidator.parse(input.schema);
  assertSchemaSize(schema);
  z.iso.datetime({ offset: true }).parse(input.expectedUpdatedAt);
  return writeFormDefinition(supabase, input, "save", {
    schema,
    ...(input.name === undefined
      ? {}
      : { name: z.string().trim().min(1).max(120).parse(input.name) }),
    ...(input.description === undefined
      ? {}
      : { description: z.string().trim().max(2000).parse(input.description) }),
  });
}

export async function setFormStatus(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    id: string;
    status: "draft" | "published" | "archived";
    actorEmail: string;
    expectedUpdatedAt: string;
  },
): Promise<FormDefinition> {
  z.iso.datetime({ offset: true }).parse(input.expectedUpdatedAt);
  const { data: current, error } = await supabase
    .from("form_definitions")
    .select("schema,updated_at")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("Form not found");
  const schema =
    input.status === "published" ? formSchemaValidator.parse(current.schema) : current.schema;
  return writeFormDefinition(supabase, input, "status", { status: input.status, schema });
}

/** Public links resolve only while the workspace keeps the module on. */
export async function isFormModuleEnabled(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenants")
    .select("status,config")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return false;
  const modules = (data as { config?: { modules?: Partial<Record<string, boolean>> } }).config
    ?.modules;
  return isModuleEnabled("form-builder", { modules });
}

/** Public surface. Token is the credential; only published forms resolve. */
export async function getPublishedFormByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{
  id: string;
  tenantId: string;
  name: string;
  description: string;
  schema: FormSchema;
} | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await supabase
    .from("form_definitions")
    .select("id,tenant_id,name,description,schema,status")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data || data.status !== "published") return null;
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    name: data.name as string,
    description: data.description as string,
    schema: formSchemaValidator.parse(data.schema),
  };
}

function extractContact(response: Record<string, unknown>) {
  let contactEmail: string | null = null;
  let contactName: string | null = null;
  for (const [key, value] of Object.entries(response)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254) {
      contactEmail = trimmed.toLowerCase();
    }
    if (!contactName && /name/.test(key.toLowerCase()) && trimmed.length >= 1) {
      contactName = trimmed.slice(0, 120);
    }
  }
  return { contactName, contactEmail };
}

export async function recordFormSubmission(
  supabase: SupabaseClient,
  input: { token: string; schema: FormSchema; response: unknown; requestId: string },
): Promise<{ submissionId: string; duplicate: boolean; contactEmail: string | null }> {
  const response = validateFormResponse(input.schema, input.response);
  const { contactName, contactEmail } = extractContact(response);
  const { data, error } = await supabase.rpc("record_form_submission", {
    p_token: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.token),
    p_request_id: z.uuid().parse(input.requestId),
    p_response: response,
    p_schema: input.schema,
    p_contact_name: contactName,
    p_contact_email: contactEmail,
  });
  if (error) throw new Error(error.message);
  return z
    .object({
      submissionId: z.uuid(),
      duplicate: z.boolean(),
      contactEmail: z.string().nullable(),
    })
    .strict()
    .parse(data);
}

/** Resolve and validate before calling the host-only atomic submission command. */
export async function submitPublicForm(token: string, response: unknown, requestId: string) {
  const form = await readPublicForm(token);
  if (!form) throw new Error("Form not found");
  return recordFormSubmission(createPlatformServiceRoleClient("forms:public-submit"), {
    token,
    schema: form.schema,
    response,
    requestId,
  });
}

export async function listFormSubmissions(
  supabase: SupabaseClient,
  tenantId: string,
  input: { formId?: string; status?: FormSubmission["status"] } = {},
): Promise<FormSubmission[]> {
  let query = supabase
    .from("form_submissions")
    .select("id,form_id,response,contact_name,contact_email,status,created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (input.formId) query = query.eq("form_id", input.formId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const submissions = (data ?? []) as FormSubmission[];
  const accepted = submissions.filter((row) => row.status === "accepted").map((row) => row.id);
  if (!accepted.length) return submissions;
  const actions = await supabase
    .from("action_queue")
    .select("id,status,expires_at,payload")
    .eq("tenant_id", tenantId)
    .eq("action_type", "accept_form_submission")
    .in("payload->>submissionId", accepted)
    .order("created_at", { ascending: false })
    .limit(50);
  if (actions.error)
    throw new Error("Form intake status is unavailable. Retry without reviewing responses again.");
  return submissions.map((row) => {
    const action = actions.data?.find((action) => action.payload.submissionId === row.id);
    return action
      ? { ...row, intake: { id: action.id, status: action.status, expiresAt: action.expires_at } }
      : row;
  });
}

/**
 * Accept a reviewed submission into the canonical intake pipeline. Uses the
 * same identity resolution and opportunity matching as every other surface,
 * so a form never creates a parallel lead store.
 */
async function reviewFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string; requestId: string },
  decision: "accepted" | "rejected",
) {
  if (tenantIdForDatabase(supabase) !== input.tenantId)
    throw new Error("Form review does not match its workspace");
  const { data, error } = await callFormBuilderRpc(supabase, "review_form_submission", {
    p_id: input.id,
    p_decision: decision,
    p_request_id: input.requestId,
    p_actor_email: input.actorEmail,
  });
  if (error) throw new Error(error.message);
  return z
    .object({
      submissionId: z.uuid(),
      decision: z.enum(["accepted", "rejected"]),
      duplicate: z.boolean(),
      actionId: z.uuid().nullable(),
    })
    .strict()
    .parse(data);
}

export async function acceptFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string; requestId: string },
) {
  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("contact_email")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!submission) throw new Error("Submission not found");
  if (!submission.contact_email)
    throw new Error("This response has no email address, so it cannot become a lead");
  const receipt = await reviewFormSubmission(supabase, input, "accepted");
  let intakeStatus: "completed" | "pending" | "needs_attention" = "pending";
  // Review is durable even when intake fails. The action queue preserves the
  // exact intent and failure for operator recovery instead of losing the lead.
  try {
    const current = await supabase
      .from("action_queue")
      .select("status")
      .eq("tenant_id", input.tenantId)
      .eq("id", receipt.actionId!)
      .maybeSingle();
    if (current.error || !current.data) throw new Error("Intake state unavailable");
    if (current.data.status === "pending") {
      const { approveAndExecuteAction } = await import("./action-executor");
      await approveAndExecuteAction(supabase, receipt.actionId!, input.actorEmail);
      intakeStatus = "completed";
    } else if (current.data.status === "executed") intakeStatus = "completed";
    else if (current.data.status !== "executing") intakeStatus = "needs_attention";
  } catch {
    console.warn(
      "[forms] Accepted response intake needs attention; retained action is available for recovery",
    );
    intakeStatus = "needs_attention";
  }
  return { ...receipt, intakeStatus };
}

export async function rejectFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string; requestId: string },
) {
  return reviewFormSubmission(supabase, input, "rejected");
}

/** Called only by the existing claimed-action executor, never by public input. */
export async function executeFormIntake(supabase: SupabaseClient, raw: unknown, actionId: string) {
  const input = z.object({ tenantId: z.uuid(), submissionId: z.uuid() }).strict().parse(raw);
  if (tenantIdForDatabase(supabase) !== input.tenantId)
    throw new Error("Form intake does not match its workspace");
  if (!(await isFormModuleEnabled(supabase, input.tenantId)))
    throw new Error("Form builder is disabled");
  const action = await supabase
    .from("action_queue")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("id", actionId)
    .eq("action_type", "accept_form_submission")
    .eq("status", "executing")
    .maybeSingle();
  if (action.error || !action.data) throw new Error("A claimed form intake approval is required");
  const { data: submission, error } = await supabase
    .from("form_submissions")
    .select("id,form_id,contact_email,contact_name,status")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.submissionId)
    .maybeSingle();
  if (error || !submission || submission.status !== "accepted" || !submission.contact_email)
    throw new Error("Accepted form response is unavailable");
  const form = await supabase
    .from("form_definitions")
    .select("name")
    .eq("tenant_id", input.tenantId)
    .eq("id", submission.form_id)
    .maybeSingle();
  if (form.error) throw new Error(form.error.message);
  const email = submission.contact_email as string;
  const result = await ingestInboundLead(supabase, {
    name: (
      (submission.contact_name as string | null) ??
      email.split("@")[0] ??
      "Website inquiry"
    ).slice(0, 120),
    email,
    source: "contact_form",
    sourceRecordId: `form-submission:${submission.id}`,
    summary: `Form response: ${form.data?.name ?? "untitled form"}`,
  });
  return { submissionId: input.submissionId, opportunityId: result.opportunity.id };
}

// --- Central AI authoring: prepare, propose, approved execution ---
//
// The assistant builds forms through the same validators and services as
// /admin/forms. Draft saves and publication both stage an exact,
// digest-bound proposal into action_queue; approved execution revalidates
// the digest, the module state and the draft before writing anything.

const digestSchema = formDigestSchema;
const formDraftInputSchema = prepareFormDraftInputSchema;

export { prepareFormDraftInputSchema, proposeFormDraftInputSchema, proposeFormPublishInputSchema };

const formDigest = (facts: unknown) =>
  createHash("sha256").update(JSON.stringify(facts)).digest("hex");

function draftFacts(
  tenantId: string,
  input: {
    formId?: string;
    name: string;
    description?: string;
    schema: FormSchema;
    expectedUpdatedAt?: string | null;
  },
) {
  return {
    version: 1 as const,
    tenantId,
    formId: input.formId ?? null,
    name: input.name,
    description: input.description ?? "",
    schema: input.schema,
    expectedUpdatedAt: input.expectedUpdatedAt ?? null,
  };
}

/** Validate AI-authored form content without writing anything. */
export async function prepareFormDraft(supabase: SupabaseClient, raw: unknown) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Forms requires a tenant-bound workspace");
  const input = formDraftInputSchema.parse(raw);
  const schema = formSchemaValidator.parse(input.schema);
  assertSchemaSize(schema);
  let expectedUpdatedAt: string | null = null;
  if (input.formId) {
    const { data: current } = await supabase
      .from("form_definitions")
      .select("id,status,updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", input.formId)
      .maybeSingle();
    if (!current) throw new Error("Form not found");
    if (current.status !== "draft") throw new Error("Unpublish a live form before editing it");
    expectedUpdatedAt = current.updated_at as string;
  }
  const facts = draftFacts(tenantId, {
    formId: input.formId,
    name: input.name,
    description: input.description,
    schema,
    expectedUpdatedAt,
  });
  return { ...facts, digest: formDigest(facts), requiresHumanApproval: true };
}

/** Stage an exact reviewed draft for human approval. Creates or updates a draft only. */
export async function proposeFormDraft(supabase: SupabaseClient, raw: unknown, actorEmail: string) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Forms requires a tenant-bound workspace");
  const input = proposeFormDraftInputSchema.parse(raw);
  const preview = await prepareFormDraft(supabase, {
    formId: input.formId,
    name: input.name,
    description: input.description,
    schema: input.schema,
  });
  if (preview.digest !== input.digest)
    throw new Error("Form preview changed. Prepare the draft again before proposing.");
  const payload = {
    version: preview.version,
    tenantId: preview.tenantId,
    formId: preview.formId,
    name: preview.name,
    description: preview.description,
    schema: preview.schema,
    expectedUpdatedAt: preview.expectedUpdatedAt,
    digest: preview.digest,
  };
  return proposeAction(supabase, {
    actionType: "save_form_definition",
    title: input.formId ? `Update form draft: ${input.name}` : `Create form draft: ${input.name}`,
    description: `${preview.schema.elements.length} fields. Draft only; publication is a separate approval.`,
    payload: payload as unknown as Record<string, unknown>,
    sourceContext: "admin_ai",
    entityType: "form_definition",
    entityId: input.formId ?? undefined,
    dedupeKey: `form-draft:${tenantId}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

/** Stage publication of the exact reviewed draft schema. */
export async function proposeFormPublish(
  supabase: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Forms requires a tenant-bound workspace");
  const input = proposeFormPublishInputSchema.parse(raw);
  const { data: current, error } = await supabase
    .from("form_definitions")
    .select("id,name,description,status,schema,updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", input.formId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("Form not found");
  if (current.status !== "draft") throw new Error("Only drafts can be published");
  const schema = formSchemaValidator.parse(current.schema);
  const facts = draftFacts(tenantId, {
    formId: input.formId,
    name: current.name as string,
    description: (current.description as string | null) ?? "",
    schema,
    expectedUpdatedAt: current.updated_at as string,
  });
  const digest = formDigest(facts);
  if (digest !== input.digest)
    throw new Error("Form changed since review. Prepare the draft again before proposing.");
  return proposeAction(supabase, {
    actionType: "publish_form",
    title: `Publish form: ${current.name}`,
    description: "Publication creates the public share link. Unpublish to retire it.",
    payload: { ...facts, digest } as unknown as Record<string, unknown>,
    sourceContext: "admin_ai",
    entityType: "form_definition",
    entityId: input.formId,
    dedupeKey: `form-publish:${tenantId}:${input.formId}:${digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

const savePayloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    formId: z.uuid().nullable(),
    name: z.string(),
    description: z.string(),
    schema: z.unknown(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    digest: digestSchema,
  })
  .strict();

/** Approved execution: revalidates digest, module and draft state, then writes. */
export async function executeFormDefinitionSave(
  supabase: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = savePayloadSchema.parse(raw);
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId || input.tenantId !== tenantId)
    throw new Error("Form approval does not match its workspace");
  const { digest, ...facts } = input;
  if (formDigest(facts) !== digest)
    throw new Error("Form approval does not match its exact preview");
  if (!(await isFormModuleEnabled(supabase, tenantId)))
    throw new Error("Form builder is disabled for this workspace");
  if (input.formId) {
    return saveFormDefinition(supabase, {
      tenantId,
      id: input.formId,
      name: input.name,
      description: input.description,
      schema: input.schema,
      actorEmail,
      expectedUpdatedAt: z.iso.datetime({ offset: true }).parse(input.expectedUpdatedAt),
    });
  }
  return createFormDefinition(supabase, {
    tenantId,
    name: input.name,
    description: input.description,
    actorEmail,
    schema: input.schema,
  });
}

const publishPayloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    formId: z.uuid(),
    name: z.string(),
    description: z.string(),
    schema: z.unknown(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    digest: digestSchema,
  })
  .strict();

export async function executeFormPublish(
  supabase: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = publishPayloadSchema.parse(raw);
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId || input.tenantId !== tenantId)
    throw new Error("Form approval does not match its workspace");
  const { digest, ...facts } = input;
  if (formDigest(facts) !== digest)
    throw new Error("Form approval does not match its exact preview");
  if (!(await isFormModuleEnabled(supabase, tenantId)))
    throw new Error("Form builder is disabled for this workspace");
  const { data: current, error } = await supabase
    .from("form_definitions")
    .select("id,name,description,status,schema,updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", input.formId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current || current.status !== "draft")
    throw new Error("Only the reviewed draft can be published");
  const live = formSchemaValidator.parse(current.schema);
  const liveFacts = draftFacts(tenantId, {
    formId: input.formId,
    name: current.name as string,
    description: (current.description as string | null) ?? "",
    schema: live,
    expectedUpdatedAt: current.updated_at as string,
  });
  if (formDigest(liveFacts) !== digest)
    throw new Error("Form changed after approval. Review the new draft first.");
  return setFormStatus(supabase, {
    tenantId,
    id: input.formId,
    status: "published",
    actorEmail,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

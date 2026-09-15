import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { recordAudit } from "./audit";
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

export async function createFormDefinition(
  supabase: SupabaseClient,
  input: { tenantId: string; name: string; description?: string; actorEmail: string },
): Promise<FormDefinition> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 120) throw new Error("Name must be 1 to 120 characters");
  const description = (input.description ?? "").trim().slice(0, 2000);
  const { data, error } = await supabase
    .from("form_definitions")
    .insert({
      tenant_id: input.tenantId,
      name,
      description,
      schema: { elements: [] },
      status: "draft",
      share_token: newShareToken(),
    })
    .select("id,name,description,schema,status,share_token,published_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "form_builder.create_definition",
    entityType: "form_definition",
    entityId: (data as { id: string }).id,
    after: { name },
  });
  return toDefinition(data as Record<string, unknown>);
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
  },
): Promise<FormDefinition> {
  const schema = formSchemaValidator.parse(input.schema);
  assertSchemaSize(schema);
  const { data: current, error: readError } = await supabase
    .from("form_definitions")
    .select("id,status")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Form not found");
  if (current.status !== "draft") throw new Error("Unpublish a live form before editing it");
  const patch: Record<string, unknown> = {
    schema,
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 120) throw new Error("Name must be 1 to 120 characters");
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description.trim().slice(0, 2000);
  const { data, error } = await supabase
    .from("form_definitions")
    .update(patch)
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .select("id,name,description,schema,status,share_token,published_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "form_builder.save_definition",
    entityType: "form_definition",
    entityId: input.id,
  });
  return toDefinition(data as Record<string, unknown>);
}

export async function setFormStatus(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    id: string;
    status: "draft" | "published" | "archived";
    actorEmail: string;
  },
): Promise<FormDefinition> {
  const { data: current, error: readError } = await supabase
    .from("form_definitions")
    .select("id,status,schema")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!current) throw new Error("Form not found");
  if (input.status === "published") {
    // A published link must always render. Validate the stored shape first.
    const stored = storedFormSchemaValidator.parse(current.schema);
    if (stored.elements.length === 0) throw new Error("Add at least one field before publishing");
  }
  if (current.status === "archived" && input.status === "published") {
    throw new Error("Archived forms stay archived. Duplicate the form to publish again.");
  }
  const { data, error } = await supabase
    .from("form_definitions")
    .update({
      status: input.status,
      published_at: input.status === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .select("id,name,description,schema,status,share_token,published_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: `form_builder.${input.status}`,
    entityType: "form_definition",
    entityId: input.id,
    before: { status: current.status },
    after: { status: input.status },
  });
  return toDefinition(data as Record<string, unknown>);
}

/** Public links resolve only while the workspace keeps the module on. */
export async function isFormModuleEnabled(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<boolean> {
  const { data } = await supabase.from("tenants").select("config").eq("id", tenantId).maybeSingle();
  if (!data) return false;
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
  input: { formId: string; tenantId: string; response: unknown; requestId: string },
): Promise<{ submissionId: string; duplicate: boolean; contactEmail: string | null }> {
  const response = formResponseValidator.parse(input.response) as Record<string, unknown>;
  if (Object.keys(response).length === 0 || Object.keys(response).length > MAX_ELEMENTS) {
    throw new Error("Response must answer 1 to 40 fields");
  }
  const { data: replay } = await supabase
    .from("form_submission_commands")
    .select("result")
    .eq("tenant_id", input.tenantId)
    .eq("request_id", input.requestId)
    .maybeSingle();
  if (replay) {
    const stored = replay.result as { submissionId: string; contactEmail?: string | null };
    return {
      submissionId: stored.submissionId,
      duplicate: true,
      contactEmail: stored.contactEmail ?? null,
    };
  }
  const { contactName, contactEmail } = extractContact(response);
  const { data, error } = await supabase
    .from("form_submissions")
    .insert({
      tenant_id: input.tenantId,
      form_id: input.formId,
      response,
      contact_name: contactName,
      contact_email: contactEmail,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const result = { submissionId: (data as { id: string }).id, duplicate: false, contactEmail };
  await supabase
    .from("form_submission_commands")
    .insert({ tenant_id: input.tenantId, request_id: input.requestId, result });
  return result;
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
  return (data ?? []) as FormSubmission[];
}

/**
 * Accept a reviewed submission into the canonical intake pipeline. Uses the
 * same identity resolution and opportunity matching as every other surface,
 * so a form never creates a parallel lead store.
 */
export async function acceptFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string; requestId: string },
): Promise<{ submissionId: string; duplicate: boolean }> {
  const { data: replay } = await supabase
    .from("form_submission_commands")
    .select("result")
    .eq("tenant_id", input.tenantId)
    .eq("request_id", input.requestId)
    .maybeSingle();
  if (replay) return { ...(replay.result as { submissionId: string }), duplicate: true };
  const { data: submission, error: readError } = await supabase
    .from("form_submissions")
    .select("id,form_id,response,contact_name,contact_email,status")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!submission) throw new Error("Submission not found");
  if (submission.status !== "pending_review") throw new Error("Submission was already reviewed");
  const email = (submission.contact_email as string | null) ?? null;
  if (!email) throw new Error("This response has no email address, so it cannot become a lead");
  const { data: form } = await supabase
    .from("form_definitions")
    .select("name")
    .eq("tenant_id", input.tenantId)
    .eq("id", submission.form_id)
    .maybeSingle();
  await ingestInboundLead(supabase, {
    name: (
      (submission.contact_name as string | null) ??
      email.split("@")[0] ??
      "Website inquiry"
    ).slice(0, 120),
    email,
    source: "contact_form",
    sourceRecordId: `form-submission:${submission.id}`,
    summary: `Form response: ${(form?.name as string | undefined) ?? "untitled form"}`,
  });
  const { error: updateError } = await supabase
    .from("form_submissions")
    .update({
      status: "accepted",
      reviewer_email: input.actorEmail,
      reviewed_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .eq("status", "pending_review");
  if (updateError) throw new Error(updateError.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "form_builder.accept_submission",
    entityType: "form_submission",
    entityId: input.id,
    after: { status: "accepted" },
  });
  const result = { submissionId: input.id, duplicate: false };
  await supabase
    .from("form_submission_commands")
    .insert({ tenant_id: input.tenantId, request_id: input.requestId, result });
  return result;
}

export async function rejectFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; id: string; actorEmail: string },
): Promise<void> {
  const { error } = await supabase
    .from("form_submissions")
    .update({
      status: "rejected",
      reviewer_email: input.actorEmail,
      reviewed_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.id)
    .eq("status", "pending_review");
  if (error) throw new Error(error.message);
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "form_builder.reject_submission",
    entityType: "form_submission",
    entityId: input.id,
    after: { status: "rejected" },
  });
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
  },
) {
  return {
    version: 1 as const,
    tenantId,
    formId: input.formId ?? null,
    name: input.name,
    description: input.description ?? "",
    schema: input.schema,
  };
}

/** Validate AI-authored form content without writing anything. */
export async function prepareFormDraft(supabase: SupabaseClient, raw: unknown) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Forms requires a tenant-bound workspace");
  const input = formDraftInputSchema.parse(raw);
  const schema = formSchemaValidator.parse(input.schema);
  assertSchemaSize(schema);
  if (input.formId) {
    const { data: current } = await supabase
      .from("form_definitions")
      .select("id,status")
      .eq("tenant_id", tenantId)
      .eq("id", input.formId)
      .maybeSingle();
    if (!current) throw new Error("Form not found");
    if (current.status !== "draft") throw new Error("Unpublish a live form before editing it");
  }
  const facts = draftFacts(tenantId, {
    formId: input.formId,
    name: input.name,
    description: input.description,
    schema,
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
    .select("id,name,description,status,schema")
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
    });
  }
  return createFormDefinition(supabase, {
    tenantId,
    name: input.name,
    description: input.description,
    actorEmail,
  }).then(async (created) =>
    saveFormDefinition(supabase, {
      tenantId,
      id: created.id,
      name: input.name,
      description: input.description,
      schema: input.schema,
      actorEmail,
    }),
  );
}

const publishPayloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    formId: z.uuid(),
    name: z.string(),
    description: z.string(),
    schema: z.unknown(),
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
    .select("id,name,description,status,schema")
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
  });
  if (formDigest(liveFacts) !== digest)
    throw new Error("Form changed after approval. Review the new draft first.");
  return setFormStatus(supabase, { tenantId, id: input.formId, status: "published", actorEmail });
}

/**
 * Best-effort operator notice for a stored public submission. Lives in the
 * domain service so the public route never writes a business table directly;
 * a notification failure never fails the visitor's submit.
 */
export async function notifyFormSubmission(
  supabase: SupabaseClient,
  input: { tenantId: string; formName: string; contactEmail: string | null },
): Promise<void> {
  try {
    const { error } = await supabase.from("admin_notifications").insert({
      tenant_id: input.tenantId,
      type: "new_form_response",
      title: `New response: ${input.formName}`.slice(0, 120),
      description: input.contactEmail
        ? `From ${input.contactEmail}. Review in Forms.`
        : "A new response is waiting for review in Forms.",
      link: "/admin/forms",
      priority: "info",
    });
    if (error) console.warn("[forms] response notification failed", error.message);
  } catch (error) {
    console.warn(
      "[forms] response notification failed",
      error instanceof Error ? error.message : "UnknownError",
    );
  }
}

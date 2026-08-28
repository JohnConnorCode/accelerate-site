import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "@/lib/email/resend";
import { EMAIL_TEMPLATE_DEFINITIONS, getEmailTemplateDefinition, renderDefinition, replaceEmailVariables } from "@/lib/email/registry";
import { blocksFromPlainText, emailBlocksToText, parseStoredEmailBlocks, renderEmailBlocks, serializeEmailBlocks, validateEmailBlocks } from "@/lib/email/blocks";
import { recordAudit } from "@/lib/revenue-os/audit";

interface StoredVersion {
  id: string;
  template_key: string;
  state: "draft" | "published" | "archived";
  subject_template: string;
  preview_text: string | null;
  body_template: string;
  sample_data: Record<string, string> | null;
  updated_at: string;
  published_at: string | null;
}

const missingSchema = (code?: string) => code === "42P01" || code === "PGRST205";

function usedVariables(subject: string, body: string) {
  return [...new Set(`${subject} ${body}`.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((token) => token.slice(2, -2)) || [])];
}

function validateDraft(definition: NonNullable<ReturnType<typeof getEmailTemplateDefinition>>, subject: unknown, blocks: unknown) {
  if (typeof subject !== "string" || !subject.trim() || subject.length > 300) return "Subject is required and must be under 300 characters.";
  const validBlocks = validateEmailBlocks(blocks);
  if (!validBlocks?.length) return "Add at least one valid email section before saving.";
  const text = emailBlocksToText(validBlocks, definition.sampleData);
  if (text.length > 20_000) return "Email copy must be under 20,000 characters.";
  const invalid = usedVariables(subject, text).filter((variable) => !definition.variables.includes(variable));
  return invalid.length ? `Unsupported variables: ${invalid.map((value) => `{{${value}}}`).join(", ")}` : null;
}

async function versionsFor(key: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("email_template_versions")
    .select("id, template_key, state, subject_template, preview_text, body_template, sample_data, updated_at, published_at")
    .eq("template_key", key)
    .in("state", ["draft", "published"])
    .order("updated_at", { ascending: false });
  return { versions: (data || []) as StoredVersion[], error };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("email_template_versions")
      .select("template_key, state, updated_at")
      .in("state", ["draft", "published"])
      .order("updated_at", { ascending: false });
    const states = new Map<string, { hasDraft: boolean; published: boolean; updatedAt: string | null }>();
    for (const row of data || []) {
      const current = states.get(row.template_key) || { hasDraft: false, published: false, updatedAt: null };
      states.set(row.template_key, {
        hasDraft: current.hasDraft || row.state === "draft",
        published: current.published || row.state === "published",
        updatedAt: current.updatedAt || row.updated_at,
      });
    }
    return NextResponse.json({
      schemaReady: !error || !missingSchema(error.code),
      emails: EMAIL_TEMPLATE_DEFINITIONS.map((definition) => ({
        id: definition.key,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        subject: definition.subjectTemplate,
        delayDays: definition.delayDays,
        variables: definition.variables,
        hasDraft: states.get(definition.key)?.hasDraft || false,
        source: states.get(definition.key)?.published ? "published" : "built_in",
        updatedAt: states.get(definition.key)?.updatedAt || null,
      })),
    });
  }

  const definition = getEmailTemplateDefinition(id);
  if (!definition) return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  const { versions, error } = await versionsFor(id);
  const draft = versions.find((version) => version.state === "draft") || null;
  const published = versions.find((version) => version.state === "published") || null;
  const requestedMode = request.nextUrl.searchParams.get("mode");
  const selected = requestedMode === "live" ? published : draft || published;
  const variables = { ...definition.sampleData, ...(selected?.sample_data || {}) };
  const subjectTemplate = selected?.subject_template || definition.subjectTemplate;
  const bodyTemplate = selected?.body_template || definition.bodyTemplate;
  const blocks = parseStoredEmailBlocks(bodyTemplate) || blocksFromPlainText(bodyTemplate);
  const rendered = selected
    ? await renderEmailBlocks(blocks, variables, selected.preview_text || undefined).then(({ html, text }) => ({ subject: replaceEmailVariables(subjectTemplate, variables), text, html }))
    : renderDefinition(definition, variables);

  return NextResponse.json({
    schemaReady: !error || !missingSchema(error.code),
    id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    delayDays: definition.delayDays,
    variables: definition.variables,
    sampleData: variables,
    subjectTemplate,
    bodyTemplate,
    blocks,
    previewText: selected?.preview_text || "",
    subject: rendered.subject,
    html: rendered.html,
    source: selected?.state || "built_in",
    hasDraft: Boolean(draft),
    draftId: draft?.id || null,
    publishedId: published?.id || null,
    updatedAt: selected?.updated_at || null,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const definition = getEmailTemplateDefinition(body.id);
  if (!definition) return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  const blocks = validateEmailBlocks(body.blocks);
  const validation = validateDraft(definition, body.subjectTemplate, blocks);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { error: templateError } = await supabase.from("email_templates").upsert({
    template_key: definition.key,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    built_in: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "template_key" });
  if (templateError) return NextResponse.json({ error: missingSchema(templateError.code) ? "Apply the Email Studio migration in Setup Center first." : templateError.message }, { status: 409 });

  const payload = {
    template_key: definition.key,
    state: "draft",
    subject_template: body.subjectTemplate.trim(),
    preview_text: typeof body.previewText === "string" ? body.previewText.trim().slice(0, 300) : null,
    body_template: serializeEmailBlocks(blocks!),
    sample_data: definition.sampleData,
    created_by: auth.user.email,
    updated_at: new Date().toISOString(),
  };
  const { versions } = await versionsFor(definition.key);
  const existing = versions.find((version) => version.state === "draft");
  const result = existing
    ? await supabase.from("email_template_versions").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("email_template_versions").insert(payload).select().single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  await recordAudit(supabase, { actorEmail: auth.user.email, action: "email_template.draft_saved", entityType: "email_template", entityId: definition.key, after: { versionId: result.data.id } });
  return NextResponse.json({ success: true, version: result.data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const body = await request.json();
  const definition = getEmailTemplateDefinition(body.id);
  if (!definition) return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  const supabase = createServiceRoleClient();

  if (body.action === "render") {
    const blocks = validateEmailBlocks(body.blocks);
    const validation = validateDraft(definition, body.subjectTemplate, blocks);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    const variables = definition.sampleData;
    const { html, text } = await renderEmailBlocks(blocks!, variables, typeof body.previewText === "string" ? body.previewText : undefined);
    return NextResponse.json({ subject: replaceEmailVariables(body.subjectTemplate, variables), html, text });
  }

  const { versions, error } = await versionsFor(definition.key);
  if (error) return NextResponse.json({ error: missingSchema(error.code) ? "Apply the Email Studio migration in Setup Center first." : error.message }, { status: 409 });
  const draft = versions.find((version) => version.state === "draft");
  if (!draft) return NextResponse.json({ error: "Save a draft before continuing." }, { status: 409 });

  if (body.action === "test") {
    const variables = { ...definition.sampleData, ...(draft.sample_data || {}) };
    const subject = replaceEmailVariables(draft.subject_template, variables);
    const blocks = parseStoredEmailBlocks(draft.body_template) || blocksFromPlainText(draft.body_template);
    const { text, html } = await renderEmailBlocks(blocks, variables, draft.preview_text || undefined);
    const to = auth.user.email || ADMIN_EMAIL;
    const result = await getResend().emails.send({ from: FROM_EMAIL, to, subject: `[TEST] ${subject}`, text, html });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 502 });
    await recordAudit(supabase, { actorEmail: auth.user.email, action: "email_template.test_sent", entityType: "email_template", entityId: definition.key, metadata: { versionId: draft.id, providerId: result.data?.id, to } });
    return NextResponse.json({ success: true, to });
  }

  if (body.action !== "publish") return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  const { data: versionId, error: publishError } = await supabase.rpc("publish_email_template", { p_template_key: definition.key, p_actor: auth.user.email || null });
  if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 });
  await recordAudit(supabase, { actorEmail: auth.user.email, action: "email_template.published", entityType: "email_template", entityId: definition.key, after: { versionId } });
  return NextResponse.json({ success: true, versionId });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !getEmailTemplateDefinition(id)) return NextResponse.json({ error: "Email template not found" }, { status: 404 });
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("email_template_versions").delete().eq("template_key", id).eq("state", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await recordAudit(supabase, { actorEmail: auth.user.email, action: "email_template.draft_reset", entityType: "email_template", entityId: id });
  return NextResponse.json({ success: true });
}

#!/usr/bin/env tsx
/**
 * Form builder plugin checks: bounded schema validation, public token
 * refusal, submission idempotency, and reviewed accept/reject guards.
 */
import assert from "node:assert/strict";
import { MemorySupabase } from "./lib/memory-supabase";
import {
  acceptFormSubmission,
  executeFormDefinitionSave,
  executeFormPublish,
  formResponseValidator,
  formSchemaValidator,
  validateFormResponse,
  getPublishedFormByToken,
  listFormDefinitions,
  prepareFormDraft,
  proposeFormDraft,
  proposeFormPublish,
  recordFormSubmission,
  rejectFormSubmission,
} from "../src/lib/revenue-os/form-builder";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { formReviewInputSchema } from "../src/lib/revenue-os/form-builder-contract";

const TENANT = "123e4567-e89b-12d3-a456-426614174001";
const client = () => new MemorySupabase().client as never;

async function main() {
  const review = { action: "review", id: TENANT, decision: "accepted", requestId: TENANT };
  assert.deepEqual(formReviewInputSchema.parse(review), review);
  assert.throws(() => formReviewInputSchema.parse({ ...review, approved: true }));
  // 1. Schema validation: happy path plus the three structural refusals.
  const valid = {
    title: "Lead capture",
    elements: [
      { name: "email", title: "Work email", type: "text", inputType: "email", isRequired: true },
      { name: "topic", title: "Topic", type: "dropdown", choices: ["Support", "Sales"] },
    ],
  };
  assert.deepEqual(formSchemaValidator.parse(valid), valid);
  assert.throws(
    () =>
      formSchemaValidator.parse({
        elements: [
          { name: "email", type: "text" },
          { name: "email", type: "text" },
        ],
      }),
    /Duplicate field name/,
  );
  assert.throws(
    () => formSchemaValidator.parse({ elements: [{ name: "topic", type: "dropdown" }] }),
    /needs options/,
  );
  assert.throws(
    () =>
      formSchemaValidator.parse({
        elements: Array.from({ length: 41 }, (_, index) => ({ name: `f${index}`, type: "text" })),
      }),
    /40/,
  );

  // 2. Response validation bounds.
  await assert.rejects(
    recordFormSubmission(client(), {
      token: "a".repeat(64),
      schema: formSchemaValidator.parse(valid),
      response: {},
      requestId: "00000000-0000-0000-0000-000000000000",
    }),
    /Answer required/,
  );
  assert.throws(() => formResponseValidator.parse({ note: "x".repeat(2001) }), /2000/);

  // 3. Public lookup refuses malformed tokens and unpublished forms.
  assert.equal(await getPublishedFormByToken(client(), "not-a-token"), null);
  const unpublished = new MemorySupabase({
    form_definitions: [
      {
        id: "form-1",
        tenant_id: TENANT,
        name: "Draft",
        description: "",
        schema: { elements: [{ name: "email", type: "text" }] },
        status: "draft",
        share_token: "a".repeat(64),
      },
    ],
  });
  assert.equal(await getPublishedFormByToken(unpublished.client as never, "a".repeat(64)), null);

  // 4. The service validates the exact definition before using the atomic RPC.
  // Native PostgreSQL tests own concurrency and transactional rollback proof.
  const store = new MemorySupabase();
  store.rpc("record_form_submission", (args) => {
    assert.equal(args.p_token, "a".repeat(64));
    assert.deepEqual(args.p_schema, valid);
    assert.equal(args.p_contact_email, "sam@example.com");
    return { submissionId: TENANT, duplicate: false, contactEmail: args.p_contact_email };
  });
  const db = store.client as never;
  const first = await recordFormSubmission(db, {
    token: "a".repeat(64),
    schema: formSchemaValidator.parse(valid),
    response: { email: "Sam@Example.com", topic: "Sales" },
    requestId: "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.contactEmail, "sam@example.com");
  for (const response of [{}, { email: "invalid" }, { email: "a@example.com", topic: "Unknown" }, { email: "a@example.com", injected: true }]) {
    assert.throws(() => validateFormResponse(formSchemaValidator.parse(valid), response));
  }
  const typed = formSchemaValidator.parse({ elements: [
    { name: "consent", type: "boolean", isRequired: true },
    { name: "rating", type: "rating", rateMax: 3 },
    { name: "choices", type: "checkbox", choices: ["a", "b"] },
    { name: "date", type: "text", inputType: "date" },
    { name: "number", type: "text", inputType: "number" },
  ] });
  assert.doesNotThrow(() => validateFormResponse(typed, { consent: false, rating: 3, choices: ["a"], date: "2026-09-19", number: 0 }));
  for (const extra of [{ rating: 4 }, { choices: ["a", "a"] }, { date: "2026-02-30" }, { number: "1" }]) {
    assert.throws(() => validateFormResponse(typed, { consent: true, ...extra }));
  }
  assert.throws(() => formSchemaValidator.parse({ elements: [
    { name: "panel", type: "panel", elements: Array.from({ length: 40 }, (_, i) => ({ name: `f${i}`, type: "text" })) },
  ] }), /at most 40/);

  // 5. Definitions list parses stored schemas.
  const withForm = new MemorySupabase({
    form_definitions: [
      {
        id: "form-1",
        tenant_id: TENANT,
        name: "Lead capture",
        description: "",
        schema: { elements: [{ name: "email", type: "text" }] },
        status: "published",
        share_token: "b".repeat(64),
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  });
  const forms = await listFormDefinitions(withForm.client as never, TENANT);
  assert.equal(forms.length, 1);
  assert.equal(forms[0]!.status, "published");

  // 6. Accept refuses email-less responses before touching intake.
  const noEmail = new MemorySupabase({
    form_submissions: [
      {
        id: "sub-1",
        tenant_id: TENANT,
        form_id: "form-1",
        response: { note: "no contact here" },
        contact_name: null,
        contact_email: null,
        status: "pending_review",
      },
    ],
    form_definitions: [
      {
        id: "form-1",
        tenant_id: TENANT,
        name: "Lead capture",
        description: "",
        schema: { elements: [{ name: "note", type: "text" }] },
        status: "published",
        share_token: "c".repeat(64),
        updated_at: new Date().toISOString(),
      },
    ],
  });
  await assert.rejects(
    acceptFormSubmission(noEmail.client as never, {
      tenantId: TENANT,
      id: "sub-1",
      actorEmail: "owner@example.com",
      requestId: "22222222-2222-2222-2222-222222222222",
    }),
    /no email/,
  );

  // 7. Reject marks the row and audits the decision.
  noEmail.rpc("review_form_submission", args => {
    assert.equal(args.p_id, "sub-1");
    assert.equal(args.p_decision, "rejected");
    return { submissionId: TENANT, decision: "rejected", duplicate: false, actionId: null };
  });
  const rejection = await rejectFormSubmission(bindTenantDatabaseForTest(noEmail.client as never, TENANT), {
    tenantId: TENANT,
    id: "sub-1",
    actorEmail: "owner@example.com",
    requestId: TENANT,
  });
  assert.equal(rejection.decision, "rejected");
  assert.equal(noEmail.rpcCalls.length, 1);

  // 8. Central AI authoring: prepare, propose, approved execution.
  const aiStore = new MemorySupabase({
    tenants: [{ id: TENANT, status: "active", config: { modules: { "form-builder": true } } }],
  });
  aiStore.idFactory = () => crypto.randomUUID();
  aiStore.rpc("write_form_definition", (args) => {
    const patch = args.p_patch as Record<string, unknown>;
    const rows = aiStore.tables.form_definitions ??= [];
    const current = rows.find(row => row.id === args.p_id);
    if (args.p_operation === "create") {
      const created = { ...patch, id: args.p_id, tenant_id: TENANT, status: "draft", published_at: null, updated_at: new Date().toISOString() };
      rows.push(created);
      return created;
    }
    if (!current || current.updated_at !== args.p_expected_updated_at) throw new Error("Form changed");
    Object.assign(current, patch, { updated_at: new Date(Date.parse(current.updated_at as string) + 1).toISOString() });
    return current;
  });
  const aiDb = bindTenantDatabaseForTest(aiStore.client as never, TENANT);
  const draftInput = {
    name: "AI intake",
    description: "Built by the assistant",
    schema: {
      elements: [{ name: "email", title: "Work email", type: "text", inputType: "email" }],
    },
  };
  const prepared = await prepareFormDraft(aiDb, draftInput);
  assert.match(prepared.digest, /^[a-f0-9]{64}$/);
  assert.equal(prepared.requiresHumanApproval, true);
  await assert.rejects(
    proposeFormDraft(aiDb, { ...draftInput, digest: "0".repeat(64) }, "owner@example.com"),
    /Prepare the draft again/,
  );
  const proposal = (await proposeFormDraft(
    aiDb,
    { ...draftInput, digest: prepared.digest },
    "owner@example.com",
  )) as { action_type: string; payload: Record<string, unknown> };
  assert.equal(proposal.action_type, "save_form_definition");
  const created = await executeFormDefinitionSave(aiDb, proposal.payload, "owner@example.com");
  assert.equal(created.status, "draft");
  assert.equal(created.schema.elements.length, 1);

  const publishPreview = await proposeFormPublish(
    aiDb,
    { formId: created.id, digest: "0".repeat(64) },
    "owner@example.com",
  ).then(
    () => Promise.reject(new Error("stale digest was accepted")),
    (error: unknown) => error,
  );
  assert.match((publishPreview as Error).message, /Prepare the draft again|changed since review/);
  // Derive the live digest the same way the UI review would.
  const live = await prepareFormDraft(aiDb, {
    formId: created.id,
    name: created.name,
    description: created.description,
    schema: created.schema,
  });
  const publishProposal = (await proposeFormPublish(
    aiDb,
    { formId: created.id, digest: live.digest },
    "owner@example.com",
  )) as { action_type: string; payload: Record<string, unknown> };
  assert.equal(publishProposal.action_type, "publish_form");
  const published = await executeFormPublish(aiDb, publishProposal.payload, "owner@example.com");
  assert.equal(published.status, "published");

  // 9. Execution refuses a disabled module.
  const offStore = new MemorySupabase({
    tenants: [{ id: TENANT, status: "active", config: { modules: { "form-builder": false } } }],
    form_definitions: [
      {
        id: created.id,
        tenant_id: TENANT,
        name: created.name,
        description: "",
        schema: created.schema,
        status: "draft",
        share_token: "d".repeat(64),
        updated_at: new Date().toISOString(),
      },
    ],
  });
  const offDb = bindTenantDatabaseForTest(offStore.client as never, TENANT);
  await assert.rejects(
    executeFormPublish(offDb, publishProposal.payload, "owner@example.com"),
    /disabled/,
  );

  console.log("form-builder checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

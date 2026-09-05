import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { readWorkspaceBrand, saveWorkspaceBrandAsAdmin, validateWorkspaceBrand } from "./branding";
import { workspaceBrandSchema } from "./branding-contract";
import {
  brandPreviewInputSchema,
  brandProposalInputSchema,
  brandDigestSchema,
} from "./branding-actions-contract";
import { proposeAction } from "./actions";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const payloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    before: workspaceBrandSchema,
    after: workspaceBrandSchema,
    revision: brandDigestSchema,
    digest: brandDigestSchema,
  })
  .strict();
export async function previewWorkspaceBrandUpdate(db: SupabaseClient, raw: unknown) {
  const { changes } = brandPreviewInputSchema.parse(raw);
  const current = await readWorkspaceBrand(db);
  const after = validateWorkspaceBrand({ ...current.brand, ...changes });
  const changedFields = Object.keys(changes).filter(
    (key) => current.brand[key as keyof typeof after] !== after[key as keyof typeof after],
  );
  if (!changedFields.length) throw new Error("No branding values would change");
  const facts = {
    version: 1 as const,
    tenantId: tenantIdForDatabase(db)!,
    before: current.brand,
    after,
    revision: current.revision,
  };
  return {
    ...facts,
    digest: hash(facts),
    changes: changedFields.map((field) => ({
      field,
      before: current.brand[field as keyof typeof after],
      after: after[field as keyof typeof after],
    })),
    requiresHumanApproval: true,
  };
}
export async function proposeWorkspaceBrandUpdate(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = brandProposalInputSchema.parse(raw);
  const preview = await previewWorkspaceBrandUpdate(db, { changes: input.changes });
  if (preview.digest !== input.digest)
    throw new Error("Branding preview changed. Preview again before proposing.");
  const payload = payloadSchema.parse(previewPayload(preview));
  return proposeAction(db, {
    actionType: "update_workspace_brand",
    title: "Update workspace branding",
    description: preview.changes
      .map((c) => `${c.field}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`)
      .join("\n"),
    payload,
    sourceContext: "admin_ai",
    entityType: "tenant",
    entityId: preview.tenantId,
    dedupeKey: `workspace-brand:${preview.tenantId}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}
function previewPayload(preview: Awaited<ReturnType<typeof previewWorkspaceBrandUpdate>>) {
  const { version, tenantId, before, after, revision, digest } = preview;
  return { version, tenantId, before, after, revision, digest };
}
export async function executeWorkspaceBrandUpdate(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = payloadSchema.parse(raw);
  const { digest, ...facts } = input;
  if (input.tenantId !== tenantIdForDatabase(db) || hash(facts) !== digest)
    throw new Error("Branding approval does not match its workspace or exact preview");
  return saveWorkspaceBrandAsAdmin(db, input.after, input.revision, actorEmail);
}

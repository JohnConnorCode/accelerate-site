import { z } from "zod";
import { workspaceBrandSchema } from "./branding-contract";
export const brandDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const brandPatchSchema = workspaceBrandSchema
  .omit({ version: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one branding change is required");
export const brandPreviewInputSchema = z.object({ changes: brandPatchSchema }).strict();
export const brandProposalInputSchema = z
  .object({ changes: brandPatchSchema, digest: brandDigestSchema })
  .strict();
export const BRANDING_TOOL_NAMES = [
  "get_workspace_brand",
  "preview_workspace_brand_update",
  "propose_workspace_brand_update",
] as const;

export const BRANDING_TOOLS = [
  {
    name: "get_workspace_brand",
    description:
      "Read current workspace logo, colors, public identity and brand revision. These are non-secret presentation settings.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.branding",
  },
  {
    name: "preview_workspace_brand_update",
    description:
      "Preview exact branding changes without saving. Supply only changed logo, color or business identity fields. Returns before/after and a digest required to propose; do not claim changes are applied.",
    impact: "read",
    confirmationRequired: false,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.branding",
  },
  {
    name: "propose_workspace_brand_update",
    description:
      "Queue exactly previewed branding changes for human approval. Use the same changes and digest from preview_workspace_brand_update. This does not save branding or approve the request.",
    impact: "internal_write",
    confirmationRequired: true,
    connectionRequirement: "none",
    serviceTarget: "revenue-os.branding",
  },
] as const;

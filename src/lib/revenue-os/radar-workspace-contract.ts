/** Shared live/demo workspace data. No provider or database dependencies. */
import { z } from "zod";
import {
  radarOutreachPrepareSchema,
  radarOutreachPreviewSchema,
  radarOutreachProposalSchema,
  radarOutreachReadSchema,
} from "./radar-outreach-contract";
import {
  radarStorePreviewSchema,
  radarStoreProposalSchema,
  radarStoreReadSchema,
  type RadarStoreChange,
} from "./radar-store-contract";
import {
  radarAssessmentPreviewSchema,
  radarAssessmentProposalSchema,
  type RadarAssessment,
  type selectRadarCandidates,
} from "./radar-ranking-contract";
export const radarOpportunityBriefSchema = z
  .object({
    operationId: z.uuid(),
    opportunityId: z.uuid(),
    expectedRevision: z.number().int().positive(),
    sourceVersionIds: z.array(z.uuid()).min(1).max(5),
  })
  .strict();
export const radarWorkspaceReadSchema = z.object({ opportunityId: z.uuid().optional() }).strict();
export const radarWorkspaceCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("outreach_options"),
      input: z.object({ opportunityId: z.uuid(), otherContactId: z.uuid().optional() }).strict(),
    })
    .strict(),
  z.object({ kind: z.literal("outreach_preview"), input: radarOutreachPreviewSchema }).strict(),
  z.object({ kind: z.literal("outreach_propose"), input: radarOutreachProposalSchema }).strict(),
  z.object({ kind: z.literal("outreach_history"), input: radarOutreachReadSchema }).strict(),
  z
    .object({
      kind: z.literal("outreach_reconcile"),
      input: z.object({ actionId: z.uuid() }).strict(),
    })
    .strict(),
  z.object({ kind: z.literal("prepare_outreach"), input: radarOutreachPrepareSchema }).strict(),
  z.object({ kind: z.literal("prepare_brief"), input: radarOpportunityBriefSchema }).strict(),
  z.object({ kind: z.literal("store_preview"), input: radarStorePreviewSchema }).strict(),
  z.object({ kind: z.literal("store_propose"), input: radarStoreProposalSchema }).strict(),
  z.object({ kind: z.literal("assessment_preview"), input: radarAssessmentPreviewSchema }).strict(),
  z
    .object({ kind: z.literal("assessment_propose"), input: radarAssessmentProposalSchema })
    .strict(),
  z.object({ kind: z.literal("read_record"), input: radarStoreReadSchema }).strict(),
]);
export type RadarOpportunityView = {
  id: string;
  title: string;
  summary: string;
  recommended_action: string;
  kind: string;
  state: string;
  revision: number;
  evidence_revision: number;
  contact_id: string | null;
  company_id: string | null;
};
export type RadarSourceView = {
  id: string;
  source_id: string;
  title: string;
  version: number;
  revision: number;
  verification: "supplied" | "verified" | "retracted";
  canonicalUrl: string | null;
  published_at: string | null;
};
export type RadarPacketView = {
  opportunity: RadarOpportunityView;
  citations: Array<{ source_version_id: string; observation: string; evidence_id: string | null }>;
  sources: RadarSourceView[];
  assets: Array<{ id: string; kind: string; title: string; state: string }>;
  outcomes: Array<{ id: string; kind: string; description: string; verification: string }>;
  history: Array<{ id: string; operation: string; actor_email: string; created_at: string }>;
  contact: { id: string; name: string; communicationStatus: string } | null;
  assessment: RadarAssessment | null;
  assessmentCurrent: boolean;
  assessmentReason: string | null;
  truncated: boolean;
};
export type RadarWorkspaceData = {
  enabled: boolean;
  organization: string;
  model: { mode: string; available: boolean; reason: string };
  selection: ReturnType<typeof selectRadarCandidates> | null;
  candidateTitles: Array<{ id: string; title: string }>;
  opportunities: RadarOpportunityView[];
  sources: RadarSourceView[];
  packet: RadarPacketView | null;
  warnings: string[];
  truncated: boolean;
};
export type RadarStorePreviewView = {
  operationId: string;
  change: RadarStoreChange;
  digest: string;
  before: Record<string, unknown> | null;
  sources: Array<{ id: string; revision: number; verification: string }>;
};

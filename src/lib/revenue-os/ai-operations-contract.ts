export const AI_RUN_STATUSES = ["running", "completed", "partial", "failed", "cancelled"] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];
export type AiRunDisplayStatus = AiRunStatus | "unknown";

export const AI_RUN_WINDOWS = ["24h", "7d", "30d", "all"] as const;
export type AiRunWindow = (typeof AI_RUN_WINDOWS)[number];

export interface AiRunSummary {
  id: string;
  surface: string;
  provider: string | null;
  model: string | null;
  toolPack: string | null;
  conversationId: string | null;
  status: AiRunDisplayStatus;
  toolNames: string[];
  inputTokens: number;
  outputTokens: number;
  durationMs: number | null;
  promptPreview: string | null;
  resultPreview: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  feedback: "helpful" | "not_helpful" | "invalid" | null;
}

export interface AiRunMetrics {
  runs: number;
  completed: number;
  partial: number;
  failed: number;
  cancelled: number;
  successRate: number | null;
  totalTokens: number;
  medianDurationMs: number | null;
  feedbackCoverage: number | null;
}

export interface AiRunHistoryPayload {
  schemaReady: boolean;
  degraded: boolean;
  degradationReasons: string[];
  runs: AiRunSummary[];
  metrics: AiRunMetrics;
  facets: { surfaces: string[]; models: string[]; packs: string[]; tools: string[] };
  nextCursor: string | null;
  summaryTruncated: boolean;
  generatedAt: string;
}

export interface AiRunEventSummary {
  id: string;
  type: string;
  label: string;
  summary: string;
  toolName: string | null;
  status: "completed" | "failed" | "recorded" | "unknown";
  createdAt: string;
}

export interface AiAffectedRecord {
  type: "opportunity" | "contact" | "company" | "campaign";
  id: string;
  href: string;
}

export interface AiRunDetailPayload {
  schemaReady: boolean;
  degraded: boolean;
  degradationReasons: string[];
  run: AiRunSummary | null;
  events: AiRunEventSummary[];
  eventsTruncated: boolean;
  affectedRecords: AiAffectedRecord[];
}

export interface AiCapability {
  name: string;
  label: string;
  description: string;
  impact: "read" | "internal_write" | "external_action" | "destructive";
  confirmationRequired: boolean;
  packs: string[];
  serviceTarget: string;
  connectionRequirement: "none";
  state: "available" | "unavailable";
  operationalReadiness: "ready" | "unavailable";
  availabilityReason: string;
}

export interface AiCapabilitiesPayload {
  registryVersion: string;
  scope: "runtime_registry";
  readinessEvaluated: true;
  capabilities: AiCapability[];
  safety: {
    registeredReads: number;
    registeredInternalWrites: number;
    registeredExternalActions: number;
    registeredDestructiveActions: number;
    readsMayExecuteDirectly: boolean;
    writesRequireApproval: boolean;
    externalActionsRequireApproval: boolean;
    destructiveActionsAvailable: boolean;
  };
}

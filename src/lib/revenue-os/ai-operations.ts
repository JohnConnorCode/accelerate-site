import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRevenueSchema } from "./db";
import {
  AI_RUN_STATUSES,
  AI_RUN_WINDOWS,
  type AiAffectedRecord,
  type AiRunDetailPayload,
  type AiRunEventSummary,
  type AiRunHistoryPayload,
  type AiRunStatus,
  type AiRunSummary,
  type AiRunWindow,
} from "./ai-operations-contract";

const HISTORY_LIMIT = 500;
const PAGE_LIMIT_MAX = 50;
const EVENT_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AiOperationsValidationError extends Error {
  readonly status = 400;
}

type AiRunCursor = { startedAt: string; id: string };

export function encodeAiRunCursor(cursor: AiRunCursor): string {
  return Buffer.from(
    JSON.stringify({ v: 1, startedAt: cursor.startedAt, id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeAiRunCursor(value: string): AiRunCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      v?: unknown;
      startedAt?: unknown;
      id?: unknown;
    };
    if (
      parsed.v !== 1 ||
      typeof parsed.startedAt !== "string" ||
      Number.isNaN(Date.parse(parsed.startedAt)) ||
      typeof parsed.id !== "string" ||
      !UUID_PATTERN.test(parsed.id)
    ) {
      throw new Error("invalid");
    }
    return { startedAt: new Date(parsed.startedAt).toISOString(), id: parsed.id.toLowerCase() };
  } catch {
    throw new AiOperationsValidationError("Invalid AI run cursor");
  }
}

export function redactAiOperationsSummary(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gi, "[redacted private key]")
    .replace(
      /\b(authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*(?:Bearer\s+)?(?:["'][^"']*["']|[^\s,;]+)/gi,
      "$1=[redacted]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|pk|rk|api)[-_][A-Za-z0-9_-]{12,}\b/g, "[redacted key]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .slice(0, max);
}

type RawRun = {
  id: string;
  surface: string;
  provider: string | null;
  model: string | null;
  tool_pack: string | null;
  conversation_id: string | null;
  status: string;
  prompt_preview: string | null;
  tool_names: string[] | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  result_preview: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type RawEvent = {
  id: string;
  run_id: string;
  event_type: string;
  tool_name: string | null;
  output: unknown;
  created_at: string;
};

export interface AiRunHistoryFilters {
  window: AiRunWindow;
  status: AiRunStatus | "all";
  surface: string;
  pack: string;
  model: string;
  tool: string;
  feedback: "all" | "helpful" | "not_helpful" | "unrated";
  query: string;
  cursor: AiRunCursor | null;
  limit: number;
}

export function parseAiRunHistoryFilters(params: URLSearchParams): AiRunHistoryFilters {
  const window = params.get("window") || "7d";
  const status = params.get("status") || "all";
  const feedback = params.get("feedback") || "all";
  const requestedLimit = Number(params.get("limit") || 25);
  if (!AI_RUN_WINDOWS.includes(window as AiRunWindow))
    throw new AiOperationsValidationError("Invalid AI run window");
  if (status !== "all" && !AI_RUN_STATUSES.includes(status as AiRunStatus))
    throw new AiOperationsValidationError("Invalid AI run status");
  if (!["all", "helpful", "not_helpful", "unrated"].includes(feedback))
    throw new AiOperationsValidationError("Invalid AI feedback filter");
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > PAGE_LIMIT_MAX)
    throw new AiOperationsValidationError(`AI run limit must be between 1 and ${PAGE_LIMIT_MAX}`);
  const bounded = (key: string, max = 120) => (params.get(key) || "").trim().slice(0, max);
  return {
    window: window as AiRunWindow,
    status: status as AiRunStatus | "all",
    surface: bounded("surface"),
    pack: bounded("pack"),
    model: bounded("model"),
    tool: bounded("tool"),
    feedback: feedback as AiRunHistoryFilters["feedback"],
    query: bounded("q", 160).toLowerCase(),
    cursor: decodeAiRunCursor(bounded("cursor", 240)),
    limit: requestedLimit,
  };
}

function sinceFor(window: AiRunWindow): string | null {
  const hours = window === "24h" ? 24 : window === "7d" ? 168 : window === "30d" ? 720 : null;
  return hours ? new Date(Date.now() - hours * 3_600_000).toISOString() : null;
}

function feedbackFrom(output: unknown): AiRunSummary["feedback"] {
  if (!output || typeof output !== "object") return null;
  const rating = (output as { rating?: unknown }).rating;
  if (rating === "helpful" || rating === "not_helpful") return rating;
  return rating === undefined || rating === null ? null : "invalid";
}

function toSummary(run: RawRun, feedback: AiRunSummary["feedback"]): AiRunSummary {
  const status = AI_RUN_STATUSES.includes(run.status as AiRunStatus)
    ? (run.status as AiRunStatus)
    : "unknown";
  return {
    id: run.id,
    surface: run.surface,
    provider: run.provider,
    model: run.model,
    toolPack: run.tool_pack,
    conversationId: run.conversation_id,
    status,
    toolNames: Array.isArray(run.tool_names) ? run.tool_names : [],
    inputTokens: Number(run.input_tokens || 0),
    outputTokens: Number(run.output_tokens || 0),
    durationMs: run.duration_ms === null ? null : Number(run.duration_ms),
    promptPreview: redactAiOperationsSummary(run.prompt_preview),
    resultPreview: redactAiOperationsSummary(run.result_preview, 1_000),
    error: redactAiOperationsSummary(run.error, 1_000),
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    feedback,
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function loadAiRunHistory(
  supabase: SupabaseClient,
  filters: AiRunHistoryFilters,
): Promise<AiRunHistoryPayload> {
  let query = supabase
    .from("agent_runs")
    .select(
      "id,surface,provider,model,tool_pack,conversation_id,status,prompt_preview,tool_names,input_tokens,output_tokens,duration_ms,result_preview,error,started_at,finished_at",
    )
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT + 1);
  const since = sinceFor(filters.window);
  if (since) query = query.gte("started_at", since);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.surface) query = query.eq("surface", filters.surface);
  if (filters.pack) query = query.eq("tool_pack", filters.pack);
  if (filters.model) query = query.eq("model", filters.model);
  if (filters.tool) query = query.contains("tool_names", [filters.tool]);
  if (filters.cursor) {
    query = query.or(
      `started_at.lt.${filters.cursor.startedAt},and(started_at.eq.${filters.cursor.startedAt},id.lt.${filters.cursor.id})`,
    );
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingRevenueSchema(error))
      return {
        schemaReady: false,
        degraded: true,
        degradationReasons: ["AI run storage is not ready"],
        runs: [],
        metrics: {
          runs: 0,
          completed: 0,
          partial: 0,
          failed: 0,
          cancelled: 0,
          successRate: null,
          totalTokens: 0,
          medianDurationMs: null,
          feedbackCoverage: null,
        },
        facets: { surfaces: [], models: [], packs: [], tools: [] },
        nextCursor: null,
        summaryTruncated: false,
        generatedAt: new Date().toISOString(),
      };
    throw new Error(error.message);
  }
  const rawRuns = (data ?? []) as RawRun[];
  const summaryTruncated = rawRuns.length > HISTORY_LIMIT;
  const boundedRuns = rawRuns.slice(0, HISTORY_LIMIT);
  const ids = boundedRuns.map((run) => run.id);
  const feedbackRows: Array<{ run_id: string; output: unknown; created_at: string }> = [];
  let feedbackEvidenceReady = true;
  for (let index = 0; index < ids.length; index += 100) {
    const response = await supabase
      .from("agent_run_events")
      .select("run_id,output,created_at")
      .eq("event_type", "human_feedback")
      .in("run_id", ids.slice(index, index + 100))
      .order("created_at", { ascending: true });
    if (response.error) {
      if (isMissingRevenueSchema(response.error)) {
        feedbackEvidenceReady = false;
        break;
      }
      throw new Error(response.error.message);
    }
    feedbackRows.push(...((response.data ?? []) as typeof feedbackRows));
  }
  const feedbackByRun = new Map(
    feedbackRows.map((event) => [event.run_id, feedbackFrom(event.output)]),
  );
  const allRuns = boundedRuns.map((run) => toSummary(run, feedbackByRun.get(run.id) ?? null));
  const facets = {
    surfaces: unique(allRuns.map((run) => run.surface)),
    models: unique(allRuns.map((run) => run.model)),
    packs: unique(allRuns.map((run) => run.toolPack)),
    tools: unique(allRuns.flatMap((run) => run.toolNames)),
  };
  const filtered = allRuns.filter((run) => {
    if (!feedbackEvidenceReady && filters.feedback !== "all") return false;
    if (filters.feedback === "unrated" && run.feedback) return false;
    if (
      filters.feedback !== "all" &&
      filters.feedback !== "unrated" &&
      run.feedback !== filters.feedback
    )
      return false;
    if (filters.query) {
      const haystack = [
        run.surface,
        run.model,
        run.toolPack,
        run.promptPreview,
        run.resultPreview,
        run.error,
        ...run.toolNames,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(filters.query)) return false;
    }
    return true;
  });
  const terminal = filtered.filter(
    (run) => AI_RUN_STATUSES.includes(run.status as AiRunStatus) && run.status !== "running",
  );
  const rated = filtered.filter(
    (run) => run.feedback === "helpful" || run.feedback === "not_helpful",
  );
  const completed = filtered.filter((run) => run.status === "completed").length;
  const page = filtered.slice(0, filters.limit);
  const nextAnchor =
    filtered.length > filters.limit ? page.at(-1) : summaryTruncated ? boundedRuns.at(-1) : null;
  const nextCursor = nextAnchor
    ? encodeAiRunCursor({
        startedAt: "started_at" in nextAnchor ? nextAnchor.started_at : nextAnchor.startedAt,
        id: nextAnchor.id,
      })
    : null;
  return {
    schemaReady: true,
    degraded: !feedbackEvidenceReady,
    degradationReasons: feedbackEvidenceReady ? [] : ["AI feedback evidence is unavailable"],
    runs: page,
    metrics: {
      runs: filtered.length,
      completed,
      partial: filtered.filter((run) => run.status === "partial").length,
      failed: filtered.filter((run) => run.status === "failed").length,
      cancelled: filtered.filter((run) => run.status === "cancelled").length,
      successRate: terminal.length ? Math.round((completed / terminal.length) * 100) : null,
      totalTokens: filtered.reduce((sum, run) => sum + run.inputTokens + run.outputTokens, 0),
      medianDurationMs: median(
        filtered.flatMap((run) => (run.durationMs === null ? [] : [run.durationMs])),
      ),
      feedbackCoverage:
        feedbackEvidenceReady && terminal.length
          ? Math.round((rated.length / terminal.length) * 100)
          : null,
    },
    facets,
    nextCursor,
    summaryTruncated,
    generatedAt: new Date().toISOString(),
  };
}

function bounded(value: unknown, max = 220): string {
  if (typeof value === "string") return redactAiOperationsSummary(value, max) ?? "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function eventSummary(event: RawEvent): AiRunEventSummary {
  const output =
    event.output && typeof event.output === "object"
      ? (event.output as Record<string, unknown>)
      : {};
  if (event.event_type === "human_feedback") {
    const rating = feedbackFrom(output);
    const summary =
      rating === "helpful"
        ? "Marked helpful"
        : rating === "not_helpful"
          ? "Marked not helpful"
          : "Invalid feedback evidence";
    return {
      id: event.id,
      type: event.event_type,
      label: "Founder feedback",
      summary,
      toolName: null,
      status: rating === "invalid" || rating === null ? "unknown" : "recorded",
      createdAt: event.created_at,
    };
  }
  if (event.event_type === "tool_error") {
    return {
      id: event.id,
      type: event.event_type,
      label: event.tool_name ? event.tool_name.replace(/_/g, " ") : "Tool",
      summary: bounded(output.error) || "The tool did not complete.",
      toolName: event.tool_name,
      status: "failed",
      createdAt: event.created_at,
    };
  }
  if (event.event_type === "tool_result") {
    const result =
      output.result && typeof output.result === "object"
        ? (output.result as Record<string, unknown>)
        : {};
    const count = Object.entries(result).find(([, value]) => typeof value === "number");
    const summary =
      bounded(result.title) ||
      bounded(result.action_type) ||
      (count ? `${count[0].replace(/_/g, " ")}: ${count[1]}` : "Completed with bounded evidence");
    return {
      id: event.id,
      type: event.event_type,
      label: event.tool_name ? event.tool_name.replace(/_/g, " ") : "Tool",
      summary,
      toolName: event.tool_name,
      status: "completed",
      createdAt: event.created_at,
    };
  }
  const model = bounded(output.model);
  return {
    id: event.id,
    type: event.event_type,
    label:
      event.event_type === "model_response"
        ? "Model response"
        : event.event_type.replace(/_/g, " "),
    summary: model ? `Response recorded by ${model}` : "Bounded event recorded",
    toolName: event.tool_name,
    status: "recorded",
    createdAt: event.created_at,
  };
}

function collectAffectedRecords(events: RawEvent[]): AiAffectedRecord[] {
  const result = new Map<string, AiAffectedRecord>();
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 4) return;
    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((item) => visit(item, depth + 1));
      return;
    }
    const row = value as Record<string, unknown>;
    const directType = bounded(row.entity_type) as AiAffectedRecord["type"];
    const directId = bounded(row.entity_id);
    const candidates: Array<[AiAffectedRecord["type"], string]> = [
      ...(directId && ["opportunity", "contact", "company", "campaign"].includes(directType)
        ? [[directType, directId] as [AiAffectedRecord["type"], string]]
        : []),
      ["opportunity", bounded(row.opportunityId || row.opportunity_id)],
      ["contact", bounded(row.contactId || row.contact_id)],
      ["company", bounded(row.companyId || row.company_id)],
      ["campaign", bounded(row.campaignId || row.campaign_id)],
    ];
    for (const [type, id] of candidates) {
      if (!UUID_PATTERN.test(id)) continue;
      const href =
        type === "opportunity"
          ? `/admin/pipeline/${id}`
          : type === "contact"
            ? `/admin/contacts/${id}`
            : type === "company"
              ? "/admin/contacts"
              : "/admin/campaigns";
      result.set(`${type}:${id}`, { type, id, href });
    }
    Object.values(row)
      .slice(0, 30)
      .forEach((item) => visit(item, depth + 1));
  };
  events.forEach((event) => visit(event.output));
  return [...result.values()];
}

export async function loadAiRunDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<AiRunDetailPayload> {
  if (!UUID_PATTERN.test(id)) throw new AiOperationsValidationError("Invalid AI run ID");
  const { data: run, error } = await supabase
    .from("agent_runs")
    .select(
      "id,surface,provider,model,tool_pack,conversation_id,status,prompt_preview,tool_names,input_tokens,output_tokens,duration_ms,result_preview,error,started_at,finished_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingRevenueSchema(error))
      return {
        schemaReady: false,
        degraded: true,
        degradationReasons: ["AI run storage is not ready"],
        run: null,
        events: [],
        eventsTruncated: false,
        affectedRecords: [],
      };
    throw new Error(error.message);
  }
  if (!run)
    return {
      schemaReady: true,
      degraded: false,
      degradationReasons: [],
      run: null,
      events: [],
      eventsTruncated: false,
      affectedRecords: [],
    };
  const { data: eventRows, error: eventsError } = await supabase
    .from("agent_run_events")
    .select("id,run_id,event_type,tool_name,output,created_at")
    .eq("run_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(EVENT_LIMIT + 1);
  if (eventsError) {
    if (isMissingRevenueSchema(eventsError))
      return {
        schemaReady: true,
        degraded: true,
        degradationReasons: ["AI run events are unavailable"],
        run: toSummary(run as RawRun, null),
        events: [],
        eventsTruncated: false,
        affectedRecords: [],
      };
    throw new Error(eventsError.message);
  }
  const rawEvents = (eventRows ?? []) as RawEvent[];
  const eventsTruncated = rawEvents.length > EVENT_LIMIT;
  const events = rawEvents.slice(0, EVENT_LIMIT);
  let feedback =
    rawEvents
      .map((event) => (event.event_type === "human_feedback" ? feedbackFrom(event.output) : null))
      .find((rating) => rating !== null) ?? null;
  if (eventsTruncated && feedback === null) {
    const response = await supabase
      .from("agent_run_events")
      .select("output")
      .eq("run_id", id)
      .eq("event_type", "human_feedback")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (response.error && !isMissingRevenueSchema(response.error))
      throw new Error(response.error.message);
    feedback = feedbackFrom(response.data?.output);
  }
  return {
    schemaReady: true,
    degraded: false,
    degradationReasons: [],
    run: toSummary(run as RawRun, feedback),
    events: events.map(eventSummary),
    eventsTruncated,
    affectedRecords: collectAffectedRecords(events),
  };
}

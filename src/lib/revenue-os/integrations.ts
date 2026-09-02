import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOpenRouterCredential } from "@/lib/ai/openrouter-credentials";
import { handleMcpRequest, MCP_REVENUE_OS_PROMPTS } from "./mcp-server";
import {
  INTEGRATION_REGISTRY_VERSION,
  integrationRegistry,
  type IntegrationCapabilityDefinition,
  type IntegrationDefinition,
  type IntegrationStatus,
} from "./integration-registry";

type EvidenceStatus = "success" | "failed" | "partial" | "running" | string;

interface ConnectionRow {
  provider: string;
  account_email: string | null;
  status: string;
  scopes: string[] | null;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

interface RunRow {
  key: string;
  status: EvidenceStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface WebhookRow {
  provider: string;
  status: EvidenceStatus;
  receivedAt: string | null;
  error: string | null;
}

export interface IntegrationEvidence {
  schemaAvailable: boolean;
  configured: Record<string, boolean>;
  runtime: Record<
    string,
    { status: "success" | "failed" | "unknown"; checkedAt: string; detail?: string }
  >;
  connections: ConnectionRow[];
  sourceRuns: RunRow[];
  jobRuns: RunRow[];
  webhooks: WebhookRow[];
}

export interface IntegrationCapabilityView extends IntegrationCapabilityDefinition {
  status: IntegrationStatus;
  statusReason: string;
  lastEvidenceAt: string | null;
}

export interface IntegrationView extends Omit<IntegrationDefinition, "capabilities"> {
  status: IntegrationStatus;
  statusReason: string;
  accountLabel: string | null;
  lastEvidenceAt: string | null;
  capabilities: IntegrationCapabilityView[];
}

export interface IntegrationCatalog {
  registryVersion: string;
  generatedAt: string;
  evidenceAvailable: boolean;
  summary: Record<IntegrationStatus, number> & { total: number; live: number; attention: number };
  providers: IntegrationView[];
}

const statusRank: Record<IntegrationStatus, number> = {
  degraded: 0,
  action: 1,
  ready: 2,
  available: 3,
  planned: 4,
};

function latestBy<T>(rows: T[], getKey: (row: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = getKey(row);
    if (!result.has(key)) result.set(key, row);
  }
  return result;
}

function sanitizeDiagnostic(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/(api[_ -]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 180);
}

function isStale(timestamp: string | null, hours: number, now: Date): boolean {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return !Number.isFinite(parsed) || now.getTime() - parsed > hours * 3_600_000;
}

function capabilityView(
  definition: IntegrationDefinition,
  capability: IntegrationCapabilityDefinition,
  evidence: IntegrationEvidence,
  now: Date,
  connections: Map<string, ConnectionRow>,
  sources: Map<string, RunRow>,
  jobs: Map<string, RunRow>,
  webhooks: Map<string, WebhookRow>,
): IntegrationCapabilityView {
  if (
    definition.maturity === "planned" ||
    definition.maturity === "next" ||
    definition.maturity === "edge"
  ) {
    return {
      ...capability,
      status: "planned",
      statusReason:
        definition.maturity === "next"
          ? "Next integration wave"
          : definition.maturity === "edge"
            ? "Optional edge capability"
            : "Planned by client demand",
      lastEvidenceAt: null,
    };
  }

  const configurationKey = capability.configurationKey ?? definition.configurationKey;
  const configured = configurationKey ? evidence.configured[configurationKey] === true : true;
  const connection = definition.connectionProvider
    ? connections.get(definition.connectionProvider)
    : null;

  if (
    !evidence.schemaAvailable &&
    (definition.connectionProvider ||
      capability.evidenceKey?.startsWith("source:") ||
      capability.evidenceKey?.startsWith("job:") ||
      capability.evidenceKey?.startsWith("webhook:"))
  ) {
    return {
      ...capability,
      status: "degraded",
      statusReason: "Operational evidence is unavailable",
      lastEvidenceAt: null,
    };
  }
  if (!configured) {
    return {
      ...capability,
      status: "available",
      statusReason: "Available to configure",
      lastEvidenceAt: null,
    };
  }
  if (connection && ["degraded", "revoked"].includes(connection.status)) {
    return {
      ...capability,
      status: "degraded",
      statusReason:
        sanitizeDiagnostic(connection.last_error) ?? `Connection is ${connection.status}`,
      lastEvidenceAt: connection.last_success_at,
    };
  }
  if (connection && connection.status !== "connected") {
    return {
      ...capability,
      status: "action",
      statusReason: "Connection needs to be completed",
      lastEvidenceAt: connection.last_success_at,
    };
  }
  if (capability.requiredScopes?.length && connection) {
    const granted = new Set(connection.scopes ?? []);
    if (!capability.requiredScopes.every((scope) => granted.has(scope))) {
      return {
        ...capability,
        status: "degraded",
        statusReason: "Required permission is missing",
        lastEvidenceAt: connection.last_success_at,
      };
    }
  }

  if (!capability.evidenceKey) {
    return {
      ...capability,
      status: "action",
      statusReason: "Configured; behavioral verification is still required",
      lastEvidenceAt: connection?.last_success_at ?? null,
    };
  }

  const [kind, key] = capability.evidenceKey.split(":", 2) as [
    "runtime" | "source" | "job" | "webhook",
    string,
  ];
  const runtime = kind === "runtime" ? evidence.runtime[key] : null;
  const run = kind === "source" ? sources.get(key) : kind === "job" ? jobs.get(key) : null;
  const webhook = kind === "webhook" ? webhooks.get(key) : null;
  const status = runtime?.status ?? run?.status ?? webhook?.status ?? null;
  const lastEvidenceAt =
    runtime?.checkedAt ?? run?.finishedAt ?? run?.startedAt ?? webhook?.receivedAt ?? null;
  const detail = runtime?.detail ?? run?.error ?? webhook?.error ?? null;

  if (status === "failed" || status === "partial") {
    return {
      ...capability,
      status: "degraded",
      statusReason: sanitizeDiagnostic(detail) ?? `Latest evidence is ${status}`,
      lastEvidenceAt,
    };
  }
  if (status === "running") {
    return {
      ...capability,
      status: "action",
      statusReason: "Verification is currently running",
      lastEvidenceAt,
    };
  }
  if (status !== "success") {
    return {
      ...capability,
      status: "action",
      statusReason: "Configured; run a behavioral verification",
      lastEvidenceAt,
    };
  }
  if (capability.freshnessHours && isStale(lastEvidenceAt, capability.freshnessHours, now)) {
    return {
      ...capability,
      status: "degraded",
      statusReason: `Evidence is older than ${capability.freshnessHours} hours`,
      lastEvidenceAt,
    };
  }
  return { ...capability, status: "ready", statusReason: "Behavior verified", lastEvidenceAt };
}

export function buildIntegrationCatalog(
  evidence: IntegrationEvidence,
  now = new Date(),
): IntegrationCatalog {
  const connections = latestBy(evidence.connections, (row) => row.provider);
  const sources = latestBy(evidence.sourceRuns, (row) => row.key);
  const jobs = latestBy(evidence.jobRuns, (row) => row.key);
  const webhooks = latestBy(evidence.webhooks, (row) => row.provider);

  const providers: IntegrationView[] = integrationRegistry
    .map((definition) => {
      const capabilities = definition.capabilities.map((capability) =>
        capabilityView(definition, capability, evidence, now, connections, sources, jobs, webhooks),
      );
      const connection = definition.connectionProvider
        ? connections.get(definition.connectionProvider)
        : null;
      const sortedStatuses = capabilities
        .map((capability) => capability.status)
        .sort((a, b) => statusRank[a] - statusRank[b]);
      const status =
        sortedStatuses[0] ?? (definition.maturity === "native" ? "available" : "planned");
      const lastEvidenceAt =
        capabilities
          .map((capability) => capability.lastEvidenceAt)
          .filter((value): value is string => Boolean(value))
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
      const statusReason =
        status === "ready"
          ? "All active capabilities are behaviorally verified"
          : (capabilities.find((capability) => capability.status === status)?.statusReason ??
            "No operational evidence");
      return {
        ...definition,
        capabilities,
        status,
        statusReason,
        accountLabel: connection?.account_email ?? null,
        lastEvidenceAt,
      };
    })
    .sort((a, b) => a.priority - b.priority);

  const counts = { ready: 0, degraded: 0, action: 0, available: 0, planned: 0 } satisfies Record<
    IntegrationStatus,
    number
  >;
  for (const provider of providers) counts[provider.status] += 1;

  return {
    registryVersion: INTEGRATION_REGISTRY_VERSION,
    generatedAt: now.toISOString(),
    evidenceAvailable: evidence.schemaAvailable,
    summary: {
      ...counts,
      total: providers.length,
      live: counts.ready + counts.degraded + counts.action,
      attention: counts.degraded + counts.action,
    },
    providers,
  };
}

function configured(...keys: string[]): boolean {
  return keys.every((key) => Boolean(process.env[key]?.trim()));
}

export async function loadIntegrationCatalog(
  supabase: SupabaseClient,
): Promise<IntegrationCatalog> {
  const checkedAt = new Date().toISOString();
  const [
    connectionResult,
    sourceResult,
    jobResult,
    webhookResult,
    messageResult,
    firstPartyResult,
    agentResult,
    schemaResult,
    openRouterCredential,
  ] = await Promise.all([
    supabase
      .from("integration_connections")
      .select("provider,account_email,status,scopes,last_sync_at,last_success_at,last_error")
      .order("connected_at", { ascending: false }),
    supabase
      .from("source_runs")
      .select("source_key,status,started_at,finished_at,error")
      .order("started_at", { ascending: false })
      .limit(100),
    supabase
      .from("job_runs")
      .select("job_key,status,claimed_at,finished_at,error")
      .order("claimed_at", { ascending: false })
      .limit(100),
    supabase
      .from("webhook_receipts")
      .select("provider,status,received_at,error")
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("messages")
      .select(
        "status,provider_id,created_at,conversations!messages_conversation_id_tenant_fkey!inner(channel)",
      )
      .eq("conversations.channel", "resend")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("website_events")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("agent_runs")
      .select("status,started_at,finished_at,error")
      .order("started_at", { ascending: false })
      .limit(1),
    supabase
      .from("schema_verification_runs")
      .select("status,checked_at,failure_detail")
      .order("checked_at", { ascending: false })
      .limit(1),
    resolveOpenRouterCredential(supabase).catch(() => null),
  ]);

  const evidenceTablesAvailable =
    !connectionResult.error && !sourceResult.error && !jobResult.error && !webhookResult.error;
  const latestMessage = messageResult.data?.[0];
  const latestFirstParty = firstPartyResult.data?.[0];
  const latestAgent = agentResult.data?.[0];
  const latestSchema = schemaResult.data?.[0];

  // A real probe, not a hardcoded constant: actually dispatch tools/list
  // through the same handler /api/mcp and every tenant MCP endpoint use, so
  // this reflects whether the tool registry genuinely loads and responds,
  // not whether the setup author remembered to keep a status string honest.
  let mcpStatus: "success" | "failed" = "failed";
  let mcpToolCount = 0;
  try {
    const probeResponse = await handleMcpRequest(
      { jsonrpc: "2.0", id: "setup-probe", method: "tools/list" },
      { supabase, actorEmail: "setup-check@internal" },
    );
    const tools = (probeResponse?.result as { tools?: unknown[] } | undefined)?.tools;
    if (Array.isArray(tools) && tools.length > 0) {
      mcpStatus = "success";
      mcpToolCount = tools.length;
    }
  } catch {
    mcpStatus = "failed";
  }

  return buildIntegrationCatalog({
    schemaAvailable: evidenceTablesAvailable,
    configured: {
      supabase: configured(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ),
      google: configured("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TOKEN_ENCRYPTION_KEY"),
      resend: configured("RESEND_API_KEY", "RESEND_FROM_EMAIL"),
      resend_webhooks: configured("RESEND_WEBHOOK_SECRET"),
      openrouter: Boolean(openRouterCredential),
      mcp: mcpStatus === "success",
      whatsapp: configured("WHATSAPP_APP_SECRET") || configured("WHATSAPP_ACCESS_TOKEN"),
    },
    runtime: {
      mcp: {
        status: mcpStatus,
        checkedAt,
        detail:
          mcpStatus === "success"
            ? `MCP JSON-RPC 2.0 protocol server responded with ${mcpToolCount} tools and ${MCP_REVENUE_OS_PROMPTS.length} prompt workflows`
            : "MCP JSON-RPC 2.0 protocol server did not respond to a live tools/list probe",
      },
      supabase: {
        status:
          !evidenceTablesAvailable ||
          schemaResult.error ||
          latestSchema?.status === "failed" ||
          latestSchema?.status === "drift"
            ? "failed"
            : latestSchema?.status === "success"
              ? "success"
              : "unknown",
        checkedAt: latestSchema?.checked_at ?? checkedAt,
        detail: !evidenceTablesAvailable
          ? "Revenue OS evidence tables could not be read"
          : schemaResult.error
            ? "Schema verification receipts could not be read"
            : (latestSchema?.failure_detail ?? undefined),
      },
      resend: {
        status: messageResult.error
          ? "failed"
          : latestMessage?.status === "sent" && latestMessage.provider_id
            ? "success"
            : latestMessage?.status === "failed"
              ? "failed"
              : "unknown",
        checkedAt: latestMessage?.created_at ?? checkedAt,
        detail: messageResult.error ? "Message receipts could not be read" : undefined,
      },
      openrouter: {
        status: agentResult.error
          ? "failed"
          : latestAgent?.status === "completed" || latestAgent?.status === "partial"
            ? "success"
            : latestAgent?.status === "failed"
              ? "failed"
              : "unknown",
        checkedAt: latestAgent?.finished_at ?? latestAgent?.started_at ?? checkedAt,
        detail: agentResult.error
          ? "AI run receipts could not be read"
          : (latestAgent?.error ?? undefined),
      },
      "first-party": {
        status: firstPartyResult.error ? "failed" : latestFirstParty ? "success" : "unknown",
        checkedAt: latestFirstParty?.created_at ?? checkedAt,
        detail: firstPartyResult.error ? "First-party analytics could not be read" : undefined,
      },
    },
    connections: (connectionResult.data ?? []) as ConnectionRow[],
    sourceRuns: (sourceResult.data ?? []).map((row) => ({
      key: row.source_key,
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      error: row.error,
    })),
    jobRuns: (jobResult.data ?? []).map((row) => ({
      key: row.job_key,
      status: row.status,
      startedAt: row.claimed_at,
      finishedAt: row.finished_at,
      error: row.error,
    })),
    webhooks: (webhookResult.data ?? []).map((row) => ({
      provider: row.provider,
      status: row.status,
      receivedAt: row.received_at,
      error: row.error,
    })),
  });
}

export type SetupStatus = "ready" | "action" | "degraded" | "optional" | "disabled";

export function resendDeliveryReadiness(input: {
  configured: boolean;
  lastOutbound?: { status: string; sent_at: string | null; created_at?: string | null; provider_id?: string | null } | null;
}): { status: SetupStatus; description: string; lastSuccessAt: string | null; lastFailure: string | null } {
  if (!input.configured) {
    return {
      status: "action",
      description: "Add the Resend API key and verified sender.",
      lastSuccessAt: null,
      lastFailure: null,
    };
  }
  const last = input.lastOutbound;
  if (!last) {
    return {
      status: "action",
      description: "A server-only API key and verified sender are configured, but no outbound delivery receipt exists yet. Configuration is not delivery health.",
      lastSuccessAt: null,
      lastFailure: null,
    };
  }
  if (last.status === "sent") {
    return {
      status: "ready",
      description: "Resend accepted an outbound message and a local receipt recorded the provider id.",
      lastSuccessAt: last.sent_at ?? last.created_at ?? null,
      lastFailure: null,
    };
  }
  return {
    status: "degraded",
    description: "The latest outbound send did not reach a sent receipt. Review the failed message before treating email as healthy.",
    lastSuccessAt: null,
    lastFailure: `Latest outbound message is ${last.status}${last.provider_id ? "" : " without a provider id"}.`,
  };
}

export function setupNextRun(kind:
  | "config"
  | "schema-verify"
  | "cron-job"
  | "health-snapshot"
  | "gmail-sync"
  | "outbound-send"
  | "public-event"
): string {
  switch (kind) {
    case "config":
      return "No scheduled run. Status updates when this setting or connection changes.";
    case "schema-verify":
      return "Next run: npm run db:verify-schema -- --record after the next schema change.";
    case "cron-job":
      return "Next expected run: the next authenticated cron invocation for this job.";
    case "health-snapshot":
      return "Next expected wake-up: within 15 minutes when the scheduler is healthy.";
    case "gmail-sync":
      return "Next run: the next Google Workspace sync job after the founder is connected.";
    case "outbound-send":
      return "Next run: the next founder test send, campaign step, or transactional message.";
    case "public-event":
      return "Next run: the next public proposal view, accept/decline, or website event.";
  }
}

export function calendlyAttributionReadiness(input: {
  bookingMode: "embed" | "manual" | "disabled";
  webhookConfigured: boolean;
  lastSignedReceipt?: { event_type: string; processed_at: string | null } | null;
}): { status: SetupStatus; description: string; lastSuccessAt: string | null } {
  if (input.bookingMode === "disabled") {
    return {
      status: "disabled",
      description: "Public self-booking is paused. Attribution stays off until the embed is re-enabled.",
      lastSuccessAt: null,
    };
  }
  if (input.bookingMode === "manual") {
    return {
      status: "optional",
      description: "The founder schedules by reply. Calendly API tokens are not required and are not treated as ready.",
      lastSuccessAt: null,
    };
  }
  if (!input.webhookConfigured) {
    return {
      status: "action",
      description: "The public embed is on. Signed Calendly webhooks are still required before booking and cancellation attribution can be Ready.",
      lastSuccessAt: null,
    };
  }
  if (!input.lastSignedReceipt) {
    return {
      status: "action",
      description: "A webhook secret is configured, but no signed booking or cancellation receipt exists yet. Tokens are not attribution health.",
      lastSuccessAt: null,
    };
  }
  return {
    status: "ready",
    description: "A signed Calendly booking or cancellation receipt is on the ledger.",
    lastSuccessAt: input.lastSignedReceipt.processed_at,
  };
}

export function campaignEngineReadiness(input: {
  schemaReady: boolean;
  configured: boolean;
  lastJob?: { status: string; finished_at: string | null; error: string | null } | null;
}): { status: SetupStatus; lastSuccessAt: string | null; lastFailure: string | null } {
  if (!input.schemaReady || !input.configured) {
    return { status: "action", lastSuccessAt: null, lastFailure: null };
  }
  if (input.lastJob?.status === "failed") {
    return { status: "degraded", lastSuccessAt: null, lastFailure: input.lastJob.error };
  }
  return {
    status: "ready",
    lastSuccessAt: input.lastJob?.status === "success" ? input.lastJob.finished_at : null,
    lastFailure: null,
  };
}

import {
  indexDriveFolder,
  emptyDriveIndexSummary,
  type DriveDocumentRow,
} from "./drive-content-indexing";
import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "./encryption";
import { normalizeEmail, safeErrorMessage } from "./db";
import { recordSourceRun } from "./runs";
import { findCanonicalContactByEmail } from "./identity";
import { stopCampaignMemberships } from "./campaign-stops";
import {
  planGmailThreadSync,
  type GmailHistoryPage,
  type GmailThreadListPage,
} from "./gmail-sync-plan";
import { isWithinAllowlist, normalizeDriveFolderIds, staleAllowlistIds } from "./drive-sync-plan";
import { recordActivity } from "./activities";
import { recordAudit } from "./audit";
import { associateConversationParticipants } from "./conversations";
import { prepareGmailReply } from "./gmail-reply-mime";
import { parseAddressList, parseRfcMessageId, resolveGmailDirection } from "./gmail-threading";
import { assertGmailDraftTarget } from "./work-drafts";
import { createPreCallBriefWork, createPostMeetingProcessWork } from "./meeting-intel-coworker";
import { assertActiveTenantExecution } from "@/lib/tenancy/system";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import type { WorkItem } from "./work-items";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
];
export const GOOGLE_GMAIL_DRAFT_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl.replace(/\/$/, "")}/api/admin/google/callback`,
  };
}

export function buildGoogleAuthUrl(
  state: string,
  options: { includeGmailDrafts?: boolean } = {},
): string {
  const config = googleConfig();
  const scopes = options.includeGmailDrafts
    ? [...GOOGLE_SCOPES, GOOGLE_GMAIL_DRAFT_SCOPE]
    : GOOGLE_SCOPES;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new GoogleApiError(
      (payload as { error_description?: string; error?: { message?: string } | string })
        .error_description ||
        (typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : (payload as { error?: { message?: string } }).error?.message) ||
        `Google request failed (${response.status})`,
      response.status,
    );
  return payload as T;
}

export async function exchangeGoogleCode(code: string) {
  const config = googleConfig();
  return googleFetch<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
}

export async function saveGoogleConnection(
  supabase: SupabaseClient,
  tokens: { access_token: string; refresh_token?: string; expires_in: number; scope: string },
) {
  await assertActiveTenantExecution(supabase, "google-connect");
  const profile = await googleFetch<{ email: string }>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const { data: existing } = await supabase
    .from("integration_connections")
    .select("encrypted_refresh_token,connected_at,scopes")
    .eq("provider", "google")
    .maybeSingle();
  if (!tokens.refresh_token && !existing?.encrypted_refresh_token)
    throw new Error("Google did not return a refresh token. Reconnect and grant offline access.");
  const previouslyGranted = (existing?.scopes ?? []) as string[];
  if (
    tokens.scope.split(/\s+/).includes(GOOGLE_GMAIL_DRAFT_SCOPE) &&
    !tokens.refresh_token &&
    !previouslyGranted.includes(GOOGLE_GMAIL_DRAFT_SCOPE)
  )
    throw new Error(
      "Google did not return refreshed authorization for Gmail drafts. Reconnect and grant access again.",
    );
  const { error } = await supabase.from("integration_connections").upsert(
    {
      provider: "google",
      account_email: normalizeEmail(profile.email),
      encrypted_access_token: encryptSecret(tokens.access_token),
      encrypted_refresh_token: tokens.refresh_token
        ? encryptSecret(tokens.refresh_token)
        : existing?.encrypted_refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
      status: "connected",
      connected_at: existing?.connected_at || new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "tenant_id,provider" },
  );
  if (error) throw new Error(error.message);
  return profile;
}

export async function getGoogleAccessToken(
  supabase: SupabaseClient,
): Promise<{ token: string; connection: Record<string, unknown> }> {
  await assertActiveTenantExecution(supabase, "google");
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("provider", "google")
    .eq("status", "connected")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection?.encrypted_refresh_token) throw new Error("Google Workspace is not connected");
  if (!isEncryptedSecret(connection.encrypted_refresh_token))
    throw new Error("Google refresh token is not in the encrypted envelope; reconnect Workspace.");
  if (
    connection.encrypted_access_token &&
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() > Date.now() + 60000
  ) {
    if (!isEncryptedSecret(connection.encrypted_access_token))
      throw new Error("Google access token is not in the encrypted envelope; reconnect Workspace.");
    return { token: decryptSecret(connection.encrypted_access_token), connection };
  }

  const config = googleConfig();
  try {
    const refreshed = await googleFetch<{
      access_token: string;
      expires_in: number;
      scope?: string;
    }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: decryptSecret(connection.encrypted_refresh_token),
        grant_type: "refresh_token",
      }),
    });
    const patch = {
      encrypted_access_token: encryptSecret(refreshed.access_token),
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      scopes: refreshed.scope ? refreshed.scope.split(/\s+/).filter(Boolean) : connection.scopes,
      last_error: null,
    };
    await supabase.from("integration_connections").update(patch).eq("id", connection.id);
    return { token: refreshed.access_token, connection: { ...connection, ...patch } };
  } catch (error) {
    const message = safeErrorMessage(error);
    await supabase
      .from("integration_connections")
      .update({
        status: /invalid_grant/i.test(message) ? "revoked" : "degraded",
        last_error: message,
      })
      .eq("id", connection.id);
    throw error;
  }
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}
interface GmailProfile {
  emailAddress: string;
  historyId: string;
}

function header(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.value || null
  );
}

function decodeBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const child of part.parts ?? []) {
    const value = decodeBody(child);
    if (value) return value;
  }
  return part.body?.data ? Buffer.from(part.body.data, "base64url").toString("utf8") : "";
}

function parseAddress(value: string | null): string | null {
  if (!value) return null;
  return normalizeEmail(value.match(/<([^>]+)>/)?.[1] || value.split(",")[0]);
}

/**
 * Every address Gmail may send as for this connection: the account address
 * plus its Send-As aliases. Direction is outbound for all of them; without
 * the aliases, mail sent from an alias files as inbound and corrupts thread
 * chronology, unread counts, and reply detection. Best-effort: an alias
 * fetch failure degrades to account-only rather than failing the sync.
 */
async function listGmailOwnerEmails(token: string, accountEmail: string): Promise<Set<string>> {
  const owners = new Set<string>();
  const account = normalizeEmail(accountEmail);
  if (account) owners.add(account);
  try {
    const response = await googleFetch<{ sendAs?: Array<{ sendAsEmail?: string }> }>(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    for (const entry of response.sendAs ?? []) {
      const alias = normalizeEmail(entry.sendAsEmail);
      if (alias) owners.add(alias);
    }
  } catch (error) {
    console.error("[google/gmail-aliases]", error);
  }
  return owners;
}

export async function syncGmail(supabase: SupabaseClient, maxThreads = 75) {
  const tenantId = tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Gmail sync requires an explicit workspace");
  const { token, connection } = await getGoogleAccessToken(supabase);
  const profile = await googleFetch<GmailProfile>(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const settings = (connection.settings ?? {}) as { gmail_history_id?: string };
  let history: GmailHistoryPage | null = null;
  let list: GmailThreadListPage | null = null;
  let cursorExpired = false;
  if (settings.gmail_history_id) {
    try {
      const params = new URLSearchParams({
        startHistoryId: settings.gmail_history_id,
        historyTypes: "messageAdded",
        maxResults: String(Math.min(100, maxThreads)),
      });
      history = await googleFetch<GmailHistoryPage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {
      // Gmail expires old cursors. Fall back to the bounded reconciliation path
      // and never advance the cursor while that reconciliation is incomplete.
      if (!/history|not found|404/i.test(safeErrorMessage(error))) throw error;
      cursorExpired = true;
    }
  }
  if (!history) {
    list = await googleFetch<GmailThreadListPage>(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${Math.min(100, maxThreads)}&q=${encodeURIComponent("newer_than:30d")}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }
  const plan = planGmailThreadSync({
    cursor: settings.gmail_history_id,
    history,
    list,
    cursorExpired,
    maxThreads,
  });
  const threadIds = plan.threadIds;
  let stored = 0;
  let failed = 0;
  const ownerEmails = await listGmailOwnerEmails(token, connection.account_email as string);
  const isOutbound = (from: string | null) =>
    resolveGmailDirection(from, ownerEmails) === "outbound";
  for (const threadId of threadIds) {
    try {
      const thread = await googleFetch<{
        id: string;
        historyId?: string;
        messages?: GmailMessage[];
      }>(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messages = thread.messages ?? [];
      if (!messages.length) continue;
      const latest = messages.at(-1)!;
      const subject = header(latest, "Subject") || "(No subject)";
      const externalEmails = messages
        .flatMap((message) => [
          parseAddress(header(message, "From")),
          ...parseAddressList(header(message, "To")),
          ...parseAddressList(header(message, "Cc")),
        ])
        .filter((email): email is string => Boolean(email && !ownerEmails.has(email)));
      const participantEmails = [...new Set(externalEmails)];
      const contactEmail = participantEmails[0] || null;
      // Preserve existing links: a manual or previously verified association
      // is human truth and a later sync must only fill blanks, never overwrite.
      const { data: existingConversation, error: existingError } = await supabase
        .from("conversations")
        .select("id,contact_id,company_id,opportunity_id")
        .eq("tenant_id", tenantId)
        .eq("channel", "gmail")
        .eq("external_id", thread.id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      const unread = messages.filter(
        (message) =>
          message.labelIds?.includes("UNREAD") &&
          !isOutbound(parseAddress(header(message, "From"))),
      ).length;
      const lastAt = latest.internalDate
        ? new Date(Number(latest.internalDate)).toISOString()
        : new Date().toISOString();
      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .upsert(
          {
            tenant_id: tenantId,
            channel: "gmail",
            external_id: thread.id,
            subject,
            contact_id: (existingConversation?.contact_id as string) ?? null,
            company_id: (existingConversation?.company_id as string) ?? null,
            opportunity_id: (existingConversation?.opportunity_id as string) ?? null,
            status: unread ? "open" : "waiting",
            unread_count: unread,
            last_message_at: lastAt,
            metadata: { history_id: thread.historyId ?? null, contact_email: contactEmail },
          },
          { onConflict: "tenant_id,channel,external_id" },
        )
        .select("id")
        .single();
      if (conversationError) throw new Error(conversationError.message);
      // Deterministic association never fails the sync: ambiguity becomes a
      // founder review action and anything else is recorded on the thread.
      let contactId: string | null = (existingConversation?.contact_id as string) ?? null;
      let opportunityId: string | null = (existingConversation?.opportunity_id as string) ?? null;
      try {
        const association = await associateConversationParticipants(supabase, {
          conversationId: conversation.id,
          participantEmails,
          threadExternalId: thread.id,
          actorEmail: "system",
        });
        contactId = association.contactId;
        opportunityId = association.opportunityId;
      } catch (associationError) {
        console.error("[google/gmail-association]", associationError);
      }
      const rows = messages.map((message) => {
        const from = parseAddress(header(message, "From"));
        const to = parseAddress(header(message, "To"));
        const outbound = isOutbound(from);
        return {
          tenant_id: tenantId,
          conversation_id: conversation.id,
          external_id: message.id,
          direction: outbound ? "outbound" : "inbound",
          sender_email: from,
          recipient_emails: to ? [to] : [],
          subject: header(message, "Subject"),
          body_text: decodeBody(message.payload) || message.snippet || "",
          status: message.labelIds?.includes("DRAFT")
            ? "drafted"
            : outbound
              ? "sent"
              : message.labelIds?.includes("UNREAD")
                ? "unread"
                : "received",
          in_reply_to: header(message, "In-Reply-To"),
          references_header: header(message, "References"),
          sent_at: message.internalDate
            ? new Date(Number(message.internalDate)).toISOString()
            : null,
          received_at: outbound
            ? null
            : message.internalDate
              ? new Date(Number(message.internalDate)).toISOString()
              : null,
          metadata: {
            labels: message.labelIds ?? [],
            gmail_thread_id: thread.id,
            // The provider id (external_id) is Gmail's opaque id, not the
            // RFC Message-ID threading runs on. Retain both, plus the full
            // participant lists, so replies chain real RFC headers and no
            // participant is lost to first-address truncation.
            rfc_message_id: parseRfcMessageId(header(message, "Message-ID")),
            participants: {
              from: parseAddressList(header(message, "From")),
              to: parseAddressList(header(message, "To")),
              cc: parseAddressList(header(message, "Cc")),
            },
          },
        };
      });
      const inboundRows = rows.filter((row) => row.direction === "inbound");
      const batchIds = rows.map((row) => row.external_id);
      const { data: priorRows, error: priorError } = batchIds.length
        ? await supabase
            .from("messages")
            .select("external_id,status,metadata")
            .eq("tenant_id", tenantId)
            .eq("conversation_id", conversation.id)
            .in("external_id", batchIds)
        : { data: [], error: null };
      if (priorError) throw new Error(priorError.message);
      // Terminal reply receipts (sent/failed) are the reply path's truthful
      // record of an external effect. A later sync must never clobber them
      // back to "received": the same Gmail message arriving through two paths
      // stays one canonical message, and the receipt wins.
      const terminalIds = new Set(
        (priorRows ?? [])
          .filter((message) => message.status === "sent" || message.status === "failed")
          .map((message) => message.external_id),
      );
      const priorById = new Map((priorRows ?? []).map((message) => [message.external_id, message]));
      const upsertRows = rows
        .filter((row) => !terminalIds.has(row.external_id))
        .map((row) => ({
          ...row,
          metadata: { ...(priorById.get(row.external_id)?.metadata ?? {}), ...row.metadata },
        }));
      if (upsertRows.length) {
        const { error: messageError } = await supabase.from("messages").upsert(upsertRows, {
          onConflict: "tenant_id,conversation_id,external_id",
          ignoreDuplicates: false,
        });
        if (messageError) throw new Error(messageError.message);
      }
      // Manual send in Gmail turns the saved draft into a sent message. Match
      // the exact RFC Message-ID + Gmail thread receipt, then move the same
      // waiting WorkItem from "review draft" to "waiting for reply" once.
      for (const sent of rows.filter(
        (row) => row.direction === "outbound" && row.status === "sent",
      )) {
        const rfcMessageId = (sent.metadata as { rfc_message_id?: string | null }).rfc_message_id;
        if (!rfcMessageId) continue;
        const { data: actions, error: actionError } = await supabase
          .from("action_queue")
          .select("id,payload,result")
          .eq("tenant_id", tenantId)
          .eq("action_type", "create_gmail_draft")
          .eq("status", "executed")
          .contains("result", { rfcMessageId, threadId: thread.id })
          .limit(2);
        if (actionError) throw new Error(actionError.message);
        if (actions?.length !== 1) continue;
        const action = actions[0]!;
        const payload = action.payload as Record<string, unknown>;
        const receipt = action.result as Record<string, unknown> | null;
        const workItemId = typeof payload.workItemId === "string" ? payload.workItemId : null;
        if (
          !workItemId ||
          payload.conversationId !== conversation.id ||
          receipt?.sent !== false ||
          receipt?.messageId !== sent.external_id
        )
          continue;
        const { error: followupError } = await supabase
          .from("work_items")
          .update({
            outcome: "Follow-up sent from Gmail. Waiting for a reply.",
            next_check_at: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString(),
            next_check_reason:
              "The message was sent from Gmail. Check this thread for a reply; sync closes the loop when the canonical contact responds.",
          })
          .eq("tenant_id", tenantId)
          .eq("id", workItemId)
          .eq("kind", "draft_followup")
          .eq("entity_id", payload.opportunityId)
          .eq("status", "waiting")
          .eq("outcome", "Gmail draft saved. Not sent.")
          .is("lease_owner", null);
        if (followupError) throw new Error(followupError.message);
      }
      const priorIds = new Set((priorRows ?? []).map((message) => message.external_id));
      const newInbound = inboundRows.filter((row) => !priorIds.has(row.external_id));
      // Persist every inbound reply through the activity ledger, not merely a
      // first-seen stop. On a retry the message may no longer be "new", but
      // this deterministic receipt still repairs any earlier partial handoff.
      if (contactId) {
        for (const reply of inboundRows) {
          await recordActivity(supabase, {
            activityType: "gmail_reply_received",
            title: `Gmail reply received: ${reply.subject || "(No subject)"}`,
            summary: "Inbound Gmail reply received from a known contact.",
            contactId,
            opportunityId,
            conversationId: conversation.id,
            source: "gmail_sync",
            externalId: `gmail:${thread.id}:${reply.external_id}`,
            occurredAt: reply.received_at || reply.sent_at || new Date().toISOString(),
            metadata: { gmail_thread_id: thread.id, gmail_message_id: reply.external_id },
          });
        }
      }
      if (contactId && newInbound.length) {
        const reply = newInbound[0]!;
        await stopCampaignMemberships(supabase, {
          contactId,
          reason: "gmail_reply",
          source: "automation",
          sourceReceiptId: `gmail:${thread.id}:${reply.external_id}`,
        });
      }
      if (inboundRows.length) {
        const { data: actions, error: actionError } = await supabase
          .from("action_queue")
          .select("id,payload,result")
          .eq("tenant_id", tenantId)
          .eq("action_type", "create_gmail_draft")
          .eq("status", "executed")
          .contains("payload", { conversationId: conversation.id })
          .limit(20);
        if (actionError) throw new Error(actionError.message);
        for (const reply of inboundRows) {
          const sender = normalizeEmail(reply.sender_email ?? "");
          const action = actions?.find((candidate) => {
            const payload = candidate.payload as Record<string, unknown>;
            const receipt = candidate.result as Record<string, unknown> | null;
            return (
              payload.workItemId &&
              payload.conversationId === conversation.id &&
              payload.opportunityId === opportunityId &&
              normalizeEmail(String(payload.to ?? "")) === sender &&
              receipt?.sent === false &&
              receipt?.threadId === thread.id
            );
          });
          const payload = action?.payload as Record<string, unknown> | undefined;
          if (!action || typeof payload?.workItemId !== "string") continue;
          const { error: closeError } = await supabase
            .from("work_items")
            .update({
              status: "completed",
              finished_at: new Date().toISOString(),
              outcome:
                "The canonical contact replied in this Gmail thread. Review the conversation for any new work.",
              next_check_at: null,
              next_check_reason: null,
              error: null,
            })
            .eq("tenant_id", tenantId)
            .eq("id", payload.workItemId)
            .eq("kind", "draft_followup")
            .eq("entity_id", opportunityId)
            .eq("status", "waiting")
            .eq("outcome", "Follow-up sent from Gmail. Waiting for a reply.")
            .is("lease_owner", null);
          if (closeError) throw new Error(closeError.message);
        }
      }
      stored++;
    } catch (error) {
      failed++;
      console.error("[google/gmail-sync]", error);
    }
  }
  const status = failed && stored ? "partial" : failed ? "failed" : "success";
  const cursorAdvanced = status === "success" && plan.cursorAdvanceSafe;
  const nextSettings = cursorAdvanced
    ? { ...settings, gmail_history_id: profile.historyId }
    : settings;
  await recordSourceRun(supabase, {
    sourceKey: "gmail",
    status,
    summary: {
      mode: plan.mode,
      listed: threadIds.length,
      stored,
      failed,
      deferred: Number(plan.deferred),
      deferred_reason: plan.deferReason,
      cursor_advanced: cursorAdvanced,
      cursor_present: Boolean(settings.gmail_history_id),
    },
  });
  await supabase
    .from("integration_connections")
    .update({
      settings: nextSettings,
      last_sync_at: new Date().toISOString(),
      last_success_at: stored || !failed ? new Date().toISOString() : undefined,
      last_error: failed
        ? `${failed} Gmail threads failed`
        : plan.deferred
          ? "Gmail backlog remains; cursor intentionally not advanced"
          : null,
      status: failed && !stored ? "degraded" : "connected",
    })
    .eq("provider", "google");
  return {
    mode: plan.mode,
    listed: threadIds.length,
    stored,
    failed,
    deferred: Number(plan.deferred),
    cursorAdvanced,
  };
}

export async function syncCalendar(supabase: SupabaseClient) {
  const { token } = await getGoogleAccessToken(supabase);
  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 120 * 86400000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });
  try {
    const data = await googleFetch<{ items?: Array<Record<string, unknown>> }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const externalIds = (data.items ?? []).map((event) => String(event.id)).filter(Boolean);
    const { data: existingEvents, error: existingError } = externalIds.length
      ? await supabase
          .from("calendar_events")
          .select("id,external_id,metadata")
          .eq("provider", "google")
          .in("external_id", externalIds)
      : { data: [], error: null };
    if (existingError) throw new Error(existingError.message);
    const existingByExternalId = new Map(
      (existingEvents ?? []).map((event) => [event.external_id, event]),
    );
    const rows = await Promise.all(
      (data.items ?? []).map(async (event) => {
        const start = event.start as { dateTime?: string; date?: string } | undefined;
        const end = event.end as { dateTime?: string; date?: string } | undefined;
        const attendees = Array.isArray(event.attendees) ? event.attendees : [];
        const attendeeEmails = attendees
          .map((attendee) =>
            attendee &&
            typeof attendee === "object" &&
            typeof (attendee as { email?: unknown }).email === "string"
              ? normalizeEmail((attendee as { email: string }).email)
              : null,
          )
          .filter((email): email is string => Boolean(email));
        const matches = await Promise.all(
          attendeeEmails.map((email) => findCanonicalContactByEmail(supabase, email)),
        );
        const contactMatches = new Map(
          matches
            .filter((match): match is NonNullable<typeof match> => Boolean(match))
            .map((match) => [match.id, match]),
        );
        const contact = contactMatches.size === 1 ? [...contactMatches.values()][0]! : null;
        let opportunityId: string | null = null;
        if (contact) {
          const { data: opportunity, error: opportunityError } = await supabase
            .from("opportunities")
            .select("id")
            .eq("contact_id", contact.id)
            .not("stage", "in", "(won,lost)")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (opportunityError) throw new Error(opportunityError.message);
          opportunityId = opportunity?.id ?? null;
        }
        const externalId = String(event.id);
        const existingMetadata = (existingByExternalId.get(externalId)?.metadata ?? {}) as Record<
          string,
          unknown
        >;
        return {
          provider: "google",
          external_id: externalId,
          calendar_id: "primary",
          title: String(event.summary || "Untitled event"),
          description: typeof event.description === "string" ? event.description : null,
          location: typeof event.location === "string" ? event.location : null,
          start_at: start?.dateTime || (start?.date ? `${start.date}T00:00:00Z` : null),
          end_at: end?.dateTime || (end?.date ? `${end.date}T00:00:00Z` : null),
          all_day: Boolean(start?.date && !start.dateTime),
          status: typeof event.status === "string" ? event.status : null,
          html_link: typeof event.htmlLink === "string" ? event.htmlLink : null,
          attendees,
          contact_id: contact?.id ?? null,
          opportunity_id: opportunityId,
          metadata: {
            organizer: event.organizer ?? null,
            hangout_link: event.hangoutLink ?? null,
            attendee_emails: attendeeEmails,
            identity_resolution:
              contactMatches.size > 1 ? "ambiguous" : contact ? "matched" : "unmatched",
            campaign_stop_receipt: existingMetadata.campaign_stop_receipt ?? null,
            booking_occurred_at: typeof event.created === "string" ? event.created : null,
          },
          synced_at: new Date().toISOString(),
        };
      }),
    );
    const { error } = rows.length
      ? await supabase
          .from("calendar_events")
          .upsert(rows, { onConflict: "tenant_id,provider,external_id" })
      : { error: null };
    if (error) throw new Error(error.message);
    const now = Date.now();
    for (const row of rows) {
      const metadata = row.metadata as {
        campaign_stop_receipt?: string | null;
        booking_occurred_at?: string | null;
      };
      const upcomingConfirmedMeeting =
        row.contact_id &&
        row.status === "confirmed" &&
        row.start_at &&
        new Date(row.start_at).getTime() >= now;
      if (upcomingConfirmedMeeting) {
        const receipt = `google-calendar:${row.external_id}`;
        const occurredAt =
          metadata.booking_occurred_at && !Number.isNaN(Date.parse(metadata.booking_occurred_at))
            ? metadata.booking_occurred_at
            : new Date().toISOString();
        await recordActivity(supabase, {
          activityType: "calendar_booking",
          title: "Google Calendar booking confirmed",
          summary: row.start_at ? `Scheduled for ${row.start_at}.` : "Upcoming confirmed meeting.",
          contactId: row.contact_id!,
          opportunityId: row.opportunity_id,
          source: "google_calendar",
          actorEmail: tenant.founder.systemActorEmail,
          externalId: receipt,
          occurredAt,
          metadata: { calendar_event_id: row.external_id },
        });
        if (!metadata.campaign_stop_receipt) {
          await stopCampaignMemberships(supabase, {
            contactId: row.contact_id!,
            reason: "calendar_booking",
            source: "automation",
            sourceReceiptId: receipt,
          });
          await supabase
            .from("calendar_events")
            .update({ metadata: { ...metadata, campaign_stop_receipt: receipt } })
            .eq("provider", "google")
            .eq("external_id", row.external_id);
        }
        // Create a pre-call brief for the Meeting Intel coworker.
        createPreCallBriefWork(supabase, {
          contactId: row.contact_id!,
          meetingAt: row.start_at!,
          actorEmail: tenant.founder.systemActorEmail,
        }).catch(() => {});
      }
      // Post-meeting processing for past confirmed meetings with an opportunity.
      const pastConfirmedMeeting =
        row.contact_id &&
        row.opportunity_id &&
        row.status === "confirmed" &&
        row.start_at &&
        new Date(row.start_at).getTime() < now;
      if (pastConfirmedMeeting) {
        createPostMeetingProcessWork(supabase, {
          opportunityId: row.opportunity_id!,
          meetingAt: row.start_at!,
          actorEmail: tenant.founder.systemActorEmail,
        }).catch(() => {});
      }
    }
    const matched = rows.filter((row) => row.contact_id).length;
    const ambiguous = rows.filter(
      (row) =>
        (row.metadata as { identity_resolution?: string }).identity_resolution === "ambiguous",
    ).length;
    await recordAudit(supabase, {
      actorEmail: tenant.founder.systemActorEmail,
      action: "calendar.synced",
      entityType: "integration",
      entityId: "google_calendar",
      source: "automation",
      after: {
        stored: rows.length,
        matched,
        unmatched: rows.length - matched - ambiguous,
        ambiguous,
        window: { timeMin, timeMax },
      },
    });
    await recordSourceRun(supabase, {
      sourceKey: "google_calendar",
      status: "success",
      summary: { stored: rows.length },
    });
    return { stored: rows.length };
  } catch (error) {
    await recordSourceRun(supabase, {
      sourceKey: "google_calendar",
      status: "failed",
      error: safeErrorMessage(error),
    });
    throw error;
  }
}

export async function syncDrive(supabase: SupabaseClient) {
  const { token, connection } = await getGoogleAccessToken(supabase);
  const settings = (connection.settings || {}) as { drive_folder_ids?: string[] };
  const { ids: folders, rejected } = normalizeDriveFolderIds(settings.drive_folder_ids ?? []);
  if (!folders.length) {
    await recordSourceRun(supabase, {
      sourceKey: "google_drive",
      status: "not_configured",
      summary: { reason: "No folders selected", rejected: rejected.length },
    });
    return { stored: 0, notConfigured: true, rejected: rejected.length };
  }
  let stored = 0;
  let quarantined = 0;
  const indexSummary = await emptyDriveIndexSummary();
  for (const folderId of folders) {
    const rows: DriveDocumentRow[] = [];
    let pageToken: string | undefined;
    let listingComplete = false;
    const visitedPages = new Set<string>();
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({
        q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
        fields:
          "nextPageToken,incompleteSearch,files(id,name,mimeType,webViewLink,modifiedTime,md5Checksum,version,parents,capabilities(canDownload))",
        pageSize: "200",
        orderBy: "modifiedTime desc",
        ...(pageToken ? { pageToken } : {}),
      });
      const data = await googleFetch<{
        files?: Array<Record<string, unknown>>;
        nextPageToken?: string;
        incompleteSearch?: boolean;
      }>(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
      });
      for (const file of data.files ?? []) {
        if (typeof file.id !== "string" || !isWithinAllowlist(file.parents, [folderId])) {
          quarantined++;
          continue;
        }
        rows.push({
          provider: "google",
          external_id: file.id,
          name: String(file.name || "Untitled file"),
          mime_type: typeof file.mimeType === "string" ? file.mimeType : null,
          web_view_link: typeof file.webViewLink === "string" ? file.webViewLink : null,
          modified_at: typeof file.modifiedTime === "string" ? file.modifiedTime : null,
          folder_id: folderId,
          content_hash: null,
          provider_revision: typeof file.version === "string" ? file.version : null,
          metadata: {
            parents: file.parents ?? [],
            canDownload:
              (file.capabilities as { canDownload?: boolean } | undefined)?.canDownload ?? false,
            extractionScope:
              file.mimeType === "application/vnd.google-apps.spreadsheet"
                ? "first-sheet-only"
                : "document",
          },
        });
      }
      if (data.incompleteSearch) break;
      if (!data.nextPageToken) {
        listingComplete = true;
        break;
      }
      if (visitedPages.has(data.nextPageToken)) break;
      visitedPages.add(data.nextPageToken);
      pageToken = data.nextPageToken;
    }
    const summary = await indexDriveFolder(supabase, {
      folderId,
      rows,
      listedIds: new Set(rows.map((row) => row.external_id)),
      listingComplete,
      extract: (row) => fetchDriveDocumentText(token, row),
    });
    for (const key of [
      "listed",
      "indexed",
      "unchanged",
      "unsupported",
      "deleted",
      "inaccessible",
      "duplicates",
      "failed",
    ] as const)
      indexSummary[key] += summary[key];
    indexSummary.errors.push(...summary.errors);
    if (!listingComplete)
      indexSummary.errors.push("Drive folder listing incomplete; absent files retained");
    stored += summary.listed;
  }
  // Removing a folder stops future reads; its already-synced documents stay.
  // Report which stored folders left the allowlist so that provenance is
  // explicit in the run receipt instead of silently orphaned.
  const { data: storedFolders } = await supabase
    .from("drive_documents")
    .select("folder_id")
    .not("folder_id", "is", null);
  const staleFolders = staleAllowlistIds(
    (storedFolders ?? []).map((row) => (row as { folder_id: unknown }).folder_id),
    folders,
  );
  await recordSourceRun(supabase, {
    sourceKey: "google_drive",
    status: indexSummary.errors.length || indexSummary.inaccessible ? "partial" : "success",
    summary: {
      indexing: indexSummary,
      stored,
      folders: folders.length,
      rejected: rejected.length,
      quarantined,
      stale_folders: staleFolders.length,
    },
  });
  return {
    indexing: indexSummary,
    stored,
    folders: folders.length,
    rejected: rejected.length,
    quarantined,
    staleFolders,
  };
}

/** Only decoded text formats are accepted. CSV export covers the first sheet. */
async function fetchDriveDocumentText(
  token: string,
  row: DriveDocumentRow,
): Promise<string | null> {
  if (row.metadata?.canDownload === false) return null;
  const native = row.mime_type?.startsWith("application/vnd.google-apps.");
  const mime =
    row.mime_type === "application/vnd.google-apps.spreadsheet" ? "text/csv" : "text/plain";
  const url = native
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.external_id)}/export?mimeType=${encodeURIComponent(mime)}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.external_id)}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Drive text read failed (${response.status})`);
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2_000_000) throw new Error("Drive text exceeds the 2 MB indexing limit");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
  }
}

export async function sendGmailReply(
  supabase: SupabaseClient,
  input: { conversationId: string; body: string; actorEmail: string; idempotencyKey?: string },
) {
  const body = input.body.trim();
  if (!body) throw new Error("Reply body is required");
  if (input.idempotencyKey && input.idempotencyKey.length > 256)
    throw new Error("Email idempotency keys must be 256 characters or fewer");
  if (input.idempotencyKey) {
    const { data: existing, error } = await supabase
      .from("messages")
      .select("id,provider_id,status,conversation_id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existing?.status === "sent")
      return {
        providerId: existing.provider_id,
        messageId: existing.id,
        conversationId: existing.conversation_id,
      };
    if (existing)
      throw new Error("This email is already being processed; review its receipt before retrying");
  }

  const { token, connection } = await getGoogleAccessToken(supabase);
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,external_id,subject,contact_id,opportunity_id,metadata")
    .eq("id", input.conversationId)
    .eq("channel", "gmail")
    .maybeSingle();
  if (conversationError) throw new Error(conversationError.message);
  if (!conversation?.external_id) throw new Error("Gmail conversation not found");
  const { data: latest, error: messageError } = await supabase
    .from("messages")
    .select("external_id,sender_email,recipient_emails,subject,references_header,metadata")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (messageError) throw new Error(messageError.message);
  if (!latest) throw new Error("This conversation has no message to reply to");
  const ownerEmail = normalizeEmail(connection.account_email as string);
  const metadata = (conversation.metadata ?? {}) as { contact_email?: string };
  const recipient = normalizeEmail(metadata.contact_email || latest.sender_email);
  if (!ownerEmail || !recipient) throw new Error("Could not identify the Gmail reply recipient");
  const latestMetadata = (latest.metadata ?? {}) as { rfc_message_id?: string };
  const prepared = prepareGmailReply({
    ownerEmail,
    recipient,
    conversationSubject: conversation.subject,
    latest: { ...latest, rfc_message_id: latestMetadata.rfc_message_id ?? null },
    body,
  });

  const claimId = crypto.randomUUID();
  const { error: claimError } = await supabase.from("messages").insert({
    id: claimId,
    conversation_id: conversation.id,
    idempotency_key: input.idempotencyKey || null,
    direction: "outbound",
    sender_email: ownerEmail,
    recipient_emails: [prepared.recipient],
    subject: prepared.subject,
    body_text: body,
    status: "processing",
    in_reply_to: prepared.inReplyTo,
    references_header: prepared.references,
    metadata: { source: "gmail_reply", gmail_thread_id: conversation.external_id },
  });
  if (claimError)
    throw new Error(
      claimError.code === "23505" ? "This email has already been claimed" : claimError.message,
    );

  let sent: { id: string; threadId: string; labelIds?: string[] };
  try {
    await assertActiveTenantExecution(supabase, "gmail-send");
    sent = await googleFetch<{ id: string; threadId: string; labelIds?: string[] }>(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: Buffer.from(prepared.raw).toString("base64url"),
          threadId: conversation.external_id,
        }),
      },
    );
  } catch (error) {
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: {
          source: "gmail_reply",
          error: error instanceof Error ? error.message : "Gmail send failed",
        },
      })
      .eq("id", claimId);
    throw error;
  }

  const now = new Date().toISOString();
  const message = await recordGmailSendReceipt(supabase, {
    conversationId: conversation.id,
    claimId,
    idempotencyKey: input.idempotencyKey || null,
    ownerEmail,
    recipient: prepared.recipient,
    subject: prepared.subject,
    body,
    sentId: sent.id,
    sentThreadId: sent.threadId,
    sentLabelIds: sent.labelIds ?? [],
    inReplyTo: prepared.inReplyTo,
    references: prepared.references,
    sentAt: now,
  });

  await Promise.all([
    supabase
      .from("conversations")
      .update({ status: "waiting", unread_count: 0, last_message_at: now })
      .eq("id", conversation.id),
    recordActivity(supabase, {
      activityType: "email_sent",
      title: prepared.subject,
      summary: `Gmail reply sent to ${prepared.recipient}`,
      contactId: conversation.contact_id,
      opportunityId: conversation.opportunity_id,
      conversationId: conversation.id,
      source: "admin",
      actorEmail: input.actorEmail,
      externalId: sent.id,
      occurredAt: now,
    }),
    recordAudit(supabase, {
      actorEmail: input.actorEmail,
      action: "email.sent",
      entityType: "conversation",
      entityId: conversation.id,
      source: "admin",
      metadata: {
        channel: "gmail",
        provider_id: sent.id,
        message_id: message.id,
        recipient: prepared.recipient,
        in_reply_to: prepared.inReplyTo,
      },
    }),
  ]);
  return { providerId: sent.id, messageId: message.id, conversationId: conversation.id };
}

const GMAIL_DRAFTS_URL = "https://mail.google.com/mail/u/0/#drafts";

function gmailDraftIdempotencyKey(input: {
  workItem?: WorkItem;
  conversationId: string;
  to: string;
  subject: string;
  body: string;
}) {
  const logicalKey = [
    input.workItem ? `work:${input.workItem.id}` : "gmail-draft",
    input.conversationId,
    normalizeEmail(input.to),
    input.subject.trim(),
    input.body.trim(),
  ].join("\n");
  return `gmail-draft:${createHash("sha256").update(logicalKey).digest("hex")}`;
}

/** Save an approved reply in Gmail Drafts. This function never calls a send endpoint. */
export async function createGmailDraft(
  supabase: SupabaseClient,
  input: {
    actionId: string;
    actorEmail: string;
    conversationId: string;
    opportunityId: string;
    contactId: string;
    to: string;
    subject: string;
    body: string;
    workItem?: WorkItem;
  },
) {
  const target = await assertGmailDraftTarget(supabase, input, input.workItem);
  const tenantId = input.workItem?.tenant_id ?? tenantIdForDatabase(supabase);
  if (!tenantId) throw new Error("Gmail draft requires an explicit workspace");
  const { token, connection } = await getGoogleAccessToken(supabase);
  if (!((connection.scopes as string[] | undefined) ?? []).includes(GOOGLE_GMAIL_DRAFT_SCOPE))
    throw new Error(
      "Gmail draft access is missing. Open Setup → Gmail draft access and grant the optional Google permission.",
    );

  const { data: latest, error: latestError } = await supabase
    .from("messages")
    .select("external_id,subject,references_header,metadata")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", input.conversationId)
    .not("external_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error(latestError.message);
  if (!latest?.external_id) throw new Error("This Gmail thread has no message to reply to");
  const latestMetadata = (latest.metadata ?? {}) as { rfc_message_id?: string };
  const logicalIdempotencyKey = gmailDraftIdempotencyKey({
    workItem: input.workItem,
    conversationId: input.conversationId,
    to: target.to,
    subject: input.subject,
    body: input.body,
  });
  const ownerEmail = normalizeEmail(connection.account_email as string);
  if (!ownerEmail) throw new Error("Google account email is unavailable; reconnect Workspace");
  const ownerDomain = ownerEmail.split("@").at(-1);
  if (!ownerDomain || !/^[a-z0-9.-]+$/i.test(ownerDomain))
    throw new Error("Google account email has no valid domain; reconnect Workspace");
  const rfcMessageId = `<${createHash("sha256").update(logicalIdempotencyKey).digest("hex")}@${ownerDomain}>`;
  const prepared = prepareGmailReply({
    ownerEmail,
    recipient: target.to,
    conversationSubject: target.conversation.subject,
    latest: { ...latest, rfc_message_id: latestMetadata.rfc_message_id ?? null },
    body: target.body,
    messageId: rfcMessageId,
  });
  if (prepared.subject !== target.subject)
    throw new Error(
      "The Gmail thread subject changed. Refresh the conversation and review a new draft.",
    );

  let claim: {
    id: string;
    status: string;
    external_id: string | null;
    provider_id: string | null;
    metadata: Record<string, unknown>;
  } | null = null;
  const { data: prior, error: priorError } = await supabase
    .from("messages")
    .select("id,status,external_id,provider_id,metadata")
    .eq("tenant_id", tenantId)
    .eq("idempotency_key", logicalIdempotencyKey)
    .maybeSingle();
  if (priorError) throw new Error(priorError.message);
  claim = prior as typeof claim;
  const receipt = (row: typeof claim, recovered = false) => ({
    status: "drafted" as const,
    draftId: typeof row?.metadata?.gmail_draft_id === "string" ? row.metadata.gmail_draft_id : null,
    messageId: row?.external_id ?? row?.provider_id ?? null,
    rfcMessageId,
    threadId: target.conversation.external_id,
    to: target.to,
    subject: prepared.subject,
    gmailUrl: GMAIL_DRAFTS_URL,
    sent: false as const,
    recovered,
  });

  const adoptFoundDraft = async () => {
    const q = new URLSearchParams({
      q: `in:drafts rfc822msgid:${rfcMessageId.slice(1, -1)}`,
      maxResults: "5",
    });
    const found = await googleFetch<{ messages?: Array<{ id: string; threadId?: string }> }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    for (const candidate of found.messages ?? []) {
      const detail = await googleFetch<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(candidate.id)}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (
        detail.labelIds?.includes("DRAFT") &&
        parseRfcMessageId(header(detail, "Message-ID")) === rfcMessageId &&
        detail.threadId === target.conversation.external_id &&
        normalizeEmail(parseAddress(header(detail, "To")) ?? "") === target.to &&
        header(detail, "Subject") === prepared.subject &&
        decodeBody(detail.payload).replace(/\r\n/g, "\n").trim() ===
          target.body.replace(/\r\n/g, "\n").trim()
      ) {
        const metadata = {
          ...(claim?.metadata ?? {}),
          source: "gmail_draft",
          gmail_draft_id: null,
          gmail_thread_id: detail.threadId,
          rfc_message_id: rfcMessageId,
          work_item_id: input.workItem?.id ?? null,
          action_id: input.actionId,
        };
        const { error } = await supabase
          .from("messages")
          .update({
            external_id: detail.id,
            provider_id: detail.id,
            status: "drafted",
            metadata,
          })
          .eq("tenant_id", tenantId)
          .eq("id", claim!.id);
        if (error) throw new Error(error.message);
        claim = {
          ...claim!,
          external_id: detail.id,
          provider_id: detail.id,
          status: "drafted",
          metadata,
        };
        return receipt(claim, true);
      }
    }
    return null;
  };

  if (claim?.status === "drafted") return receipt(claim, true);
  if (claim && ["processing", "uncertain"].includes(claim.status)) {
    try {
      const reconciled = await adoptFoundDraft();
      if (reconciled) return reconciled;
    } catch {
      // A failed reconciliation read is still uncertain; it never authorizes another create.
    }
    throw new Error(
      "Gmail may already have saved this draft. No second draft was created. Check Gmail Drafts for the exact recipient and subject before asking for another attempt.",
    );
  }

  const messageRow = {
    tenant_id: tenantId,
    conversation_id: input.conversationId,
    external_id: null,
    provider_id: null,
    idempotency_key: logicalIdempotencyKey,
    direction: "outbound",
    sender_email: ownerEmail,
    recipient_emails: [prepared.recipient],
    subject: prepared.subject,
    body_text: target.body,
    status: "processing",
    in_reply_to: prepared.inReplyTo,
    references_header: prepared.references,
    metadata: {
      source: "gmail_draft",
      gmail_thread_id: target.conversation.external_id,
      rfc_message_id: rfcMessageId,
      work_item_id: input.workItem?.id ?? null,
      action_id: input.actionId,
    },
  };
  if (claim?.status === "failed") {
    const { error } = await supabase
      .from("messages")
      .update(messageRow)
      .eq("tenant_id", tenantId)
      .eq("id", claim.id)
      .eq("status", "failed");
    if (error) throw new Error(error.message);
    claim = { ...claim, status: "processing", metadata: messageRow.metadata };
  } else if (!claim) {
    const { data, error } = await supabase
      .from("messages")
      .insert(messageRow)
      .select("id,status,external_id,provider_id,metadata")
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error(
          "A matching Gmail draft attempt is already being reconciled. Check Gmail Drafts before retrying.",
        );
      throw new Error(error.message);
    }
    claim = data as typeof claim;
  }

  let created: { id: string; message?: { id?: string; threadId?: string } };
  try {
    await assertActiveTenantExecution(supabase, "gmail-draft");
    created = await googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          raw: Buffer.from(prepared.raw).toString("base64url"),
          threadId: target.conversation.external_id,
        },
      }),
    });
  } catch (error) {
    const status = error instanceof GoogleApiError ? error.status : null;
    const uncertain = status === null || status >= 500;
    await supabase
      .from("messages")
      .update({
        status: uncertain ? "uncertain" : "failed",
        metadata: {
          ...messageRow.metadata,
          error: safeErrorMessage(error),
          outcome_uncertain: uncertain,
        },
      })
      .eq("tenant_id", tenantId)
      .eq("id", claim!.id);
    if (uncertain)
      throw new Error(
        "Gmail did not confirm whether the draft was saved. No automatic retry was made; check Gmail Drafts before another attempt.",
      );
    throw error;
  }

  const providerMessageId = created.message?.id;
  const providerThreadId = created.message?.threadId ?? target.conversation.external_id;
  if (!created.id || !providerMessageId || providerThreadId !== target.conversation.external_id) {
    await supabase
      .from("messages")
      .update({
        status: "uncertain",
        metadata: { ...messageRow.metadata, outcome_uncertain: true },
      })
      .eq("tenant_id", tenantId)
      .eq("id", claim!.id);
    throw new Error(
      "Gmail accepted an incomplete draft receipt. Check Gmail Drafts before another attempt.",
    );
  }
  const metadata = {
    ...messageRow.metadata,
    gmail_draft_id: created.id,
    gmail_message_id: providerMessageId,
    gmail_thread_id: providerThreadId,
    rfc_message_id: rfcMessageId,
    saved_at: new Date().toISOString(),
    sent: false,
  };
  const { data: savedRow, error: saveError } = await supabase
    .from("messages")
    .update({
      external_id: providerMessageId,
      provider_id: providerMessageId,
      status: "drafted",
      metadata,
    })
    .eq("tenant_id", tenantId)
    .eq("id", claim!.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (saveError || !savedRow) {
    throw new Error(
      "Gmail saved the draft, but its local receipt could not be confirmed. Check Gmail Drafts before another attempt.",
    );
  }
  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "gmail.draft_saved",
    entityType: "conversation",
    entityId: input.conversationId,
    source: "admin",
    metadata: {
      provider_draft_id: created.id,
      provider_message_id: providerMessageId,
      provider_thread_id: providerThreadId,
      recipient: prepared.recipient,
      subject: prepared.subject,
      work_item_id: input.workItem?.id ?? null,
      action_id: input.actionId,
      sent: false,
    },
  }).catch(() => {
    // Gmail and the durable message receipt are authoritative once draft
    // creation succeeds; an audit outage must not report the saved draft as
    // failed and invite a duplicate retry.
    console.error("[gmail/draft-audit] saved draft audit receipt could not be written");
  });
  return receipt({
    id: savedRow.id,
    status: "drafted",
    external_id: providerMessageId,
    provider_id: providerMessageId,
    metadata,
  });
}

/**
 * Convergent send receipt for a Gmail reply claim. Upserts on the provider
 * id, then retires the processing claim.
 *
 * A sync racing the send may already have stored this Gmail message; the
 * upsert then heals that row into the sent receipt instead of leaving two
 * canonical rows (or violating the unique index on a blind update). The
 * claim row is deleted after, so a crash between the two still blocks a
 * duplicate send on retry via the idempotency key rather than risking a
 * second external effect. Exported for deterministic replay testing.
 */
export async function recordGmailSendReceipt(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    claimId: string;
    idempotencyKey: string | null;
    ownerEmail: string;
    recipient: string;
    subject: string;
    body: string;
    sentId: string;
    sentThreadId: string;
    sentLabelIds: string[];
    inReplyTo: string | null;
    references: string | null;
    sentAt: string;
  },
): Promise<{ id: string }> {
  const { data: message, error: saveError } = await supabase
    .from("messages")
    .upsert(
      {
        conversation_id: input.conversationId,
        external_id: input.sentId,
        provider_id: input.sentId,
        idempotency_key: input.idempotencyKey,
        direction: "outbound",
        sender_email: input.ownerEmail,
        recipient_emails: [input.recipient],
        subject: input.subject,
        body_text: input.body,
        status: "sent",
        sent_at: input.sentAt,
        in_reply_to: input.inReplyTo,
        references_header: input.references,
        metadata: {
          labels: input.sentLabelIds,
          gmail_thread_id: input.sentThreadId,
          source: "gmail_reply",
        },
      },
      { onConflict: "conversation_id,external_id" },
    )
    .select("id")
    .single();
  if (saveError || !message) {
    throw new Error(
      "Email provider accepted the message but its local receipt could not be recorded; reconcile before retrying",
    );
  }
  await supabase.from("messages").delete().eq("id", input.claimId);
  return { id: (message as { id: string }).id };
}

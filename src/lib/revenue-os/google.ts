import "server-only";
import { tenant } from "@/config/tenant";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "./encryption";
import { normalizeEmail, safeErrorMessage } from "./db";
import { recordSourceRun } from "./runs";
import { findCanonicalContactByEmail } from "./identity";
import { stopCampaignMemberships } from "./campaign-stops";
import { planGmailThreadSync, type GmailHistoryPage, type GmailThreadListPage } from "./gmail-sync-plan";
import { recordAudit } from "./audit";
import { recordActivity } from "./activities";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
];

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  return { clientId, clientSecret, redirectUri: `${siteUrl.replace(/\/$/, "")}/api/admin/google/callback` };
}

export function buildGoogleAuthUrl(state: string): string {
  const config = googleConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function googleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error_description?: string; error?: { message?: string } | string }).error_description || (typeof (payload as { error?: unknown }).error === "string" ? (payload as { error: string }).error : (payload as { error?: { message?: string } }).error?.message) || `Google request failed (${response.status})`);
  return payload as T;
}

export async function exchangeGoogleCode(code: string) {
  const config = googleConfig();
  return googleFetch<{ access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
  });
}

export async function saveGoogleConnection(supabase: SupabaseClient, tokens: { access_token: string; refresh_token?: string; expires_in: number; scope: string }) {
  const profile = await googleFetch<{ email: string }>("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const { data: existing } = await supabase.from("integration_connections").select("encrypted_refresh_token,connected_at").eq("provider", "google").maybeSingle();
  if (!tokens.refresh_token && !existing?.encrypted_refresh_token) throw new Error("Google did not return a refresh token. Reconnect and grant offline access.");
  const { error } = await supabase.from("integration_connections").upsert({
    provider: "google",
    account_email: normalizeEmail(profile.email),
    encrypted_access_token: encryptSecret(tokens.access_token),
    encrypted_refresh_token: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing?.encrypted_refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope.split(/\s+/).filter(Boolean),
    status: "connected",
    connected_at: existing?.connected_at || new Date().toISOString(),
    last_error: null,
  }, { onConflict: "provider" });
  if (error) throw new Error(error.message);
  return profile;
}

export async function getGoogleAccessToken(supabase: SupabaseClient): Promise<{ token: string; connection: Record<string, unknown> }> {
  const { data: connection, error } = await supabase.from("integration_connections").select("*").eq("provider", "google").eq("status", "connected").maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection?.encrypted_refresh_token) throw new Error("Google Workspace is not connected");
  if (connection.encrypted_access_token && connection.token_expires_at && new Date(connection.token_expires_at).getTime() > Date.now() + 60000) {
    return { token: decryptSecret(connection.encrypted_access_token), connection };
  }

  const config = googleConfig();
  try {
    const refreshed = await googleFetch<{ access_token: string; expires_in: number; scope?: string }>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decryptSecret(connection.encrypted_refresh_token), grant_type: "refresh_token" }),
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
    await supabase.from("integration_connections").update({ status: /invalid_grant/i.test(message) ? "revoked" : "degraded", last_error: message }).eq("id", connection.id);
    throw error;
  }
}

interface GmailHeader { name: string; value: string }
interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
interface GmailMessage { id: string; threadId: string; labelIds?: string[]; internalDate?: string; snippet?: string; payload?: GmailPart & { headers?: GmailHeader[] } }
interface GmailProfile { emailAddress: string; historyId: string }

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || null;
}

function decodeBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
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

export async function syncGmail(supabase: SupabaseClient, maxThreads = 75) {
  const { token, connection } = await getGoogleAccessToken(supabase);
  const profile = await googleFetch<GmailProfile>("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token}` } });
  const settings = (connection.settings ?? {}) as { gmail_history_id?: string };
  let history: GmailHistoryPage | null = null;
  let list: GmailThreadListPage | null = null;
  let cursorExpired = false;
  if (settings.gmail_history_id) {
    try {
      const params = new URLSearchParams({ startHistoryId: settings.gmail_history_id, historyTypes: "messageAdded", maxResults: String(Math.min(100, maxThreads)) });
      history = await googleFetch<GmailHistoryPage>(`https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      // Gmail expires old cursors. Fall back to the bounded reconciliation path
      // and never advance the cursor while that reconciliation is incomplete.
      if (!/history|not found|404/i.test(safeErrorMessage(error))) throw error;
      cursorExpired = true;
    }
  }
  if (!history) {
    list = await googleFetch<GmailThreadListPage>(`https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${Math.min(100, maxThreads)}&q=${encodeURIComponent("newer_than:30d")}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  const plan = planGmailThreadSync({ cursor: settings.gmail_history_id, history, list, cursorExpired, maxThreads });
  const threadIds = plan.threadIds;
  let stored = 0;
  let failed = 0;
  const ownerEmail = normalizeEmail(connection.account_email as string);
  for (const threadId of threadIds) {
    try {
      const thread = await googleFetch<{ id: string; historyId?: string; messages?: GmailMessage[] }>(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
      const messages = thread.messages ?? [];
      if (!messages.length) continue;
      const latest = messages.at(-1)!;
      const subject = header(latest, "Subject") || "(No subject)";
      const externalEmails = messages.flatMap((message) => [parseAddress(header(message, "From")), parseAddress(header(message, "To"))]).filter((email): email is string => Boolean(email && email !== ownerEmail));
      const contactEmail = externalEmails[0] || null;
      let contactId: string | null = null;
      let opportunityId: string | null = null;
      if (contactEmail) {
        const contact = await findCanonicalContactByEmail(supabase, contactEmail);
        contactId = contact?.id ?? null;
        if (contactId) {
          const { data: opportunity } = await supabase.from("opportunities").select("id").eq("contact_id", contactId).not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(1).maybeSingle();
          opportunityId = opportunity?.id ?? null;
        }
      }
      const unread = messages.filter((message) => message.labelIds?.includes("UNREAD") && parseAddress(header(message, "From")) !== ownerEmail).length;
      const lastAt = latest.internalDate ? new Date(Number(latest.internalDate)).toISOString() : new Date().toISOString();
      const { data: conversation, error: conversationError } = await supabase.from("conversations").upsert({
        channel: "gmail",
        external_id: thread.id,
        subject,
        contact_id: contactId,
        opportunity_id: opportunityId,
        status: unread ? "open" : "waiting",
        unread_count: unread,
        last_message_at: lastAt,
        metadata: { history_id: thread.historyId ?? null, contact_email: contactEmail },
      }, { onConflict: "channel,external_id" }).select("id").single();
      if (conversationError) throw new Error(conversationError.message);
      const rows = messages.map((message) => {
        const from = parseAddress(header(message, "From"));
        const to = parseAddress(header(message, "To"));
        return {
          conversation_id: conversation.id,
          external_id: message.id,
          direction: from === ownerEmail ? "outbound" : "inbound",
          sender_email: from,
          recipient_emails: to ? [to] : [],
          subject: header(message, "Subject"),
          body_text: decodeBody(message.payload) || message.snippet || "",
          status: message.labelIds?.includes("UNREAD") ? "unread" : "received",
          in_reply_to: header(message, "In-Reply-To"),
          references_header: header(message, "References"),
          sent_at: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
          received_at: from === ownerEmail ? null : message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
          metadata: { labels: message.labelIds ?? [], gmail_thread_id: thread.id },
        };
      });
      const inboundRows = rows.filter((row) => row.direction === "inbound");
      const { data: priorInbound, error: priorError } = inboundRows.length
        ? await supabase.from("messages").select("external_id").eq("conversation_id", conversation.id).in("external_id", inboundRows.map((row) => row.external_id))
        : { data: [], error: null };
      if (priorError) throw new Error(priorError.message);
      const { error: messageError } = await supabase.from("messages").upsert(rows, { onConflict: "conversation_id,external_id", ignoreDuplicates: false });
      if (messageError) throw new Error(messageError.message);
      const priorIds = new Set((priorInbound ?? []).map((message) => message.external_id));
      const newInbound = inboundRows.filter((row) => !priorIds.has(row.external_id));
      if (contactId && newInbound.length) {
        const reply = newInbound[0]!;
        await stopCampaignMemberships(supabase, { contactId, reason: "gmail_reply", source: "automation", sourceReceiptId: `gmail:${thread.id}:${reply.external_id}` });
      }
      stored++;
    } catch (error) {
      failed++;
      console.error("[google/gmail-sync]", error);
    }
  }
  const status = failed && stored ? "partial" : failed ? "failed" : "success";
  const cursorAdvanced = status === "success" && plan.cursorAdvanceSafe;
  const nextSettings = cursorAdvanced ? { ...settings, gmail_history_id: profile.historyId } : settings;
  await recordSourceRun(supabase, { sourceKey: "gmail", status, summary: { mode: plan.mode, listed: threadIds.length, stored, failed, deferred: Number(plan.deferred), deferred_reason: plan.deferReason, cursor_advanced: cursorAdvanced, cursor_present: Boolean(settings.gmail_history_id) } });
  await supabase.from("integration_connections").update({ settings: nextSettings, last_sync_at: new Date().toISOString(), last_success_at: stored || !failed ? new Date().toISOString() : undefined, last_error: failed ? `${failed} Gmail threads failed` : plan.deferred ? "Gmail backlog remains; cursor intentionally not advanced" : null, status: failed && !stored ? "degraded" : "connected" }).eq("provider", "google");
  return { mode: plan.mode, listed: threadIds.length, stored, failed, deferred: Number(plan.deferred), cursorAdvanced };
}

export async function syncCalendar(supabase: SupabaseClient) {
  const { token } = await getGoogleAccessToken(supabase);
  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 120 * 86400000).toISOString();
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "500" });
  try {
    const data = await googleFetch<{ items?: Array<Record<string, unknown>> }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const externalIds = (data.items ?? []).map((event) => String(event.id)).filter(Boolean);
    const { data: existingEvents, error: existingError } = externalIds.length
      ? await supabase.from("calendar_events").select("id,external_id,metadata").eq("provider", "google").in("external_id", externalIds)
      : { data: [], error: null };
    if (existingError) throw new Error(existingError.message);
    const existingByExternalId = new Map((existingEvents ?? []).map((event) => [event.external_id, event]));
    const rows = await Promise.all((data.items ?? []).map(async (event) => {
      const start = event.start as { dateTime?: string; date?: string } | undefined;
      const end = event.end as { dateTime?: string; date?: string } | undefined;
      const attendees = Array.isArray(event.attendees) ? event.attendees : [];
      const attendeeEmails = attendees.map((attendee) => attendee && typeof attendee === "object" && typeof (attendee as { email?: unknown }).email === "string" ? normalizeEmail((attendee as { email: string }).email) : null).filter((email): email is string => Boolean(email));
      const matches = await Promise.all(attendeeEmails.map((email) => findCanonicalContactByEmail(supabase, email)));
      const contactMatches = new Map(matches.filter((match): match is NonNullable<typeof match> => Boolean(match)).map((match) => [match.id, match]));
      const contact = contactMatches.size === 1 ? [...contactMatches.values()][0]! : null;
      let opportunityId: string | null = null;
      if (contact) {
        const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").select("id").eq("contact_id", contact.id).not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (opportunityError) throw new Error(opportunityError.message);
        opportunityId = opportunity?.id ?? null;
      }
      const externalId = String(event.id);
      const existingMetadata = (existingByExternalId.get(externalId)?.metadata ?? {}) as Record<string, unknown>;
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
        metadata: { organizer: event.organizer ?? null, hangout_link: event.hangoutLink ?? null, attendee_emails: attendeeEmails, identity_resolution: contactMatches.size > 1 ? "ambiguous" : contact ? "matched" : "unmatched", campaign_stop_receipt: existingMetadata.campaign_stop_receipt ?? null },
        synced_at: new Date().toISOString(),
      };
    }));
    const { error } = rows.length ? await supabase.from("calendar_events").upsert(rows, { onConflict: "provider,external_id" }) : { error: null };
    if (error) throw new Error(error.message);
    const now = Date.now();
    for (const row of rows) {
      const metadata = row.metadata as { campaign_stop_receipt?: string | null };
      const upcomingConfirmedMeeting = row.contact_id && row.status === "confirmed" && row.start_at && new Date(row.start_at).getTime() >= now;
      if (upcomingConfirmedMeeting && !metadata.campaign_stop_receipt) {
        const receipt = `google-calendar:${row.external_id}`;
        await stopCampaignMemberships(supabase, { contactId: row.contact_id!, reason: "calendar_booking", source: "automation", sourceReceiptId: receipt });
        await supabase.from("calendar_events").update({ metadata: { ...metadata, campaign_stop_receipt: receipt } }).eq("provider", "google").eq("external_id", row.external_id);
      }
    }
    const matched = rows.filter((row) => row.contact_id).length;
    const ambiguous = rows.filter((row) => (row.metadata as { identity_resolution?: string }).identity_resolution === "ambiguous").length;
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
    await recordSourceRun(supabase, { sourceKey: "google_calendar", status: "success", summary: { stored: rows.length } });
    return { stored: rows.length };
  } catch (error) {
    await recordSourceRun(supabase, { sourceKey: "google_calendar", status: "failed", error: safeErrorMessage(error) });
    throw error;
  }
}

export async function syncDrive(supabase: SupabaseClient) {
  const { token, connection } = await getGoogleAccessToken(supabase);
  const settings = (connection.settings || {}) as { drive_folder_ids?: string[] };
  const folders = (settings.drive_folder_ids ?? []).filter(Boolean).slice(0, 10);
  if (!folders.length) {
    await recordSourceRun(supabase, { sourceKey: "google_drive", status: "not_configured", summary: { reason: "No folders selected" } });
    return { stored: 0, notConfigured: true };
  }
  let stored = 0;
  for (const folderId of folders) {
    const params = new URLSearchParams({ q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`, fields: "files(id,name,mimeType,webViewLink,modifiedTime,md5Checksum,parents)", pageSize: "200", orderBy: "modifiedTime desc" });
    const data = await googleFetch<{ files?: Array<Record<string, unknown>> }>(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const rows = (data.files ?? []).map((file) => ({
      provider: "google",
      external_id: String(file.id),
      name: String(file.name || "Untitled file"),
      mime_type: typeof file.mimeType === "string" ? file.mimeType : null,
      web_view_link: typeof file.webViewLink === "string" ? file.webViewLink : null,
      modified_at: typeof file.modifiedTime === "string" ? file.modifiedTime : null,
      folder_id: folderId,
      content_hash: typeof file.md5Checksum === "string" ? file.md5Checksum : null,
      metadata: { parents: file.parents ?? [] },
      synced_at: new Date().toISOString(),
    }));
    const { error } = rows.length ? await supabase.from("drive_documents").upsert(rows, { onConflict: "provider,external_id" }) : { error: null };
    if (error) throw new Error(error.message);
    stored += rows.length;
  }
  await recordSourceRun(supabase, { sourceKey: "google_drive", status: "success", summary: { stored, folders: folders.length } });
  return { stored, folders: folders.length };
}

export async function sendGmailReply(supabase: SupabaseClient, input: { conversationId: string; body: string; actorEmail: string }) {
  const body = input.body.trim();
  if (!body) throw new Error("Reply body is required");
  const { token, connection } = await getGoogleAccessToken(supabase);
  const { data: conversation, error: conversationError } = await supabase.from("conversations").select("id,external_id,subject,contact_id,opportunity_id,metadata").eq("id", input.conversationId).eq("channel", "gmail").maybeSingle();
  if (conversationError) throw new Error(conversationError.message);
  if (!conversation?.external_id) throw new Error("Gmail conversation not found");
  const { data: latest, error: messageError } = await supabase.from("messages").select("external_id,sender_email,recipient_emails,subject,references_header").eq("conversation_id", input.conversationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (messageError) throw new Error(messageError.message);
  if (!latest) throw new Error("This conversation has no message to reply to");
  const ownerEmail = normalizeEmail(connection.account_email as string);
  const metadata = (conversation.metadata ?? {}) as { contact_email?: string };
  const recipient = normalizeEmail(metadata.contact_email || latest.sender_email);
  if (!ownerEmail || !recipient || recipient === ownerEmail) throw new Error("Could not identify the Gmail reply recipient");
  const subject = /^re:/i.test(conversation.subject || "") ? conversation.subject : `Re: ${conversation.subject || latest.subject || "Your message"}`;
  const references = [latest.references_header, latest.external_id ? `<${latest.external_id}>` : null].filter(Boolean).join(" ");
  const raw = [
    `From: ${ownerEmail}`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    latest.external_id ? `In-Reply-To: <${latest.external_id}>` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].filter((line): line is string => line !== null).join("\r\n");
  const sent = await googleFetch<{ id: string; threadId: string; labelIds?: string[] }>("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), threadId: conversation.external_id }),
  });
  const now = new Date().toISOString();
  const { data: message, error: saveError } = await supabase.from("messages").upsert({
    conversation_id: conversation.id,
    external_id: sent.id,
    provider_id: sent.id,
    direction: "outbound",
    sender_email: ownerEmail,
    recipient_emails: [recipient],
    subject,
    body_text: body,
    status: "sent",
    in_reply_to: latest.external_id,
    references_header: references || null,
    sent_at: now,
    metadata: { labels: sent.labelIds ?? [], gmail_thread_id: sent.threadId },
  }, { onConflict: "conversation_id,external_id" }).select("id").single();
  if (saveError) console.error("[google/gmail-send] sent but local receipt failed", saveError.message);
  await Promise.all([
    supabase.from("conversations").update({ status: "waiting", unread_count: 0, last_message_at: now }).eq("id", conversation.id),
    recordActivity(supabase, {
      activityType: "email_sent",
      title: subject,
      summary: `Gmail reply sent to ${recipient}`,
      contactId: conversation.contact_id,
      opportunityId: conversation.opportunity_id,
      conversationId: conversation.id,
      source: "admin",
      actorEmail: input.actorEmail,
      externalId: sent.id,
      occurredAt: now,
    }),
  ]);
  return { providerId: sent.id, messageId: message?.id ?? null };
}

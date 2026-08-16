import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptSecret } from "./encryption";
import { normalizeEmail, safeErrorMessage } from "./db";
import { recordSourceRun } from "./runs";

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
  const list = await googleFetch<{ threads?: Array<{ id: string }>; resultSizeEstimate?: number }>(`https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${Math.min(100, maxThreads)}&q=${encodeURIComponent("newer_than:30d")}`, { headers: { Authorization: `Bearer ${token}` } });
  const threadIds = (list.threads ?? []).map((thread) => thread.id).reverse();
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
        const { data: contact } = await supabase.from("contacts").select("id").ilike("primary_email", contactEmail).maybeSingle();
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
      const { error: messageError } = await supabase.from("messages").upsert(rows, { onConflict: "conversation_id,external_id", ignoreDuplicates: false });
      if (messageError) throw new Error(messageError.message);
      if (contactEmail && messages.some((message) => parseAddress(header(message, "From")) === contactEmail)) {
        await supabase.from("campaign_members").update({ status: "replied", stop_reason: "gmail_reply", next_send_at: null }).eq("email", contactEmail).in("status", ["queued", "active"]);
      }
      stored++;
    } catch (error) {
      failed++;
      console.error("[google/gmail-sync]", error);
    }
  }
  const status = failed && stored ? "partial" : failed ? "failed" : "success";
  await recordSourceRun(supabase, { sourceKey: "gmail", status, summary: { listed: threadIds.length, stored, failed, deferred: Math.max(0, Number(list.resultSizeEstimate || 0) - threadIds.length) } });
  await supabase.from("integration_connections").update({ last_sync_at: new Date().toISOString(), last_success_at: stored || !failed ? new Date().toISOString() : undefined, last_error: failed ? `${failed} Gmail threads failed` : null, status: failed && !stored ? "degraded" : "connected" }).eq("provider", "google");
  return { listed: threadIds.length, stored, failed, deferred: Math.max(0, Number(list.resultSizeEstimate || 0) - threadIds.length) };
}

export async function syncCalendar(supabase: SupabaseClient) {
  const { token } = await getGoogleAccessToken(supabase);
  const timeMin = new Date(Date.now() - 30 * 86400000).toISOString();
  const timeMax = new Date(Date.now() + 120 * 86400000).toISOString();
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "500" });
  try {
    const data = await googleFetch<{ items?: Array<Record<string, unknown>> }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const rows = (data.items ?? []).map((event) => {
      const start = event.start as { dateTime?: string; date?: string } | undefined;
      const end = event.end as { dateTime?: string; date?: string } | undefined;
      return {
        provider: "google",
        external_id: String(event.id),
        calendar_id: "primary",
        title: String(event.summary || "Untitled event"),
        description: typeof event.description === "string" ? event.description : null,
        location: typeof event.location === "string" ? event.location : null,
        start_at: start?.dateTime || (start?.date ? `${start.date}T00:00:00Z` : null),
        end_at: end?.dateTime || (end?.date ? `${end.date}T00:00:00Z` : null),
        all_day: Boolean(start?.date && !start.dateTime),
        status: typeof event.status === "string" ? event.status : null,
        html_link: typeof event.htmlLink === "string" ? event.htmlLink : null,
        attendees: Array.isArray(event.attendees) ? event.attendees : [],
        metadata: { organizer: event.organizer ?? null, hangout_link: event.hangoutLink ?? null },
        synced_at: new Date().toISOString(),
      };
    });
    const { error } = rows.length ? await supabase.from("calendar_events").upsert(rows, { onConflict: "provider,external_id" }) : { error: null };
    if (error) throw new Error(error.message);
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
    supabase.from("activities").insert({
      activity_type: "email_sent",
      title: subject,
      summary: `Gmail reply sent to ${recipient}`,
      contact_id: conversation.contact_id,
      opportunity_id: conversation.opportunity_id,
      conversation_id: conversation.id,
      source: "admin",
      actor_email: input.actorEmail,
      external_id: sent.id,
      occurred_at: now,
    }),
  ]);
  return { providerId: sent.id, messageId: message?.id ?? null };
}

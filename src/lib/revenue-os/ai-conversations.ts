import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingRevenueSchema } from "./db";

export const AI_CONVERSATION_SCHEMA_VERSION = "revenue-os-ai-conversations.v1";
export const AI_HISTORY_LIMIT = 30;
const MAX_MESSAGE_CHARS = 8_000;

export type AiConversationStatus = "active" | "archived";
export type AiMessageRole = "user" | "assistant";

export interface AiConversationSummary {
  id: string;
  title: string;
  status: AiConversationStatus;
  lastMessageAt: string;
  createdAt: string;
}

export interface AiConversationMessage {
  id: string;
  role: AiMessageRole;
  content: string;
  runId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export class AiConversationSchemaUnavailableError extends Error {
  constructor() {
    super(
      "AI conversation history is not ready. Apply the AI command runtime migration before using this surface.",
    );
    this.name = "AiConversationSchemaUnavailableError";
  }
}

function normalizeMessage(content: string): string {
  const normalized = content.trim();
  if (!normalized) throw new Error("A message is required");
  if (normalized.length > MAX_MESSAGE_CHARS)
    throw new Error(`Messages are limited to ${MAX_MESSAGE_CHARS.toLocaleString()} characters`);
  return normalized;
}

function titleFrom(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 64 ? `${compact.slice(0, 61)}...` : compact;
}

function schemaError(error: unknown): never {
  if (isMissingRevenueSchema(error as { code?: string; message?: string }))
    throw new AiConversationSchemaUnavailableError();
  throw new Error(
    (error as { message?: string } | null)?.message || "AI conversation storage failed",
  );
}

export async function listAiConversations(
  supabase: SupabaseClient,
  actorEmail: string,
  limit = 30,
): Promise<AiConversationSummary[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id,title,status,last_message_at,created_at")
    .eq("actor_email", actorEmail)
    .eq("status", "active")
    .order("last_message_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (error) schemaError(error);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    status: row.status as AiConversationStatus,
    lastMessageAt: String(row.last_message_at),
    createdAt: String(row.created_at),
  }));
}

async function assertConversationOwner(
  supabase: SupabaseClient,
  actorEmail: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id,title,status")
    .eq("id", conversationId)
    .eq("actor_email", actorEmail)
    .maybeSingle();
  if (error) schemaError(error);
  if (!data || data.status !== "active") throw new Error("AI conversation was not found");
  return data;
}

export async function loadAiConversation(
  supabase: SupabaseClient,
  actorEmail: string,
  conversationId: string,
  limit = 100,
): Promise<{ conversation: AiConversationSummary; messages: AiConversationMessage[] }> {
  const conversation = await assertConversationOwner(supabase, actorEmail, conversationId);
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id,role,content,run_id,metadata,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) schemaError(error);
  const messages = (data ?? []).map((row) => ({
    id: String(row.id),
    role: row.role as AiMessageRole,
    content: String(row.content),
    runId: row.run_id ? String(row.run_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at),
  }));
  const latest = messages.at(-1)?.createdAt ?? new Date().toISOString();
  return {
    conversation: {
      id: String(conversation.id),
      title: String(conversation.title),
      status: conversation.status as AiConversationStatus,
      lastMessageAt: latest,
      createdAt: messages[0]?.createdAt ?? latest,
    },
    messages,
  };
}

export async function openAiConversationTurn(
  supabase: SupabaseClient,
  input: {
    actorEmail: string;
    conversationId?: string | null;
    content: string;
    clientMessageId: string;
  },
): Promise<{
  conversationId: string;
  userMessage: AiConversationMessage;
  history: AiConversationMessage[];
}> {
  const content = normalizeMessage(input.content);
  let conversationId = input.conversationId?.trim() || "";
  if (conversationId) {
    await assertConversationOwner(supabase, input.actorEmail, conversationId);
  } else {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        actor_email: input.actorEmail,
        title: titleFrom(content),
        status: "active",
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) schemaError(error);
    conversationId = String(data.id);
  }

  const now = new Date().toISOString();
  const row = {
    conversation_id: conversationId,
    role: "user",
    content,
    client_message_id: input.clientMessageId,
    metadata: { schema: AI_CONVERSATION_SCHEMA_VERSION },
    created_at: now,
  };
  let { data, error } = await supabase
    .from("ai_messages")
    .insert(row)
    .select("id,role,content,run_id,metadata,created_at")
    .single();
  if (error?.code === "23505") {
    const replay = await supabase
      .from("ai_messages")
      .select("id,role,content,run_id,metadata,created_at")
      .eq("conversation_id", conversationId)
      .eq("client_message_id", input.clientMessageId)
      .maybeSingle();
    data = replay.data;
    error = replay.error;
  }
  if (error || !data) schemaError(error);
  await supabase
    .from("ai_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", conversationId)
    .eq("actor_email", input.actorEmail);

  const loaded = await loadAiConversation(
    supabase,
    input.actorEmail,
    conversationId,
    AI_HISTORY_LIMIT,
  );
  return {
    conversationId,
    userMessage: {
      id: String(data.id),
      role: "user",
      content: String(data.content),
      runId: null,
      metadata: data.metadata as Record<string, unknown>,
      createdAt: String(data.created_at),
    },
    history: loaded.messages,
  };
}

export async function appendAiAssistantMessage(
  supabase: SupabaseClient,
  input: {
    actorEmail: string;
    conversationId: string;
    content: string;
    runId: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<AiConversationMessage> {
  await assertConversationOwner(supabase, input.actorEmail, input.conversationId);
  const content = normalizeMessage(input.content);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: input.conversationId,
      role: "assistant",
      content,
      run_id: input.runId,
      metadata: { schema: AI_CONVERSATION_SCHEMA_VERSION, ...(input.metadata ?? {}) },
      created_at: now,
    })
    .select("id,role,content,run_id,metadata,created_at")
    .single();
  if (error || !data) schemaError(error);
  await supabase
    .from("ai_conversations")
    .update({ last_message_at: now, updated_at: now })
    .eq("id", input.conversationId)
    .eq("actor_email", input.actorEmail);
  return {
    id: String(data.id),
    role: "assistant",
    content: String(data.content),
    runId: data.run_id ? String(data.run_id) : null,
    metadata: data.metadata as Record<string, unknown>,
    createdAt: String(data.created_at),
  };
}

export async function archiveAiConversation(
  supabase: SupabaseClient,
  actorEmail: string,
  conversationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("actor_email", actorEmail)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error) schemaError(error);
  if (!data) throw new Error("AI conversation was not found");
}

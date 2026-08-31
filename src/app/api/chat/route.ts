import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterModel, isOpenRouterConfigured, openRouterTextStream, type OpenRouterStreamMetadata } from "@/lib/ai/openrouter";
import { finishAgentRun, recordAgentRunEvent, startAgentRun, traceTextStream } from "@/lib/revenue-os/agent-trace";
import { rateLimit } from "@/lib/rate-limit";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";
import { recordAudit } from "@/lib/revenue-os/audit";
import { isValidEmail } from "@/lib/validation";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { preflightCheck } from "@/lib/chat/guardrails";
import { DEMO_MODE_REPLY, ERROR_REPLY } from "@/lib/chat/fallbacks";
import { handleChatLeadCapture } from "@/lib/chat/lead-capture";
import { enforceHouseStyle } from "@/lib/chat/sanitize";
import type { ChatMessage } from "@/lib/types";
import { AI_CONTEXT_VERSION, boundFounderConversation, buildPublicChatGroundingContract } from "@/lib/revenue-os/ai-context";

// Hobby functions default to a 10s ceiling, and a streamed reply routinely runs
// longer than that. Without this the visitor's answer is cut off mid-sentence.
// 60s is the Hobby maximum.
export const maxDuration = 60;

const MAX_TOKENS = 500;
const TEMPERATURE = 0.6;
const MAX_CONVERSATION_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

function clientKey(request: NextRequest): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  // Light fingerprint: first 32 chars of UA appended to IP.
  return `${ip}::${ua.slice(0, 32)}`;
}

function plainText(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  const { success } = rateLimit(`chat-post:${key}`, 30, 60 * 60 * 1000);
  if (!success) {
    return plainText(
      "You're sending messages too fast. Give it a few seconds and try again.",
      429,
    );
  }

  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_CONVERSATION_MESSAGES) {
      return plainText(
        `Invalid messages: must be an array of 1 to ${MAX_CONVERSATION_MESSAGES} items.`,
        400,
      );
    }

    for (const msg of messages) {
      if (
        typeof msg !== "object" || msg === null ||
        (msg.role !== "user" && msg.role !== "assistant") ||
        typeof msg.content !== "string" ||
        msg.content.length === 0 ||
        msg.content.length > MAX_MESSAGE_CHARS
      ) {
        return plainText(
          `Invalid message: each must have role (user|assistant) and content (string, 1 to ${MAX_MESSAGE_CHARS} chars).`,
          400,
        );
      }
    }

    // Guardrail pre-filter on the latest user message — short-circuits common
    // jailbreaks and off-topic categories without burning tokens.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const redirect = preflightCheck(lastUser.content);
      if (redirect) return plainText(redirect);
    }

    if (!isOpenRouterConfigured()) {
      return plainText(DEMO_MODE_REPLY);
    }
    const boundedConversation = boundFounderConversation(messages);

    // This is the only fully autonomous AI we run that talks to prospects, and
    // until now it wrote no trace at all: nobody could see what it had said to
    // anyone. It joins the same agent_runs ledger as the admin copilot rather
    // than getting a second one.
    const supabase = createBootstrapServiceRoleClient("legacy-public-chat");
    const model = getOpenRouterModel(process.env.OPENROUTER_CHAT_MODEL);
    const run = await startAgentRun(supabase, {
      surface: "public_chat",
      model,
      promptPreview: lastUser?.content,
    });

    let readableStream: ReadableStream<Uint8Array>;
    let streamMetadata: OpenRouterStreamMetadata | null = null;
    try {
      readableStream = await openRouterTextStream({
        model: process.env.OPENROUTER_CHAT_MODEL,
        maxTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${buildPublicChatGroundingContract()}` },
          ...boundedConversation,
        ],
      }, (metadata) => {
        streamMetadata = metadata;
        void recordAgentRunEvent(supabase, run, {
          eventType: "model_response",
          output: {
            provider: "openrouter",
            request_id: metadata.requestId,
            model: metadata.model,
            usage: metadata.usage,
            context_version: AI_CONTEXT_VERSION,
          },
        });
      });
    } catch (error) {
      // The outer catch would return ERROR_REPLY but leave this run `running`
      // forever, which is exactly the stuck-row problem the ledger is meant to
      // make visible.
      await finishAgentRun(supabase, run, "failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // House style is enforced on the way out, because a prompt rule is not a
    // guarantee and an em dash reaching a prospect is the clearest possible tell
    // that nobody wrote this. Tracing wraps the sanitised stream so the ledger
    // records what was actually sent, not what the model first produced.
    return new Response(traceTextStream(enforceHouseStyle(readableStream), supabase, run, () => ({
      inputTokens: streamMetadata?.usage.prompt_tokens,
      outputTokens: streamMetadata?.usage.completion_tokens,
    })), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[chat] POST error:", error);
    return plainText(ERROR_REPLY, 500);
  }
}

// Save chat lead + fire side effects (admin notification, follow-up task,
// admin email, welcome email).
export async function PUT(request: NextRequest) {
  const key = clientKey(request);
  const { success } = rateLimit(`chat-put:${key}`, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const { name, email, conversation, utm } = await request.json();

    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json(
        { error: "Invalid name: must be a string up to 100 characters." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    if (!Array.isArray(conversation) || conversation.length === 0 || conversation.length > 50) {
      return NextResponse.json(
        { error: "Invalid conversation: must be an array of 1 to 50 items." },
        { status: 400 },
      );
    }

    const supabase = createBootstrapServiceRoleClient("legacy-public-chat");

    const { data: inserted, error: insertError } = await supabase
      .from("chat_leads")
      .insert({
        name: name.trim(),
        email: email.trim(),
        conversation,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("[chat] PUT insert error:", insertError?.message);
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }

    // The lead row is already saved. A canonical ingestion failure must not skip
    // the side effects below, which are how anyone finds out the inquiry exists.
    let canonicalOpportunityId: string | undefined;
    try {
      const canonical = await ingestInboundLead(supabase, { name: name.trim(), email: email.trim(), source: "chat", sourceRecordId: inserted.id, summary: (conversation as ChatMessage[]).find((message) => message.role === "user")?.content || "Website chat inquiry", utm });
      canonicalOpportunityId = canonical.opportunity.id;
    } catch (ingestError) {
      const detail = ingestError instanceof Error ? ingestError.message : String(ingestError);
      console.error("[chat] canonical inbound ingestion FAILED (lead preserved):", detail);
      await recordAudit(supabase, {
        actorEmail: "system", action: "inbound.canonical_failed", entityType: "chat_lead",
        entityId: inserted.id, source: "webhook",
        metadata: { inbound_source: "chat", error: detail },
      });
    }

    // Fire side effects. We don't await success of every one — the lead is
    // already saved, and each side effect logs its own outcome.
    const sideEffects = await handleChatLeadCapture(supabase, {
      id: inserted.id,
      name: name.trim(),
      email: email.trim(),
      conversation: conversation as ChatMessage[],
      utm,
      opportunityId: canonicalOpportunityId,
    });

    return NextResponse.json({ success: true, id: inserted.id, sideEffects });
  } catch (error) {
    console.error("[chat] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 },
    );
  }
}

// Note: do NOT add new exports to this Next.js route file. Only the HTTP
// verb handlers + a small allowlist of metadata exports are valid here in
// Next 16+ — anything else triggers a build error. If a test needs the
// redirect string, import it from the module that defines GUARDRAIL_REDIRECT.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation";
import { SYSTEM_PROMPT } from "@/lib/chat/system-prompt";
import { preflightCheck } from "@/lib/chat/guardrails";
import { handleChatLeadCapture } from "@/lib/chat/lead-capture";
import type { ChatMessage } from "@/lib/types";

const CHAT_MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5-20251001";
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return plainText(
        "I'm in demo mode right now. For live help, email john@acceleratewith.us or book a free strategy call at acceleratewith.us/contact.",
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messages.slice(-MAX_CONVERSATION_MESSAGES),
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("[chat] stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("[chat] POST error:", error);
    return plainText(
      "Sorry, I had trouble processing that. Try again, or email john@acceleratewith.us.",
      500,
    );
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

    const supabase = createServiceRoleClient();

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

    // Fire side effects. We don't await success of every one — the lead is
    // already saved, and each side effect logs its own outcome.
    const sideEffects = await handleChatLeadCapture(supabase, {
      id: inserted.id,
      name: name.trim(),
      email: email.trim(),
      conversation: conversation as ChatMessage[],
      utm,
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

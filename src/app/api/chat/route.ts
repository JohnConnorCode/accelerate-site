import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation";

const SYSTEM_PROMPT = `You are the Accelerate AI assistant, a helpful and friendly chatbot for Accelerate (acceleratewith.us), an AI solutions agency for small businesses.

Your role:
- Answer questions about AI, automation, and digital growth for small businesses
- Explain Accelerate's services: AI-powered websites ($2,500), Automations & Workflows ($1,500 + $300/mo), AI Agents ($1,500 + $300/mo)
- Help visitors understand how AI can help their specific business
- Encourage visitors to try the free Solution Generator for a personalized growth plan
- Be helpful, concise, and conversational

Rules:
- Keep responses under 150 words
- Do not make up specific claims about Accelerate's past work
- If asked about pricing, provide the ranges above and suggest getting a custom plan
- If a question is outside your scope, suggest contacting john@acceleratewith.us
- Be warm and professional, not salesy
- Focus on being genuinely helpful`;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 30, 60 * 60 * 1000);
  if (!success) {
    return new Response("Too many requests. Please try again later.", {
      status: 429,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const { messages } = await request.json();

    // Validate messages structure
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      return new Response("Invalid messages: must be an array of 1–20 items.", {
        status: 400,
        headers: { "Content-Type": "text/plain" },
      });
    }

    for (const msg of messages) {
      if (
        typeof msg !== "object" || msg === null ||
        (msg.role !== "user" && msg.role !== "assistant") ||
        typeof msg.content !== "string" ||
        msg.content.length === 0 ||
        msg.content.length > 2000
      ) {
        return new Response(
          "Invalid message: each must have role (user|assistant) and content (string, 1–2000 chars).",
          { status: 400, headers: { "Content-Type": "text/plain" } }
        );
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        "I am currently in demo mode. For live assistance, please email john@acceleratewith.us or try our Solution Generator for a free growth plan!",
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-20),
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      "Sorry, I had trouble processing your request. Please try again.",
      { status: 500, headers: { "Content-Type": "text/plain" } }
    );
  }
}

// Save chat lead
export async function PUT(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`chat-put:${ip}`, 10, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { name, email, conversation } = await request.json();

    // Validate inputs
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json(
        { error: "Invalid name: must be a string up to 100 characters." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (!Array.isArray(conversation) || conversation.length === 0 || conversation.length > 50) {
      return NextResponse.json(
        { error: "Invalid conversation: must be an array of 1–50 items." },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    await supabase.from("chat_leads").insert({
      name: name.trim(),
      email: email.trim(),
      conversation,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save chat lead error:", error);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 }
    );
  }
}

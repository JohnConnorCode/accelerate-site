import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { runRevenueCommandAgent, type CommandPageContext } from "@/lib/revenue-os/ai-agent";
import { AiConversationSchemaUnavailableError, appendAiAssistantMessage, openAiConversationTurn } from "@/lib/revenue-os/ai-conversations";
import type { AiCommandStreamEvent } from "@/lib/revenue-os/ai-stream-contract";

export const maxDuration = 60;

function encode(event: AiCommandStreamEvent): Uint8Array {
  return new TextEncoder().encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

function parsePageContext(value: unknown): CommandPageContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { pathname?: unknown; entity?: { type?: unknown; id?: unknown } };
  if (typeof candidate.pathname !== "string" || !candidate.pathname.startsWith("/admin")) return null;
  const context: CommandPageContext = { pathname: candidate.pathname.slice(0, 240) };
  if (candidate.entity && ["opportunity", "contact", "company"].includes(String(candidate.entity.type)) && typeof candidate.entity.id === "string") {
    context.entity = { type: candidate.entity.type as "opportunity" | "contact" | "company", id: candidate.entity.id };
  }
  return context;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const actorEmail = auth.user.email || "founder";
  if (!rateLimit(`revenue-os-ai-stream:${actorEmail}`, 30, 60 * 60 * 1000).success) {
    return NextResponse.json({ error: "AI command limit reached. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as { conversationId?: unknown; text?: unknown; clientMessageId?: unknown; pageContext?: unknown } | null;
  if (!body || typeof body.text !== "string" || typeof body.clientMessageId !== "string") {
    return NextResponse.json({ error: "Text and clientMessageId are required" }, { status: 400 });
  }
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  const supabase = createServiceRoleClient();
  let turn;
  try {
    turn = await openAiConversationTurn(supabase, { actorEmail, conversationId, content: body.text, clientMessageId: body.clientMessageId.slice(0, 100) });
  } catch (error) {
    const status = error instanceof AiConversationSchemaUnavailableError ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start AI conversation" }, { status });
  }

  const pageContext = parsePageContext(body.pageContext);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const proposalIds: string[] = [];
      const send = (event: AiCommandStreamEvent) => {
        if (closed || request.signal.aborted) return;
        controller.enqueue(encode(event));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      send({ type: "conversation", conversationId: turn.conversationId, userMessageId: turn.userMessage.id });
      try {
        const result = await runRevenueCommandAgent(
          supabase,
          actorEmail,
          turn.history.map((message) => ({ role: message.role, content: message.content })),
          {
            surface: "admin_command_stream",
            conversationId: turn.conversationId,
            pageContext,
            signal: request.signal,
            onRunStarted: (event) => send({ type: "run_started", ...event }),
            onAssistantDelta: (delta) => send({ type: "assistant_delta", delta }),
            onToolStarted: (event) => send({ type: "tool_started", ...event }),
            onToolCompleted: (event) => send({ type: "tool_completed", ...event }),
            onProposalStaged: (proposal) => { proposalIds.push(proposal.id); send({ type: "proposal_staged", proposal }); },
          },
        );
        if (request.signal.aborted) {
          send({ type: "cancelled" });
          close();
          return;
        }
        const assistant = await appendAiAssistantMessage(supabase, {
          actorEmail,
          conversationId: turn.conversationId,
          content: result.text || "No response produced.",
          runId: result.runId,
          metadata: { proposal_ids: proposalIds },
        });
        send({ type: "final", conversationId: turn.conversationId, messageId: assistant.id, runId: result.runId, text: result.text, proposedActions: proposalIds });
      } catch (error) {
        if (request.signal.aborted) send({ type: "cancelled" });
        else send({ type: "error", error: error instanceof Error ? error.message : "AI command failed" });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenRouterModel, openRouterChat, type OpenRouterMessage } from "@/lib/ai/openrouter";
import { loadAgentLearningSignals } from "./agent-learning";
import { AI_TOOL_REGISTRY_VERSION, executeRegisteredRevenueTool, toOpenRouterTools } from "./ai-tools";

const SYSTEM_CONTRACT = "You are Accelerate's founder-only Revenue OS copilot. Ground every factual claim in tool results. Never invent numbers, people, pricing, dates, or business facts. Read tools may run directly. Every write or outbound action must use a propose_* tool and clearly tell the founder it is awaiting approval. Prioritize revenue, replies, commitments, meetings, proposals, and campaign exceptions. Be concise and operational.";

export interface CommandMessage { role: "user" | "assistant"; content: string }

export async function runRevenueCommandAgent(supabase: SupabaseClient, actorEmail: string, messages: CommandMessage[]) {
  const safeMessages = messages.slice(-12).filter((item) => ["user", "assistant"].includes(item.role) && item.content.trim()).map((item) => ({ role: item.role, content: item.content.slice(0, 8000) }));
  const lastMessage = safeMessages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") throw new Error("A user command is required");
  const model = getOpenRouterModel(process.env.OPENROUTER_AGENT_MODEL);
  const { data: run, error: runError } = await supabase.from("agent_runs").insert({ surface: "admin_command", actor_email: actorEmail, model, prompt_preview: lastMessage.content.slice(0, 500) }).select("id").single();
  if (runError) throw new Error(runError.message);

  const transcript: OpenRouterMessage[] = safeMessages.map((message) => ({ role: message.role, content: message.content }));
  const toolNames: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const learningSignals = await loadAgentLearningSignals(supabase);
    for (let turn = 0; turn < 5; turn++) {
      const response = await openRouterChat({ model, maxTokens: 1200, messages: [{ role: "system", content: `${SYSTEM_CONTRACT}\n\n${learningSignals}` }, ...transcript], tools: toOpenRouterTools() });
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;
      const assistant = response.choices[0]?.message;
      if (!assistant) throw new Error("OpenRouter returned no assistant response");
      transcript.push(assistant);
      await supabase.from("agent_run_events").insert({ run_id: run.id, event_type: "model_response", output: { provider: "openrouter", request_id: response.id, model: response.model, usage: response.usage ?? {}, turn } });
      const uses = assistant.tool_calls ?? [];
      if (!uses.length) {
        const text = assistant.content?.trim() || "";
        await supabase.from("agent_runs").update({ status: "completed", tool_names: [...new Set(toolNames)], input_tokens: inputTokens, output_tokens: outputTokens, result_preview: text.slice(0, 1000), finished_at: new Date().toISOString() }).eq("id", run.id);
        return { text, runId: run.id, proposedActions: toolNames.filter((name) => name.startsWith("propose_")) };
      }
      for (const use of uses) {
        const name = use.function.name;
        toolNames.push(name);
        let toolInput: Record<string, unknown> = {};
        try { toolInput = JSON.parse(use.function.arguments || "{}") as Record<string, unknown>; }
        catch { toolInput = {}; }
        try {
          const { output, tool } = await executeRegisteredRevenueTool({ supabase, actorEmail }, name, toolInput);
          await supabase.from("agent_run_events").insert({ run_id: run.id, event_type: "tool_result", tool_name: name, input: toolInput, output: { result: output, impact: tool.impact, confirmation_required: tool.confirmationRequired, registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: JSON.stringify(output) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Tool failed";
          await supabase.from("agent_run_events").insert({ run_id: run.id, event_type: "tool_error", tool_name: name, input: toolInput, output: { error: message, registry_version: AI_TOOL_REGISTRY_VERSION } });
          transcript.push({ role: "tool", tool_call_id: use.id, content: JSON.stringify({ error: message }) });
        }
      }
    }
    throw new Error("The AI exceeded the maximum tool turns");
  } catch (error) {
    await supabase.from("agent_runs").update({ status: "failed", tool_names: [...new Set(toolNames)], input_tokens: inputTokens, output_tokens: outputTokens, error: error instanceof Error ? error.message : "AI run failed", finished_at: new Date().toISOString() }).eq("id", run.id);
    throw error;
  }
}

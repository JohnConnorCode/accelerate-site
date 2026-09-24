export type AiCommandStreamEvent =
  | { type: "conversation"; conversationId: string; userMessageId: string }
  | { type: "run_started"; runId: string | null; model: string; pack: string }
  | { type: "assistant_delta"; delta: string }
  /** Discard text streamed so far for this answer (a tool turn, or a replaced answer). */
  | { type: "assistant_reset" }
  | { type: "tool_started"; name: string; index: number }
  | { type: "tool_completed"; name: string; index: number; summary: string; failed: boolean }
  | {
      type: "proposal_staged";
      proposal: {
        id: string;
        actionType: string;
        title: string;
        impact: string;
        entityType: string | null;
        entityId: string | null;
      };
    }
  | {
      type: "final";
      conversationId: string;
      messageId: string;
      runId: string | null;
      text: string;
      proposedActions: string[];
    }
  | { type: "error"; error: string }
  | { type: "cancelled" };

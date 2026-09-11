import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listWorkspaceCapabilities } from "./capabilities";
import { listEntityTypes } from "./entity-registry";
import { loadAiConversation } from "./ai-conversations";

export type BeliefKind = "fact" | "inference" | "recommendation" | "missing";
export type Resolution = "existing" | "proposed";

export interface ModelEvidence {
  kind: "message" | "source" | "assumption";
  ref: string;
}

export interface ModelStatement {
  id: string;
  kind: BeliefKind;
  concept: string;
  text: string;
  resolution: Resolution;
  existingKey?: string;
  evidence: ModelEvidence[];
}

export interface ModelConflict {
  id: string;
  concept: string;
  statements: string[];
  evidence: ModelEvidence[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  why: string;
  impact: "architecture" | "workflow" | "copy";
  rank: number;
  proposedAssumption?: string;
  conflictId?: string;
}

export interface ArchitectUnderstanding {
  statements: ModelStatement[];
  conflicts: ModelConflict[];
  questions: ClarificationQuestion[];
  resolvedPrimitives: string[];
  proposedConcepts: string[];
}

const CORE_PRIMITIVES: Array<{ key: string; labels: string[] }> = [
  { key: "contact", labels: ["contact", "customer", "customers", "homeowner"] },
  { key: "company", labels: ["company", "account"] },
  { key: "opportunity", labels: ["opportunity", "deal", "lead", "job"] },
  { key: "proposal", labels: ["proposal", "estimate", "quote"] },
  { key: "invoice", labels: ["invoice", "invoices", "receivable"] },
  { key: "campaign", labels: ["campaign", "sequence"] },
  { key: "conversation", labels: ["conversation", "inbox"] },
  { key: "task", labels: ["task", "follow-up"] },
  { key: "client", labels: ["onboarding client"] },
];

export interface UnderstandingCorpusItem {
  kind: ModelEvidence["kind"];
  ref: string;
  text: string;
}

function kindFor(text: string): BeliefKind {
  const lower = text.toLowerCase();
  if (/\b(should|need to|ought to|recommend)\b/.test(lower)) return "recommendation";
  if (/\b(i think|probably|might|maybe|seems)\b/.test(lower)) return "inference";
  if (/\b(not sure|unknown|don't know|missing)\b/.test(lower)) return "missing";
  return "fact";
}

function polarity(text: string, label: string): "yes" | "no" | "unknown" {
  const lower = text.toLowerCase();
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b(no|not|never|don't|do not)\\b[^.?]{0,24}\\b${escaped}\\b`).test(lower))
    return "no";
  if (new RegExp(`\\b${escaped}\\b`).test(lower)) return "yes";
  return "unknown";
}

export function extractBusinessModel(input: {
  corpus: UnderstandingCorpusItem[];
  knownEntityKeys: string[];
  knownCapabilityKeys: string[];
  assumptions?: string[];
}): ArchitectUnderstanding {
  const known = new Set(
    [...input.knownEntityKeys, ...CORE_PRIMITIVES.map((item) => item.key)].map((key) =>
      key.toLowerCase(),
    ),
  );
  const statements: ModelStatement[] = [];
  const conflicts: ModelConflict[] = [];
  let next = 1;
  const id = (prefix: string) => `${prefix}-${next++}`;

  for (const primitive of CORE_PRIMITIVES) {
    const hits = input.corpus.filter((item) =>
      primitive.labels.some((label) => polarity(item.text, label) !== "unknown"),
    );
    if (!hits.length) continue;
    const existing = known.has(primitive.key);
    const sample = hits[0]!;
    statements.push({
      id: id("s"),
      kind: kindFor(sample.text),
      concept: primitive.key,
      text: sample.text.trim().slice(0, 240),
      resolution: existing ? "existing" : "proposed",
      existingKey: existing ? primitive.key : undefined,
      evidence: hits.map((item) => ({ kind: item.kind, ref: item.ref })),
    });
    const yes = hits.filter((item) =>
      primitive.labels.some((label) => polarity(item.text, label) === "yes"),
    );
    const no = hits.filter((item) =>
      primitive.labels.some((label) => polarity(item.text, label) === "no"),
    );
    if (yes.length && no.length) {
      conflicts.push({
        id: id("c"),
        concept: primitive.key,
        statements: [yes[0]!.text.trim().slice(0, 240), no[0]!.text.trim().slice(0, 240)],
        evidence: [...yes, ...no].map((item) => ({ kind: item.kind, ref: item.ref })),
      });
    }
  }

  for (const item of input.corpus) {
    const belief = kindFor(item.text);
    if (belief === "fact") continue;
    const custom = item.text.match(/\bcustom ([a-z][a-z0-9_-]{2,32})\b/i);
    if (!custom?.[1]) continue;
    const concept = custom[1].toLowerCase();
    if (statements.some((row) => row.concept === concept)) continue;
    const existing = known.has(concept);
    statements.push({
      id: id("s"),
      kind: belief,
      concept,
      text: item.text.trim().slice(0, 240),
      resolution: existing ? "existing" : "proposed",
      existingKey: existing ? concept : undefined,
      evidence: [{ kind: item.kind, ref: item.ref }],
    });
  }

  const resolvedPrimitives = [
    ...new Set(
      statements.filter((item) => item.resolution === "existing").map((item) => item.concept),
    ),
  ];
  const proposedConcepts = [
    ...new Set(
      statements.filter((item) => item.resolution === "proposed").map((item) => item.concept),
    ),
  ];

  const assumptionText = (input.assumptions ?? []).join(" ").toLowerCase();
  const questions: ClarificationQuestion[] = [];
  for (const conflict of conflicts) {
    questions.push({
      id: id("q"),
      question: `Which is true for ${conflict.concept}: ${conflict.statements[0]} or ${conflict.statements[1]}?`,
      why: "Conflicting evidence would change the workspace records and workflows.",
      impact: "architecture",
      rank: 100,
      conflictId: conflict.id,
    });
  }
  for (const concept of proposedConcepts) {
    if (conflicts.some((item) => item.concept === concept)) continue;
    questions.push({
      id: id("q"),
      question: `Should ${concept} stay a custom concept, or map onto an existing record type?`,
      why: "A new record type changes identity, permissions and every later plugin.",
      impact: "architecture",
      rank: 80,
    });
  }
  for (const primitive of resolvedPrimitives) {
    if (conflicts.some((item) => item.concept === primitive)) continue;
    const mentioned = input.corpus.some((item) =>
      /\b(stage|lifecycle|status|won|lost|paid)\b/i.test(item.text),
    );
    if (mentioned) continue;
    const proposedAssumption = `${primitive} follows the existing platform lifecycle until a specialist workflow is approved.`;
    if (assumptionText.includes(primitive)) continue;
    questions.push({
      id: id("q"),
      question: `Does ${primitive} need a custom lifecycle, or is the platform default enough?`,
      why: "Lifecycle changes affect boards, automation and reporting.",
      impact: "workflow",
      rank: 40,
      proposedAssumption,
    });
  }

  questions.sort((a, b) => b.rank - a.rank);
  return {
    statements,
    conflicts,
    questions,
    resolvedPrimitives,
    proposedConcepts,
  };
}

export async function understandArchitectSession(
  supabase: SupabaseClient,
  actorEmail: string,
  conversationId: string,
): Promise<ArchitectUnderstanding> {
  const loaded = await loadAiConversation(supabase, actorEmail, conversationId);
  if (loaded.conversation.purpose !== "architect")
    throw new Error("Business-model extraction is only available on Architect sessions");
  const types = await listEntityTypes(supabase);
  const capabilities = await listWorkspaceCapabilities(supabase);
  const corpus: UnderstandingCorpusItem[] = [
    ...loaded.messages.map((message) => ({
      kind: "message" as const,
      ref: message.id,
      text: message.content,
    })),
    ...loaded.sources.map((source) => ({
      kind: "source" as const,
      ref: source.filename,
      text: `${source.filename} ${source.excerpt}`,
    })),
    ...loaded.assumptions.map((assumption, index) => ({
      kind: "assumption" as const,
      ref: `assumption-${index + 1}`,
      text: assumption,
    })),
  ];
  const understanding = extractBusinessModel({
    corpus,
    knownEntityKeys: types.map((item) => item.typeKey),
    knownCapabilityKeys: capabilities.map((item) => item.capability_key),
    assumptions: loaded.assumptions,
  });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ business_model: understanding, updated_at: now })
    .eq("id", conversationId)
    .eq("actor_email", actorEmail)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return understanding;
}

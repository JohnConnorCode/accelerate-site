import { z } from "zod";
import type { OperatorAttentionItem } from "@/lib/revenue-os/operator-attention";
export interface TodayRegion<T> {
  state: "ready" | "empty" | "partial" | "unavailable";
  data: T;
  observedAt: string;
  message?: string;
}
export interface TodayFact {
  id: string; title: string; detail: string; href: string; sourceType: string; sourceId: string;
  observedAt: string; nextStep: string; severity: "normal" | "high" | "critical" | "low";
}
export const todayBriefSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  sourceIds: z.array(z.string()).max(20),
  sourceEvidence: z.record(z.string(), z.string().max(6000)),
  interpretations: z.array(z.object({
    title: z.string().max(120),
    explanation: z.string().max(600),
    sourceIds: z.array(z.string()).min(1).max(5),
  }).strict()).max(5),
}).strict();
export type TodayBrief = z.infer<typeof todayBriefSchema>;
export interface TodayHandledWork {
  id: string; title: string; status: string; owner: string; outcome: string | null;
  nextCheckAt: string | null; nextCheckReason: string | null; href: string;
}
export interface TodayActivity { id: string; title: string; summary: string | null; at: string; href: string }
export interface TodayAppItem { id: string; title: string; detail: string; href: string; sourceType: string; sourceId: string; observedAt?: string }
export interface TodayApp { id: string; name: string; href: string; items: TodayAppItem[]; state: "ready" | "empty" | "unavailable" }
export interface TodaySnapshot {
  generatedAt: string;
  attention: TodayRegion<OperatorAttentionItem[]>;
  facts: TodayRegion<TodayFact[]>;
  handling: TodayRegion<TodayHandledWork[]>;
  activity: TodayRegion<TodayActivity[]>;
  apps: TodayRegion<TodayApp[]>;
  metrics: TodayRegion<{ openOpportunities: number; pipelineValue: number; weightedValue: number } | null>;
  brief: TodayRegion<TodayBrief | null>;
}
export function validateTodayBrief(raw: unknown, facts: TodayFact[]): TodayBrief | null {
  const parsed = todayBriefSchema.safeParse(raw);
  if (!parsed.success) return null;
  const evidence = todayEvidence(facts);
  const known = new Set(parsed.data.sourceIds);
  if (parsed.data.sourceIds.some((id) => !evidence[id] || parsed.data.sourceEvidence[id] !== evidence[id]) || parsed.data.interpretations.some((item) => item.sourceIds.some((id) => !known.has(id)))) return null;
  return parsed.data;
}
/** Bind interpretations to exact source content, not just a durable record ID. */
export function todayEvidence(facts: TodayFact[]) {
  return Object.fromEntries(facts.map((fact) => [fact.id, JSON.stringify([fact.title, fact.detail, fact.observedAt, fact.nextStep, fact.severity])]));
}
export function todayFacts(items: OperatorAttentionItem[], activity: TodayActivity[]): TodayFact[] {
  const attention = items.slice(0, 8).map((item) => ({
    id: item.sourceType + ":" + item.sourceId, title: item.title, detail: item.priorityReason,
    href: item.href, sourceType: item.sourceType, sourceId: item.sourceId,
    observedAt: item.sourceTimestamp, nextStep: item.recommendedNextAction, severity: item.urgency,
  }));
  const changes: TodayFact[] = activity.slice(0, 5).map((item) => ({
    id: "activity:" + item.id, title: item.title, detail: item.summary || "Recorded business activity",
    href: item.href, sourceType: "activity", sourceId: item.id, observedAt: item.at,
    nextStep: "Review the recorded activity and related context.", severity: "normal",
  }));
  return [...attention.slice(0, 3), ...changes.slice(0, 2), ...attention.slice(3), ...changes.slice(2)];
}

import { z } from "zod";
import type { OperatorAttentionItem } from "@/lib/revenue-os/operator-attention";
export interface TodayRegion<T> {
  state: "ready" | "empty" | "partial" | "unavailable";
  data: T;
  observedAt: string;
  message?: string;
}
export interface TodayFact {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceType: string;
  sourceId: string;
  observedAt: string;
  nextStep: string;
  severity: "normal" | "high" | "critical" | "low";
}
export const todayBriefSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.iso.datetime(),
    sourceIds: z.array(z.string()).max(20),
    sourceEvidence: z.record(z.string(), z.string().max(6000)),
    interpretations: z
      .array(
        z
          .object({
            title: z.string().max(120),
            explanation: z.string().max(600),
            sourceIds: z.array(z.string()).min(1).max(5),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export type TodayBrief = z.infer<typeof todayBriefSchema>;
export interface TodayHandledWork {
  id: string;
  kind: string;
  title: string;
  status: string;
  owner: string;
  outcome: string | null;
  error: string | null;
  nextCheckAt: string | null;
  nextCheckReason: string | null;
  href: string;
}
export interface TodayActivity {
  id: string;
  title: string;
  summary: string | null;
  at: string;
  href: string;
}
export interface TodayAppItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceType: string;
  sourceId: string;
  observedAt?: string;
}
export interface TodayApp {
  id: string;
  name: string;
  href: string;
  items: TodayAppItem[];
  state: "ready" | "empty" | "unavailable";
}
export interface TodaySnapshot {
  generatedAt: string;
  attention: TodayRegion<OperatorAttentionItem[]>;
  facts: TodayRegion<TodayFact[]>;
  handling: TodayRegion<TodayHandledWork[]>;
  activity: TodayRegion<TodayActivity[]>;
  apps: TodayRegion<TodayApp[]>;
  metrics: TodayRegion<{
    openOpportunities: number;
    pipelineValue: number;
    weightedValue: number;
  } | null>;
  brief: TodayRegion<TodayBrief | null>;
}
export function validateTodayBrief(raw: unknown, facts: TodayFact[]): TodayBrief | null {
  const parsed = todayBriefSchema.safeParse(raw);
  if (!parsed.success) return null;
  const evidence = todayEvidence(facts);
  const known = new Set(parsed.data.sourceIds);
  if (
    parsed.data.sourceIds.some(
      (id) => !evidence[id] || parsed.data.sourceEvidence[id] !== evidence[id],
    ) ||
    parsed.data.interpretations.some((item) => item.sourceIds.some((id) => !known.has(id)))
  )
    return null;
  return parsed.data;
}
/** Bind interpretations to exact source content, not just a durable record ID. */
export function todayEvidence(facts: TodayFact[]) {
  return Object.fromEntries(
    facts.map((fact) => [
      fact.id,
      JSON.stringify([fact.title, fact.detail, fact.observedAt, fact.nextStep, fact.severity]),
    ]),
  );
}
export function todayFacts(items: OperatorAttentionItem[], activity: TodayActivity[]): TodayFact[] {
  const attention = items.slice(0, 8).map((item) => ({
    id: item.sourceType + ":" + item.sourceId,
    title: item.title,
    detail: item.priorityReason,
    href: item.href,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    observedAt: item.sourceTimestamp,
    nextStep: item.recommendedNextAction,
    severity: item.urgency,
  }));
  const changes: TodayFact[] = activity.slice(0, 5).map((item) => ({
    id: "activity:" + item.id,
    title: item.title,
    detail: item.summary || "Recorded business activity",
    href: item.href,
    sourceType: "activity",
    sourceId: item.id,
    observedAt: item.at,
    nextStep: "Review the recorded activity and related context.",
    severity: "normal",
  }));
  return [
    ...attention.slice(0, 3),
    ...changes.slice(0, 2),
    ...attention.slice(3),
    ...changes.slice(2),
  ];
}

/** A bounded review of inspected sources, not a company-wide health score. */
export function todayBusinessReview(snapshot: TodaySnapshot) {
  const domains = [
    {
      id: "sales",
      title: "Sales",
      href: "/admin/pipeline",
      why: "Review the next sales decision while the customer still has context.",
      sources: ["proposal"],
      paths: ["pipeline", "proposals", "recovery"],
    },
    {
      id: "customers",
      title: "Customer follow-up",
      href: "/admin/conversations",
      why: "Give the customer a useful reply and keep the next teammate current.",
      sources: ["conversation", "campaign_member"],
      paths: ["conversations", "contacts", "leads", "chat-leads"],
    },
    {
      id: "delivery",
      title: "Delivery",
      href: "/admin/work",
      why: "Check ownership and timing so the next commitment is clear.",
      sources: ["task", "calendar_event", "client_onboarding", "meeting_commitment"],
      paths: ["clients", "client-onboarding", "bookings", "meeting-commitments"],
    },
    {
      id: "money",
      title: "Money",
      href: "/admin/invoicing",
      why: "Check the invoice source before deciding how to follow up on payment.",
      sources: ["collection_case", "stripe_invoice"],
      paths: ["collections", "invoicing", "subscriptions"],
    },
  ];
  return domains.map((domain) => {
    const items: TodayFact[] = snapshot.attention.data
      .filter(
        (item) =>
          domain.sources.includes(item.sourceType) ||
          domain.paths.some((path) => (item.href.split("?")[0] ?? "").startsWith(`/admin/${path}`)),
      )
      .map((item) => ({
        id: `${item.sourceType}:${item.sourceId}`,
        title: item.title,
        detail: item.priorityReason,
        href: item.href,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        observedAt: item.sourceTimestamp,
        nextStep: item.recommendedNextAction,
        severity: item.urgency,
      }));
    const collection = snapshot.apps.data.find((app) => app.id === "receivables-collections");
    if (domain.id === "money" && collection) {
      for (const item of collection.items) {
        if (
          !items.some(
            (fact) => fact.sourceType === item.sourceType && fact.sourceId === item.sourceId,
          )
        )
          items.push({
            ...item,
            id: `${item.sourceType}:${item.sourceId}`,
            observedAt: item.observedAt ?? snapshot.apps.observedAt,
            nextStep: "Open the case to review the current invoice and available follow-up.",
            severity: "normal",
          });
      }
    }
    const unavailable =
      snapshot.attention.state === "unavailable" ||
      (domain.id === "money" &&
        (snapshot.apps.state === "unavailable" || collection?.state === "unavailable"));
    const partial =
      snapshot.attention.state === "partial" ||
      (domain.id === "money" && snapshot.apps.state === "partial");
    const state = unavailable
      ? "unavailable"
      : partial
        ? "partial"
        : items.length
          ? "ready"
          : "empty";
    const message = unavailable
      ? "Some sources could not be read. Open the records and retry the review."
      : partial
        ? "Only part of the available context was read. Review the source before acting."
        : domain.id === "money" && !collection
          ? "Collections is not included in this review. Open invoices for recorded billing status or check Apps & connections."
          : items.length
            ? "From the currently inspected records."
            : "No follow-up surfaced in the inspected records. Open the full workspace for a broader review.";
    return {
      ...domain,
      items,
      state,
      message,
      observedAt:
        domain.id === "money" && collection
          ? snapshot.apps.observedAt
          : snapshot.attention.observedAt,
    };
  });
}

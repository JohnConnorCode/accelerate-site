import { z } from "zod";
import type { LayoutDoc } from "./layout-overrides";
import type { OperatorAttentionItem } from "@/lib/revenue-os/operator-attention";
export const TODAY_TOOL_NAMES = [
  "get_today_workspace",
  "get_today_views",
  "preview_today_view_change",
  "propose_today_view_change",
] as const;

export const TODAY_MODULES = [
  {
    id: "brief",
    name: "Business brief",
    description: "What matters, why, and what to do next.",
    icon: "sun",
  },
  {
    id: "attention",
    name: "Needs you",
    description: "Decisions and work that need your involvement.",
    icon: "focus",
  },
  {
    id: "handling",
    name: "Being handled",
    description: "Work in motion and coworker outcomes.",
    icon: "orbit",
  },
  {
    id: "upcoming",
    name: "Upcoming",
    description: "Meetings and commitments on the horizon.",
    icon: "calendar",
  },
  {
    id: "changes",
    name: "Business changes",
    description: "Signals and developments worth a closer look.",
    icon: "trend",
  },
  {
    id: "metrics",
    name: "Business snapshot",
    description: "A compact view of your current pipeline.",
    icon: "chart",
  },
  {
    id: "activity",
    name: "Recent activity",
    description: "The latest recorded progress across your business.",
    icon: "activity",
  },
  {
    id: "apps",
    name: "App follow-up",
    description: "Source-backed work from your connected Apps.",
    icon: "grid",
  },
  {
    id: "ai",
    name: "Ask your workspace",
    description: "Explore context and prepare your next move.",
    icon: "sparkles",
  },
] as const;
export const todayModuleSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    type: z.enum(TODAY_MODULES.map((m) => m.id)),
    width: z.enum(["full", "primary", "support"]),
    limit: z.number().int().min(1).max(20),
    filter: z.enum(["all", "decision", "work", "watch", "upcoming"]),
    source: z.string().max(100),
    owner: z.string().max(200),
    horizon: z.enum(["all", "today", "week"]),
  })
  .strict();
export const todayViewSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: z.string().trim().min(1).max(60),
    density: z.enum(["comfortable", "compact"]),
    modules: z.array(todayModuleSchema).min(1).max(16),
  })
  .strict()
  .superRefine((view, ctx) => {
    if (new Set(view.modules.map((m) => m.id)).size !== view.modules.length)
      ctx.addIssue({ code: "custom", message: "Each module needs a unique instance ID." });
  });
export const todayDocumentSchema = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    defaultViewId: z.string().max(80).nullable(),
    views: z.array(todayViewSchema).max(12),
    pins: z.array(z.string().max(200)).max(100),
    muted: z
      .array(z.object({ key: z.string().max(200), fingerprint: z.string().max(6000) }).strict())
      .max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (new Set(doc.views.map((v) => v.id)).size !== doc.views.length)
      ctx.addIssue({ code: "custom", message: "Each view needs a unique ID." });
  });
export type TodayModule = z.infer<typeof todayModuleSchema>;
export type TodayView = z.infer<typeof todayViewSchema>;
export type TodayDocument = z.infer<typeof todayDocumentSchema>;
export type TodayScope = "personal" | "workspace";
export interface TodaySavedState {
  revision: number;
  document: TodayDocument;
}
export interface TodayViews {
  personal: TodaySavedState;
  workspace: TodaySavedState;
  canManageWorkspace: boolean;
  userId: string;
  tenantId: string;
}
export const todaySaveSchema = z
  .object({
    scope: z.enum(["personal", "workspace"]),
    revision: z.number().int().min(0),
    requestId: z.uuid(),
    document: todayDocumentSchema,
  })
  .strict();
export function newTodayModule(type: TodayModule["type"], id: string = type): TodayModule {
  return {
    id,
    type,
    width:
      type === "brief"
        ? "full"
        : ["attention", "changes", "ai"].includes(type)
          ? "primary"
          : "support",
    limit: 5,
    filter: "all",
    source: "all",
    owner: "",
    horizon: "all",
  };
}
export function defaultTodayView(legacy?: LayoutDoc | null): TodayView {
  const types: TodayModule["type"][] = [
    "brief",
    "attention",
    "handling",
    "changes",
    "upcoming",
    "ai",
    "apps",
  ];
  const legacyTypes: Record<string, TodayModule["type"]> = {
    "operating-summary": "metrics",
    "operational-ledger": "activity",
    "revenue-copilot": "ai",
  };
  const legacyModule = (id: string): TodayModule["type"] | null => legacyTypes[id] ?? null;
  const hidden = new Set(
    (legacy?.hidden ?? [])
      .map(legacyModule)
      .filter((type): type is TodayModule["type"] => type !== null),
  );
  const trailing = (legacy?.order ?? [])
    .map(legacyModule)
    .filter((type): type is TodayModule["type"] => type !== null);
  const order = [...types.filter((type) => !trailing.includes(type)), ...trailing];
  return {
    id: "business",
    name: "Business overview",
    density: "comfortable",
    modules: order.filter((type) => !hidden.has(type)).map((type) => newTodayModule(type)),
  };
}
export function emptyTodayDocument(): TodayDocument {
  return { version: 1, enabled: true, defaultViewId: null, views: [], pins: [], muted: [] };
}
export function defaultTodayViews(legacy?: LayoutDoc | null): TodayViews {
  const view = defaultTodayView(legacy);
  return {
    personal: { revision: 0, document: emptyTodayDocument() },
    workspace: {
      revision: 0,
      document: { ...emptyTodayDocument(), views: [view], defaultViewId: view.id },
    },
    canManageWorkspace: true,
    userId: "",
    tenantId: "",
  };
}
export function attentionKey(item: OperatorAttentionItem) {
  return item.sourceType + ":" + item.sourceId;
}
export function attentionFingerprint(item: OperatorAttentionItem) {
  return JSON.stringify([
    item.sourceTimestamp,
    item.dueAt,
    item.urgency,
    item.priorityReason,
    item.title,
    item.summary,
  ]);
}
export function filterTodayItems(
  items: OperatorAttentionItem[],
  module: TodayModule,
  preferences: TodayDocument,
  now: Date,
) {
  const end = new Date(now);
  if (module.horizon === "today") end.setHours(23, 59, 59, 999);
  if (module.horizon === "week") end.setDate(end.getDate() + 7);
  return items
    .filter((item) => {
      if (module.filter !== "all" && item.attentionKind !== module.filter) return false;
      if (module.source !== "all" && item.sourceType !== module.source) return false;
      if (
        module.owner &&
        (item.sourceType !== "task" ||
          (module.owner === "unassigned"
            ? Boolean(item.ownerUserId)
            : item.ownerUserId !== module.owner))
      )
        return false;
      if (module.horizon !== "all" && item.dueAt && Date.parse(item.dueAt) > end.getTime())
        return false;
      return !preferences.muted.some(
        (m) => m.key === attentionKey(item) && m.fingerprint === attentionFingerprint(item),
      );
    })
    .sort(
      (a, b) =>
        Number(preferences.pins.includes(attentionKey(b))) -
        Number(preferences.pins.includes(attentionKey(a))),
    );
}

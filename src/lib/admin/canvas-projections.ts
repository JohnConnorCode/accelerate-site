/**
 * Canvas projections for Today and the approval queue. They reference source
 * records by `sourceType:sourceId`; nothing here stores or derives a lifecycle.
 */
import type { CanvasNode } from "./canvas-model";
import { attentionFingerprint, attentionKey, type TodayDocument } from "./today-workspace";
import {
  ATTENTION_SECTIONS,
  type AttentionKind,
  type OperatorAttentionItem,
} from "../revenue-os/operator-attention";

export type TodayCanvasDatum =
  | { kind: "root"; count: number }
  | { kind: "group"; attentionKind: AttentionKind; count: number }
  | { kind: "item"; item: OperatorAttentionItem; pinned: boolean };

const TODAY_GROUP_LABELS: Record<AttentionKind, string> = {
  decision: "Decisions",
  work: "Your work",
  watch: "Watch",
  upcoming: "Upcoming",
};

/** Every attention item the workspace shows, grouped by kind. Muted findings stay hidden. */
export function todayCanvasGraph(
  items: readonly OperatorAttentionItem[],
  preferences: Pick<TodayDocument, "muted" | "pins">,
): CanvasNode<TodayCanvasDatum>[] {
  const visible = items.filter(
    (item) =>
      !preferences.muted.some(
        (m) => m.key === attentionKey(item) && m.fingerprint === attentionFingerprint(item),
      ),
  );
  const nodes: CanvasNode<TodayCanvasDatum>[] = [
    {
      id: "today",
      parentId: null,
      kind: "anchor",
      label: "Today",
      data: { kind: "root", count: visible.length },
    },
  ];
  for (const section of ATTENTION_SECTIONS) {
    const group = visible.filter((item) => item.attentionKind === section.kind);
    if (!group.length) continue;
    const groupId = `group:${section.kind}`;
    nodes.push({
      id: groupId,
      parentId: "today",
      kind: "hub",
      label: TODAY_GROUP_LABELS[section.kind],
      data: { kind: "group", attentionKind: section.kind, count: group.length },
    });
    const ordered =
      section.kind === "upcoming"
        ? [...group].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
        : group;
    const pinnedFirst = [
      ...ordered.filter((item) => preferences.pins.includes(attentionKey(item))),
      ...ordered.filter((item) => !preferences.pins.includes(attentionKey(item))),
    ];
    for (const item of pinnedFirst)
      nodes.push({
        id: attentionKey(item),
        parentId: groupId,
        kind: "record",
        label: item.title,
        data: { kind: "item", item, pinned: preferences.pins.includes(attentionKey(item)) },
      });
  }
  return nodes;
}

/** The fields of an action_queue row the approvals canvas reads. */
export interface CanvasActionRow {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  reasoning: string | null;
  urgency: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

export type ApprovalUrgency = "critical" | "high" | "normal" | "low";
export type ApprovalCanvasDatum =
  | { kind: "root"; count: number }
  | { kind: "group"; urgency: ApprovalUrgency; count: number }
  | { kind: "item"; action: CanvasActionRow };

const URGENCIES: readonly { id: ApprovalUrgency; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

export function pendingCanvasActions<A extends CanvasActionRow>(
  actions: readonly A[],
  now = Date.now(),
) {
  return actions.filter(
    (action) =>
      action.status === "pending" && (!action.expires_at || Date.parse(action.expires_at) > now),
  );
}

/** Pending, unexpired proposals grouped by urgency, oldest first within a group. */
export function approvalsCanvasGraph(
  actions: readonly CanvasActionRow[],
  now = Date.now(),
): CanvasNode<ApprovalCanvasDatum>[] {
  const pending = pendingCanvasActions(actions, now);
  const nodes: CanvasNode<ApprovalCanvasDatum>[] = [
    {
      id: "approvals",
      parentId: null,
      kind: "anchor",
      label: "Approvals",
      data: { kind: "root", count: pending.length },
    },
  ];
  for (const urgency of URGENCIES) {
    const group = pending
      .filter(
        (action) =>
          (URGENCIES.some((u) => u.id === action.urgency) ? action.urgency : "normal") ===
          urgency.id,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!group.length) continue;
    const groupId = `group:${urgency.id}`;
    nodes.push({
      id: groupId,
      parentId: "approvals",
      kind: "hub",
      label: urgency.label,
      data: { kind: "group", urgency: urgency.id, count: group.length },
    });
    for (const action of group)
      nodes.push({
        id: `approval:${action.id}`,
        parentId: groupId,
        kind: "record",
        label: action.title,
        data: { kind: "item", action },
      });
  }
  return nodes;
}

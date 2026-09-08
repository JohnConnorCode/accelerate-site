import type { OperatorQueueItem } from "./types";

export type AttentionKind = "decision" | "work" | "watch" | "upcoming";
export interface AttentionSource {
  sourceType: string;
  sourceId: string;
  kind: AttentionKind;
}
export interface OperatorAttentionItem extends OperatorQueueItem {
  sourceType: string;
  sourceId: string;
  attentionKind: AttentionKind;
}

/** Compatibility adapter over authoritative source identities, never copied lifecycle state.
 * Apps can declare their own source type and presentation category without impersonating a task.
 * The native href remains the command entrypoint for domain-specific work.
 */
export function projectOperatorAttention(
  items: readonly OperatorQueueItem[],
): OperatorAttentionItem[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const colon = item.id.indexOf(":");
    const prefix = colon < 0 ? "" : item.id.slice(0, colon);
    const sourceId = item.attention?.sourceId ?? (colon < 0 ? item.id : item.id.slice(colon + 1));
    const sourceType =
      item.attention?.sourceType ??
      {
        action: "approval",
        task: "task",
        conversation: "conversation",
        proposal: "proposal",
        meeting: "calendar_event",
        campaign: "campaign_member",
        system: "operational_health",
      }[prefix] ??
      item.entityType ??
      "record";
    const attentionKind =
      item.attention?.kind ??
      (prefix === "action"
        ? "decision"
        : prefix === "task"
          ? "work"
          : prefix === "meeting"
            ? "upcoming"
            : "watch");
    const key = JSON.stringify([sourceType, sourceId]);
    if (!sourceId || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        ...item,
        href:
          sourceType === "task" ? `/admin/work?task=${encodeURIComponent(sourceId)}` : item.href,
        sourceType,
        sourceId,
        attentionKind,
      },
    ];
  });
}

export const ATTENTION_SECTIONS: ReadonlyArray<{
  kind: AttentionKind;
  title: string;
  description: string;
}> = [  {
    kind: "decision",
    title: "Approvals",
    description: "Review the exact change before approving.",
  },
  {
    kind: "work",
    title: "Your work",
    description: "Assigned commitments and follow-ups to complete.",
  },
  { kind: "watch", title: "Watch", description: "Signals and exceptions worth investigating." },
  { kind: "upcoming", title: "Upcoming", description: "Meetings and deadlines to prepare for." },
];

/** Which attention sections render for a (possibly pre-filtered) queue.
 * Unfiltered views always show every section, including their empty states.
 * Filtered views omit empty sections so a focus tab does not stack
 * "nothing here" boxes — unless every section is empty, in which case the
 * full set renders so a cleared filter confirms itself instead of going
 * blank. Pure: the component stays a thin renderer over this decision. */
export function selectVisibleAttentionSections(
  counts: ReadonlyArray<{ kind: AttentionKind; rows: number }>,
  hideEmpty: boolean,
): AttentionKind[] {
  const kinds = counts.map((entry) => entry.kind);
  if (!hideEmpty) return kinds;
  const nonEmpty = counts.filter((entry) => entry.rows > 0).map((entry) => entry.kind);
  return nonEmpty.length > 0 ? nonEmpty : kinds;
}

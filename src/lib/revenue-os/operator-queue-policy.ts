import type { OperatorQueueItem } from "./types";

const URGENCY_RANK = { critical: 0, high: 1, normal: 2, low: 3 } as const;
const KIND_RANK: Record<OperatorQueueItem["kind"], number> = {
  reply: 0,
  approval: 1,
  task: 2,
  follow_up: 3,
  meeting: 4,
  proposal: 5,
  system: 6,
};

/** The live queue and fictional demo share the same deadline and ordering rules. */
export function operatorTaskUrgency(
  task: { priority: string; due_date: string | null },
  today: string,
): OperatorQueueItem["urgency"] {
  return task.due_date && task.due_date < today
    ? "critical"
    : task.priority === "high"
      ? "high"
      : "normal";
}

export function sortOperatorQueue(items: OperatorQueueItem[]): OperatorQueueItem[] {
  return [...items].sort((a, b) => {
    const urgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (urgency) return urgency;
    const deadline = (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
    if (deadline) return deadline;
    const kind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (kind) return kind;
    const source = a.sourceTimestamp.localeCompare(b.sourceTimestamp);
    if (source) return source;
    return a.id.localeCompare(b.id);
  });
}

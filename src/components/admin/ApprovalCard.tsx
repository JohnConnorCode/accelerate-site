"use client";

import { Inbox, Send, ShieldCheck } from "lucide-react";
import {
  CanvasCard,
  CanvasCircle,
  canvasCount,
  urgencyIcons,
} from "@/components/canvas/CanvasNodeContent";
import {
  approvalConsequence,
  approvalKind,
  approvalState,
  type ActionRow,
} from "@/lib/admin/approval-presentation";
import type { CanvasLevel, CanvasNode } from "@/lib/admin/canvas-model";
import type { ApprovalCanvasDatum } from "@/lib/admin/canvas-projections";
import { elapsedTime } from "@/lib/admin/work-presentation";
import { cn } from "@/lib/utils";

/** The External, Internal, Configuration or Gmail Draft label every approval surface shows. */
export function ApprovalKindBadge({
  action,
  className,
}: {
  action: Pick<ActionRow, "action_type">;
  className?: string;
}) {
  const kind = approvalKind(action);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider",
        kind.external
          ? "bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]"
          : "bg-[var(--admin-accent-soft)] text-[var(--admin-ink)]",
        className,
      )}
    >
      {kind.label}
    </span>
  );
}

/**
 * A proposal as a card: what kind of action it is, what approving does, and
 * whether it still waits for a decision. The card never decides; its host opens
 * the exact review, which holds the only Approve and Reject controls.
 */
export function ApprovalCard({ action }: { action: ActionRow }) {
  const state = approvalState(action);
  return (
    <span className="grid min-w-0 gap-1.5" data-approval-card data-open={state.open || undefined}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <ApprovalKindBadge action={action} />
        {action.urgency === "high" && state.open && (
          <span className="text-[11px] font-semibold text-[var(--admin-warning)]">
            High priority
          </span>
        )}
        <span className="text-[11px] text-[var(--admin-muted)]">
          Proposed {elapsedTime(action.created_at)}
        </span>
      </span>
      <span className="block text-sm font-semibold text-[var(--admin-ink)]">{action.title}</span>
      <span className="line-clamp-2 text-xs leading-5 text-[var(--admin-muted)]">
        {approvalConsequence(action)}
      </span>
      {!state.open && (
        <span className="text-xs font-semibold text-[var(--admin-ink)]">{state.label}</span>
      )}
    </span>
  );
}

/** The approvals canvas: urgency groups of approval cards at canvas type sizes. */
export function ApprovalCanvasContent(node: CanvasNode<ApprovalCanvasDatum>, level: CanvasLevel) {
  const datum = node.data;
  const count = (n: number) => canvasCount(n, "decision");
  if (datum.kind === "root")
    return (
      <CanvasCircle icon={Inbox} label={node.label} detail={count(datum.count)} level={level} />
    );
  if (datum.kind === "group")
    return (
      <CanvasCircle
        icon={urgencyIcons[datum.urgency]}
        label={node.label}
        detail={count(datum.count)}
        level={level}
      />
    );
  const { action } = datum;
  const kind = approvalKind(action);
  return (
    <CanvasCard
      icon={kind.external ? Send : ShieldCheck}
      title={action.title}
      detail={approvalConsequence(action)}
      level={level}
      meta={
        <span>
          {kind.label} · Proposed {elapsedTime(action.created_at)}
        </span>
      }
    />
  );
}

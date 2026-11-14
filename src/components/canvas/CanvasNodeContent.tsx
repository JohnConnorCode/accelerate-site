"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleAlert,
  Clock,
  Inbox,
  ListChecks,
  Pin,
  Scale,
  ShieldCheck,
  Sun,
} from "lucide-react";
import type { CanvasLevel, CanvasNode } from "@/lib/admin/canvas-model";
import type { ApprovalCanvasDatum, TodayCanvasDatum } from "@/lib/admin/canvas-projections";
import { todaySourceName } from "@/lib/admin/today-data";
import { relativeTime } from "@/lib/admin/work-presentation";

function Circle({
  icon: Icon,
  label,
  detail,
  level,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  level: CanvasLevel;
}) {
  return (
    <span className="admin-canvas-circle">
      <Icon className="admin-canvas-icon" aria-hidden="true" />
      <span className="admin-canvas-label">{label}</span>
      {level === "far" ? (
        <span className="sr-only">{detail}</span>
      ) : (
        <span className="admin-canvas-detail">{detail}</span>
      )}
    </span>
  );
}

function Card({
  icon: Icon,
  title,
  detail,
  meta,
  level,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string | null;
  meta?: React.ReactNode;
  level: CanvasLevel;
}) {
  if (level === "far") return null;
  return (
    <span className="admin-canvas-card">
      <span className="admin-canvas-card-icon">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="admin-canvas-card-body">
        <span className="admin-canvas-card-title">{title}</span>
        {level === "near" && detail && <span className="admin-canvas-card-detail">{detail}</span>}
        {level === "near" && meta && <span className="admin-canvas-card-meta">{meta}</span>}
      </span>
    </span>
  );
}

const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? "" : "s"}`;
const todayIcons = { decision: Scale, work: ListChecks, watch: Activity, upcoming: CalendarDays };

function dueLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TodayCanvasContent(node: CanvasNode<TodayCanvasDatum>, level: CanvasLevel) {
  const datum = node.data;
  if (datum.kind === "root")
    return (
      <Circle icon={Sun} label={node.label} detail={count(datum.count, "item")} level={level} />
    );
  if (datum.kind === "group")
    return (
      <Circle
        icon={todayIcons[datum.attentionKind]}
        label={node.label}
        detail={count(datum.count, "item")}
        level={level}
      />
    );
  const { item, pinned } = datum;
  const due = dueLabel(item.dueAt);
  return (
    <Card
      icon={todayIcons[item.attentionKind]}
      title={item.title}
      detail={item.sourceType === "operational_health" ? item.summary : item.priorityReason}
      level={level}
      meta={
        <>
          <span className="admin-canvas-badge">{todaySourceName(item.sourceType)}</span>
          {due && <span>{due}</span>}
          {pinned && <Pin className="size-3" aria-label="Pinned" />}
        </>
      }
    />
  );
}

const urgencyIcons = { critical: CircleAlert, high: ArrowUp, normal: Clock, low: ArrowDown };

export function ApprovalCanvasContent(node: CanvasNode<ApprovalCanvasDatum>, level: CanvasLevel) {
  const datum = node.data;
  if (datum.kind === "root")
    return (
      <Circle
        icon={Inbox}
        label={node.label}
        detail={count(datum.count, "decision")}
        level={level}
      />
    );
  if (datum.kind === "group")
    return (
      <Circle
        icon={urgencyIcons[datum.urgency]}
        label={node.label}
        detail={count(datum.count, "decision")}
        level={level}
      />
    );
  const { action } = datum;
  return (
    <Card
      icon={ShieldCheck}
      title={action.title}
      detail={action.reasoning || action.description || "Review the exact proposed change."}
      level={level}
      meta={<span>Proposed {relativeTime(action.created_at)}</span>}
    />
  );
}

"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CircleAlert,
  Clock,
  ListChecks,
  Pin,
  Scale,
  Sun,
} from "lucide-react";
import type { CanvasLevel, CanvasNode } from "@/lib/admin/canvas-model";
import type { TodayCanvasDatum } from "@/lib/admin/canvas-projections";
import { todaySourceName } from "@/lib/admin/today-data";

/** Circle content for anchor, hub and satellite nodes: icon, label and a short detail. */
export function CanvasCircle({
  icon: Icon,
  label,
  detail,
  level,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  level: CanvasLevel;
}) {
  return (
    <span className="admin-canvas-circle">
      <Icon className="admin-canvas-icon" aria-hidden="true" />
      <span className="admin-canvas-label">{label}</span>
      {detail &&
        (level === "far" ? (
          <span className="sr-only">{detail}</span>
        ) : (
          <span className="admin-canvas-detail">{detail}</span>
        ))}
    </span>
  );
}

/** Card content for segment and record nodes: icon, title, description and optional meta. */
export function CanvasCard({
  icon: Icon,
  title,
  detail,
  meta,
  level,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string | null;
  meta?: ReactNode;
  level: CanvasLevel;
}) {
  if (level === "far") return <span className="admin-canvas-card-far">{title}</span>;
  return (
    <span className="admin-canvas-card">
      <span className="admin-canvas-card-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="admin-canvas-card-body">
        <span className="admin-canvas-card-title">{title}</span>
        {level === "near" && detail && <span className="admin-canvas-card-detail">{detail}</span>}
        {level === "near" && meta && <span className="admin-canvas-card-meta">{meta}</span>}
      </span>
    </span>
  );
}

/** Station content: icon, title, subtitle and labelled data rows read from source records. */
export function CanvasStation({
  icon: Icon,
  title,
  subtitle,
  rows,
  footer,
  level,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  rows: readonly { label: string; value: string }[];
  footer?: ReactNode;
  level: CanvasLevel;
}) {
  if (level === "far")
    return (
      <span className="admin-canvas-station admin-canvas-station--far">
        <span className="admin-canvas-card-title">{title}</span>
      </span>
    );
  return (
    <span className="admin-canvas-station">
      <span className="admin-canvas-station-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="admin-canvas-card-title">{title}</span>
      {subtitle && <span className="admin-canvas-station-subtitle">{subtitle}</span>}
      {level === "near" && (
        <span className="admin-canvas-station-rows">
          {rows.slice(0, 2).map((row) => (
            <span key={row.label} className="admin-canvas-station-row">
              <span className="admin-canvas-station-row-label">{row.label}</span>
              <span className="admin-canvas-station-row-value">{row.value}</span>
            </span>
          ))}
        </span>
      )}
      {level === "mid" && rows.length > 0 && (
        <span className="admin-canvas-detail">{rows[0]!.value}</span>
      )}
      {level === "near" && footer && <span className="admin-canvas-card-meta">{footer}</span>}
    </span>
  );
}

/** "1 item", "3 items": the count line under a canvas circle. */
export const canvasCount = (value: number, noun: string) =>
  `${value} ${noun}${value === 1 ? "" : "s"}`;
const todayIcons = { decision: Scale, work: ListChecks, watch: Activity, upcoming: CalendarDays };

function dueLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TodayCanvasContent(node: CanvasNode<TodayCanvasDatum>, level: CanvasLevel) {
  const datum = node.data;
  if (datum.kind === "root")
    return (
      <CanvasCircle
        icon={Sun}
        label={node.label}
        detail={canvasCount(datum.count, "item")}
        level={level}
      />
    );
  if (datum.kind === "group")
    return (
      <CanvasCircle
        icon={todayIcons[datum.attentionKind]}
        label={node.label}
        detail={canvasCount(datum.count, "item")}
        level={level}
      />
    );
  const { item, pinned } = datum;
  const due = dueLabel(item.dueAt);
  return (
    <CanvasCard
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

/** Icons for approval urgency groups. */
export const urgencyIcons = { critical: CircleAlert, high: ArrowUp, normal: Clock, low: ArrowDown };

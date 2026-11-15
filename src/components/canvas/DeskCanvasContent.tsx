"use client";

import {
  Bell,
  CalendarDays,
  ChartColumn,
  ChartLine,
  CircleCheck,
  ClipboardList,
  DollarSign,
  Eye,
  FileText,
  Hammer,
  Handshake,
  House,
  Layers,
  Leaf,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  PencilRuler,
  Receipt,
  Search,
  Signature,
  Star,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CanvasLevel } from "@/lib/admin/canvas-model";
import type { DeskIcon, DeskNode } from "@/lib/admin/canvas-desk";
import { CanvasCard, CanvasCircle, CanvasStation } from "./CanvasNodeContent";

export const DESK_ICONS: Record<DeskIcon, LucideIcon> = {
  layers: Layers,
  leaf: Leaf,
  home: House,
  messages: MessagesSquare,
  search: Search,
  hammer: Hammer,
  clipboard: ClipboardList,
  trending: TrendingUp,
  target: Target,
  handshake: Handshake,
  ruler: PencilRuler,
  users: Users,
  chart: ChartColumn,
  megaphone: Megaphone,
  signature: Signature,
  wallet: Wallet,
  wrench: Wrench,
  line: ChartLine,
  dollar: DollarSign,
  calendar: CalendarDays,
  file: FileText,
  check: CircleCheck,
  eye: Eye,
  message: MessageSquareText,
  receipt: Receipt,
  star: Star,
  truck: Truck,
  bell: Bell,
};

/** Content for desk boards: business anchors, phase hubs, segments and stations. */
export function DeskCanvasContent(node: DeskNode, level: CanvasLevel) {
  const { data } = node;
  const icon = DESK_ICONS[data.icon];
  if (node.kind === "segment")
    return <CanvasCard icon={icon} title={node.label} detail={data.detail} level={level} />;
  if (node.kind === "station")
    return (
      <CanvasStation
        icon={icon}
        title={node.label}
        subtitle={data.subtitle}
        rows={data.rows ?? []}
        level={level}
      />
    );
  return (
    <CanvasCircle
      icon={icon}
      label={level === "far" && data.short ? data.short : node.label}
      detail={node.kind === "satellite" ? data.detail : undefined}
      level={level}
    />
  );
}

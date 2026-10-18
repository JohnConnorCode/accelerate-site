"use client";

import {
  TrendingUp,
  Users,
  FileText,
  Target,
  MessageCircle,
  Handshake,
  Globe,
  Mail,
  Building2,
  DollarSign,
} from "lucide-react";
import { StatCard, type StatCardProps } from "./StatCard";
import { formatMoney } from "@/lib/admin/format";

interface DashboardMetricsProps {
  metrics: {
    leadsToday: number;
    leadsWeek: number;
    leadsMonth: number;
    plansGenerated: number;
    conversionRate: string;
    chatLeads?: number;
    partnerApps?: number;
    websiteGrades?: number;
    activeClients?: number;
    mrr?: number;
  };
  emailStats?: {
    active: number;
    completed: number;
    total: number;
  };
  trends?: {
    weekDelta: number;
    monthDelta: number;
    prevWeekCount: number;
    prevMonthCount: number;
  };
}

export function DashboardMetrics({ metrics, emailStats, trends }: DashboardMetricsProps) {
  const cards: StatCardProps[] = [
    { label: "Leads Today", value: metrics.leadsToday, icon: Users },
    {
      label: "Leads This Week",
      value: metrics.leadsWeek,
      icon: TrendingUp,
      comparison: trends
        ? {
            label: "vs last week",
            text: `${trends.weekDelta >= 0 ? "+" : ""}${trends.weekDelta}`,
            direction: trends.weekDelta > 0 ? "up" : trends.weekDelta < 0 ? "down" : "flat",
          }
        : undefined,
    },
    {
      label: "Leads This Month",
      value: metrics.leadsMonth,
      icon: Target,
      comparison: trends
        ? {
            label: "vs last month",
            text: `${trends.monthDelta >= 0 ? "+" : ""}${trends.monthDelta}`,
            direction: trends.monthDelta > 0 ? "up" : trends.monthDelta < 0 ? "down" : "flat",
          }
        : undefined,
    },
    {
      label: "Plans Generated",
      value: metrics.plansGenerated,
      note: `${metrics.conversionRate} conversion`,
      icon: FileText,
    },
  ];

  if (metrics.activeClients !== undefined) {
    cards.push({ label: "Active Clients", value: metrics.activeClients, icon: Building2 });
  }
  if (metrics.mrr !== undefined) {
    cards.push({
      label: "MRR",
      value: formatMoney(metrics.mrr),
      note: "Monthly value of active contracts",
      icon: DollarSign,
    });
  }
  if (metrics.chatLeads !== undefined) {
    cards.push({ label: "Chat Leads", value: metrics.chatLeads, icon: MessageCircle });
  }
  if (metrics.partnerApps !== undefined) {
    cards.push({ label: "Partner Apps", value: metrics.partnerApps, icon: Handshake });
  }
  if (metrics.websiteGrades !== undefined) {
    cards.push({ label: "Website Grades", value: metrics.websiteGrades, icon: Globe });
  }
  if (emailStats) {
    cards.push({
      label: "Email Sequences",
      value: emailStats.total,
      note: `${emailStats.active} active`,
      icon: Mail,
    });
  }

  return (
    <div className="admin-grid admin-grid--metrics">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} index={i} />
      ))}
    </div>
  );
}

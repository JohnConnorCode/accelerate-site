"use client";

import { TrendingUp, Users, FileText, Target, MessageCircle, Handshake, Globe, Mail, Building2, DollarSign } from "lucide-react";
import { StatCard } from "./StatCard";

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
  const weekTrend: "up" | "down" | "neutral" | undefined = trends ? (trends.weekDelta > 0 ? "up" : trends.weekDelta < 0 ? "down" : "neutral") : undefined;
  const monthTrend: "up" | "down" | "neutral" | undefined = trends ? (trends.monthDelta > 0 ? "up" : trends.monthDelta < 0 ? "down" : "neutral") : undefined;
  const weekChange = trends
    ? `${trends.weekDelta >= 0 ? "+" : ""}${trends.weekDelta} vs last week`
    : undefined;
  const monthChange = trends
    ? `${trends.monthDelta >= 0 ? "+" : ""}${trends.monthDelta} vs last month`
    : undefined;

  const cards: {
    label: string;
    value: number;
    icon: typeof Users;
    change?: string;
    trend?: "up" | "down" | "neutral";
  }[] = [
    { label: "Leads Today", value: metrics.leadsToday, icon: Users },
    { label: "Leads This Week", value: metrics.leadsWeek, icon: TrendingUp, change: weekChange, trend: weekTrend },
    { label: "Leads This Month", value: metrics.leadsMonth, icon: Target, change: monthChange, trend: monthTrend },
    { label: "Plans Generated", value: metrics.plansGenerated, change: `${metrics.conversionRate} conversion`, icon: FileText },
  ];

  if (metrics.activeClients !== undefined) {
    cards.push({ label: "Active Clients", value: metrics.activeClients, icon: Building2 });
  }
  if (metrics.mrr !== undefined && metrics.mrr > 0) {
    cards.push({ label: "MRR", value: metrics.mrr, change: `$${metrics.mrr.toLocaleString()}/mo`, icon: DollarSign });
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
    cards.push({ label: "Email Sequences", value: emailStats.total, change: `${emailStats.active} active`, icon: Mail });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          change={card.change}
          trend={card.trend}
          icon={card.icon}
          index={i}
        />
      ))}
    </div>
  );
}

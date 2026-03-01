"use client";

import { TrendingUp, Users, FileText, Target, MessageCircle, Handshake, Globe, Mail } from "lucide-react";
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
  };
  emailStats?: {
    active: number;
    completed: number;
    total: number;
  };
}

export function DashboardMetrics({ metrics, emailStats }: DashboardMetricsProps) {
  const cards = [
    { label: "Leads Today", value: metrics.leadsToday, icon: Users },
    { label: "Leads This Week", value: metrics.leadsWeek, icon: TrendingUp },
    { label: "Leads This Month", value: metrics.leadsMonth, icon: Target },
    { label: "Plans Generated", value: metrics.plansGenerated, change: `${metrics.conversionRate} conversion`, icon: FileText },
  ];

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
          change={"change" in card ? (card as { change?: string }).change : undefined}
          icon={card.icon}
          index={i}
        />
      ))}
    </div>
  );
}

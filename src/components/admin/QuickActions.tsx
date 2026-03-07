"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, Download, Activity, Sparkles, Building2 } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface QuickAction {
  label: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
}

interface QuickActionsProps {
  onExportLeads: () => void;
  onScrollToAI: () => void;
}

export function QuickActions({ onExportLeads, onScrollToAI }: QuickActionsProps) {
  const actions: QuickAction[] = [
    { label: "New Content", icon: FileText, href: "/admin/content" },
    { label: "Export Leads", icon: Download, onClick: onExportLeads },
    { label: "View Clients", icon: Building2, href: "/admin/clients" },
    { label: "AI Insights", icon: Sparkles, onClick: onScrollToAI },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6"
    >
      {actions.map((action, i) => {
        const content = (
          <GlassCard hover="glow" padding="sm" className="cursor-pointer">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="flex items-center gap-3"
            >
              <action.icon className="h-4 w-4 text-[var(--gold-light)]" />
              <span className="text-sm font-medium text-white-primary">{action.label}</span>
            </motion.div>
          </GlassCard>
        );

        if (action.href) {
          return (
            <Link key={action.label} href={action.href}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="appearance-none bg-transparent border-none p-0 text-left w-full"
          >
            {content}
          </button>
        );
      })}
    </motion.div>
  );
}

"use client";

import { Bot, Command, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminAIChat } from "@/components/admin/AdminAIChat";

export default function AdminAIPage() {
  return <div className="space-y-6 pb-10">
    <PageHeader title="AI Command Center" subtitle="Ask live business questions, inspect the evidence, and stage exact next actions without giving the model direct control." actions={<div className="hidden items-center gap-2 sm:flex"><span className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--admin-muted)] shadow-[var(--admin-shadow-border)]"><Command className="size-3.5" />⌘J anywhere</span><span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck className="size-3.5" />Writes gated</span></div>} />
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]"><Bot className="size-4 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">One shared agent</p><p className="admin-copy mt-1 text-xs">This page and the global panel use the same thread and runtime.</p></div><div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]"><ShieldCheck className="size-4 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">Bounded live context</p><p className="admin-copy mt-1 text-xs">Registered tools read canonical records. Missing data stays missing.</p></div><div className="rounded-xl bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-border)]"><Command className="size-4 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-ink)]">Nothing hidden</p><p className="admin-copy mt-1 text-xs">Tool progress, model, pack, failures, and staged changes remain visible.</p></div></div>
    <AdminAIChat />
  </div>;
}

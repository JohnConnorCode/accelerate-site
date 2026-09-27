"use client";

import Link from "@/components/admin/AdminLink";
import { AgentWorkPanel } from "@/components/admin/AgentWorkPanel";
import { PageHeader } from "@/components/admin/PageHeader";

export default function CoworkersPage() {
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Coworkers"
        subtitle="Review AI work and its outcomes. Actions affecting customers wait for your approval."
        actions={
          <Link href="/admin/work?tab=approvals" className="admin-button admin-button--secondary">
            Review approvals
          </Link>
        }
      />
      <AgentWorkPanel />
    </div>
  );
}

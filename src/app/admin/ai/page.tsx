"use client";

import { Suspense } from "react";
import { AdminAIWorkspace } from "@/components/admin/AdminAIWorkspace";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";

export default function AdminAIPage() {
  return (
    <Suspense fallback={<AdminPageLoading title="AI Workspace" subtitle="Inspect evidence, stage actions, and review every consequential decision before execution." variant="detail" />}>
      <AdminAIWorkspace />
    </Suspense>
  );
}

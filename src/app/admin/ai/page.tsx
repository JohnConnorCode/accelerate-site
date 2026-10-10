"use client";

import { Suspense } from "react";
import { AdminAIWorkspace } from "@/components/admin/AdminAIWorkspace";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";

export default function AdminAIPage() {
  return (
    <Suspense
      fallback={
        <AdminPageLoading
          title="AI Workspace"
          subtitle="Work with customer context, prepare follow-up and choose useful next steps."
          variant="detail"
        />
      }
    >
      <AdminAIWorkspace />
    </Suspense>
  );
}

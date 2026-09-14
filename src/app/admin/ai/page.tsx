"use client";

import { Suspense } from "react";
import { AdminAIWorkspace } from "@/components/admin/AdminAIWorkspace";
import { AdminPageLoading } from "@/components/admin/AdminPageLoading";

export default function AdminAIPage() {
  return (
    <Suspense
      fallback={
        <AdminPageLoading
          title="Ask Accelerate"
          subtitle="Ask about your business, inspect the evidence, and review consequential actions before they run."
          variant="detail"
        />
      }
    >
      <AdminAIWorkspace />
    </Suspense>
  );
}

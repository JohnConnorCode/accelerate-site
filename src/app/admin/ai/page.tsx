"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminAIWorkspace } from "@/components/admin/AdminAIWorkspace";

export default function AdminAIPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[55vh] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--admin-muted)]" /></div>}>
      <AdminAIWorkspace />
    </Suspense>
  );
}

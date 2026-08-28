"use client";

import { Suspense } from "react";
import { AdminAIWorkspace } from "@/components/admin/AdminAIWorkspace";
import { AdminRouteSkeleton } from "@/components/admin/AdminRouteSkeleton";

export default function AdminAIPage() {
  return (
    <Suspense fallback={<AdminRouteSkeleton />}>
      <AdminAIWorkspace />
    </Suspense>
  );
}

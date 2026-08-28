"use client";

import { useId, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { useNavigationRuntime } from "@/components/navigation/NavigationRuntime";

type SkeletonRecipe = "page" | "table" | "board" | "detail" | "form";

function canonicalAdminPath(pathname: string) {
  return pathname.replace(/^\/demo\/command-center\/[^/]+/, "/admin");
}

function recipeFor(pathname: string): SkeletonRecipe {
  const path = canonicalAdminPath(pathname);
  if (/^\/admin\/(today|analytics|revenue)$/.test(path)) return "page";
  if (path === "/admin/pipeline") return "board";
  if (/^\/admin\/(contacts|pipeline|clients)\/.+/.test(path)) return "detail";
  if (/^\/admin\/(contact-imports|settings|setup|integrations|ai)$/.test(path)) return "form";
  return "table";
}

export function AdminRouteSkeleton() {
  const pathname = usePathname();
  const boundaryId = useId();
  const { registerLoadingBoundary } = useNavigationRuntime();

  useLayoutEffect(() => {
    registerLoadingBoundary(boundaryId, true);
    return () => registerLoadingBoundary(boundaryId, false);
  }, [boundaryId, registerLoadingBoundary]);

  return <div className="admin-route-loading space-y-6 pb-10" data-admin-route-loading="true" aria-busy="true" aria-label="Loading workspace">
    <header className="admin-skeleton-header"><span className="admin-skeleton-shape block h-2.5 w-28" /><span className="admin-skeleton-shape mt-3 block h-9 w-[min(22rem,70vw)]" /><span className="admin-skeleton-shape mt-3 block h-3 w-[min(34rem,82vw)]" /></header>
    <LoadingSkeleton variant={recipeFor(pathname)} />
  </div>;
}

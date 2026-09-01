"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, type AnchorHTMLAttributes } from "react";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import {
  useNavigationRuntime,
  type NavigationScroll,
} from "@/components/navigation/NavigationRuntime";

type AdminLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function resolveAdminHref(
  href: string,
  scenarioId: string | null,
  workspaceSlug?: string | null,
) {
  if (!href.startsWith("/admin")) return href;
  const suffix = href.replace(/^\/admin\/?/, "");
  if (scenarioId) return `/demo/command-center/${scenarioId}/${suffix || "today"}`;
  if (workspaceSlug) return `/t/${workspaceSlug}/admin/${suffix || "today"}`;
  return href;
}

export default function AdminLink({ href, ...props }: AdminLinkProps) {
  const demo = useAdminDemo();
  const pathname = usePathname();
  const workspaceSlug = pathname.match(/^\/t\/([^/]+)\/admin(?:\/|$)/)?.[1] || null;
  const resolvedHref =
    typeof href === "string"
      ? resolveAdminHref(href, demo?.scenarioId || null, workspaceSlug)
      : href;
  return <Link href={resolvedHref} {...props} />;
}

export function useAdminNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const demo = useAdminDemo();
  const { beginNavigation } = useNavigationRuntime();

  const scenarioId = demo?.scenarioId || null;
  const workspaceSlug = pathname.match(/^\/t\/([^/]+)\/admin(?:\/|$)/)?.[1] || null;
  const resolve = useCallback(
    (href: string) => resolveAdminHref(href, scenarioId, workspaceSlug),
    [scenarioId, workspaceSlug],
  );
  const navigate = useCallback(
    (kind: "push" | "replace", href: string, scroll: NavigationScroll = "top") => {
      const resolved = resolve(href);
      const destination = new URL(resolved, window.location.href);
      const changesPath = destination.pathname !== pathname;
      if (changesPath) beginNavigation({ href: destination.href, kind, scroll });
      router[kind](resolved, { scroll: false });
    },
    [beginNavigation, pathname, resolve, router],
  );

  return useMemo(
    () => ({
      push: (href: string, scroll: NavigationScroll = "top") => navigate("push", href, scroll),
      replace: (href: string, scroll: NavigationScroll = "top") =>
        navigate("replace", href, scroll),
      resolve,
    }),
    [navigate, resolve],
  );
}

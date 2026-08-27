"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, type AnchorHTMLAttributes } from "react";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import { useNavigationRuntime, type NavigationScroll } from "@/components/navigation/NavigationRuntime";

type AdminLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export function resolveAdminHref(href: string, scenarioId: string | null) {
  if (!scenarioId || !href.startsWith("/admin")) return href;
  const suffix = href.replace(/^\/admin\/?/, "");
  return `/demo/command-center/${scenarioId}/${suffix || "today"}`;
}

export default function AdminLink({ href, ...props }: AdminLinkProps) {
  const demo = useAdminDemo();
  const resolvedHref = typeof href === "string" ? resolveAdminHref(href, demo?.scenarioId || null) : href;
  return <Link href={resolvedHref} {...props} />;
}

export function useAdminNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const demo = useAdminDemo();
  const { beginNavigation } = useNavigationRuntime();

  const scenarioId = demo?.scenarioId || null;
  const resolve = useCallback((href: string) => resolveAdminHref(href, scenarioId), [scenarioId]);
  const navigate = useCallback((kind: "push" | "replace", href: string, scroll: NavigationScroll = "top") => {
    const resolved = resolve(href);
    const destination = new URL(resolved, window.location.href);
    const changesPath = destination.pathname !== pathname;
    if (changesPath) beginNavigation({ href: destination.href, kind, scroll });
    router[kind](resolved, { scroll: false });
  }, [beginNavigation, pathname, resolve, router]);

  return useMemo(() => ({
    push: (href: string, scroll: NavigationScroll = "top") => navigate("push", href, scroll),
    replace: (href: string, scroll: NavigationScroll = "top") => navigate("replace", href, scroll),
    resolve,
  }), [navigate, resolve]);
}

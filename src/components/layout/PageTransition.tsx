"use client";

import { usePathname } from "next/navigation";
import { useNavigationRuntime } from "@/components/navigation/NavigationRuntime";
import { isApplicationWorkspace } from "@/lib/navigation/public-chrome";

/**
 * The single, public route-entry contract. A route must never wait for its
 * predecessor to disappear: during an App Router update that can leave the
 * only mounted tree at opacity zero. Keying the incoming route gives every
 * navigation a fresh, compositor-only entry while the previous tree is
 * replaced normally by React. This is deliberately opacity-only: transforms
 * and filters would capture fixed children such as mobile navigation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pendingHref, shouldAnimateRoute } = useNavigationRuntime();
  const pendingPathname = pendingHref
    ? new URL(pendingHref, "http://accelerate.local").pathname
    : null;
  const isLeaving = Boolean(pendingPathname && pendingPathname !== pathname);

  // The Admin layout is its own persistent application shell. Keying this
  // root-level transition by pathname would remount that shell on every admin
  // navigation, restarting sidebar entrance animations and visibly flashing
  // the navigation. Admin owns the content-only transition in its layout.
  if (isApplicationWorkspace(pathname)) return <>{children}</>;

  return (
    <div
      key={pathname}
      className={[
        "route-entry",
        shouldAnimateRoute ? "is-entering" : "",
        isLeaving ? "is-leaving" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-route-entry={pathname}
      data-navigation-pending={isLeaving ? "true" : "false"}
    >
      {children}
    </div>
  );
}

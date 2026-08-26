"use client";

import { usePathname } from "next/navigation";

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

  // The Admin layout is its own persistent application shell. Keying this
  // root-level transition by pathname would remount that shell on every admin
  // navigation, restarting sidebar entrance animations and visibly flashing
  // the navigation. Admin owns the content-only transition in its layout.
  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <div
      key={pathname}
      className="route-entry"
      data-route-entry={pathname}
    >
      {children}
    </div>
  );
}

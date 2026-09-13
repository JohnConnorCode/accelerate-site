"use client";

import { useLayoutEffect, useRef } from "react";
import { adminPageComposition } from "@/lib/admin/page-composition";

const boundary = ".admin-page-introduction, .admin-surface, section, table, form, [role=tabpanel]";
const excluded =
  "script, style, template, [hidden], [role=dialog], [data-admin-overlay], .admin-route-loading, [data-admin-async-state=loading]";

/** One semantic entrance owner, including content that arrives after route commit.
 * Layout effects and mutation delivery mark new sections before their next paint.
 * Existing sections are never replayed by polling, editing or child-list changes.
 */
export function AdminRouteStage({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const seen = new WeakSet<Element>();
    const mark = () => {
      let index = 0;
      const visit = (node: HTMLElement) => {
        if (node.matches(excluded)) return;
        if (
          node.matches(boundary) ||
          (!node.querySelector(boundary) &&
            !node.querySelector(".admin-async-region, [data-admin-async-state]"))
        ) {
          if (!seen.has(node)) {
            seen.add(node);
            node.style.setProperty("--admin-entry-delay", `${Math.min(index++, 3) * 60}ms`);
            node.setAttribute("data-admin-enter", "");
          }
          return;
        }
        for (const child of node.children) if (child instanceof HTMLElement) visit(child);
      };
      for (const child of root.children) if (child instanceof HTMLElement) visit(child);
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [routeKey]);
  return (
    <div
      ref={ref}
      key={routeKey}
      className={`admin-route-stage admin-page admin-page--${adminPageComposition(routeKey)}`}
      data-admin-composition={adminPageComposition(routeKey)}
      data-admin-route-stage
      data-admin-route-key={routeKey}
    >
      {children}
    </div>
  );
}

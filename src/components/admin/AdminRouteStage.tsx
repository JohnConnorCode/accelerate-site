"use client";

import { useId, useLayoutEffect, useRef } from "react";
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
  const id = useId();
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const delays = new WeakMap<Element, number>();
    // A scoped stylesheet leaves React-owned server markup untouched while
    // nested Suspense boundaries hydrate. Rules never mutate section attributes.
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    const mark = () => {
      let index = 0;
      const rules: string[] = [];
      const visit = (node: HTMLElement, selector: string) => {
        if (node.matches(excluded)) return;
        if (
          node.matches(boundary) ||
          (!node.querySelector(boundary) &&
            !node.querySelector(".admin-async-region, [data-admin-async-state]"))
        ) {
          if (!delays.has(node)) {
            delays.set(node, Math.min(index++, 3) * 60);
          }
          rules.push(
            `${selector}{animation:var(--admin-route-entry);animation-delay:${delays.get(node)}ms}`,
          );
          return;
        }
        Array.from(node.children).forEach((child, position) => {
          if (child instanceof HTMLElement) visit(child, `${selector}>:nth-child(${position + 1})`);
        });
      };
      Array.from(root.children).forEach((child, position) => {
        if (child instanceof HTMLElement)
          visit(child, `#${CSS.escape(id)}>:nth-child(${position + 1})`);
      });
      sheet.replaceSync(`@media(prefers-reduced-motion:no-preference){${rules.join("")}}`);
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (current) => current !== sheet,
      );
    };
  }, [routeKey, id]);
  return (
    <div
      ref={ref}
      id={id}
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

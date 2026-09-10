"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/admin/AdminLink";
import { ArrowUpRight, ChevronDown, CircleHelp } from "lucide-react";
import { adminNavSections, resolveAdminNavLink } from "@/lib/admin/navigation";
import { adminPageGuidance, type AdminPageGuidance } from "@/lib/admin/page-guidance";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  utilityActions?: React.ReactNode;
  eyebrow?: string;
  guidance?: AdminPageGuidance | false;
}

/** Shared page identity and optional help. Detail titles remain record-specific. */
export function PageHeader({
  title,
  subtitle,
  actions,
  utilityActions,
  eyebrow,
  guidance,
}: PageHeaderProps) {
  const pathname = usePathname();
  const adminPath = pathname
    .replace(/^\/demo\/command-center\/[^/]+/, "/admin")
    .replace(/^\/t\/[^/]+\/admin/, "/admin");
  const destination = resolveAdminNavLink(adminPath);
  const isRoot = destination?.href === adminPath;
  const section = adminNavSections.find((item) =>
    item.links.some((link) => link.id === destination?.id),
  );
  const help =
    guidance === false
      ? undefined
      : (guidance ?? (destination ? adminPageGuidance[destination.id] : undefined));
  const description = subtitle ?? (isRoot ? help?.description : undefined);

  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const node = detailsRef.current;
    if (node) node.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOnOutsideOrEscape(event: MouseEvent | KeyboardEvent) {
      const node = detailsRef.current;
      if (!node || !node.open) return;
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      if (event.type === "mousedown" && node.contains(event.target as Node)) return;
      node.open = false;
    }
    document.addEventListener("mousedown", closeOnOutsideOrEscape);
    document.addEventListener("keydown", closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideOrEscape);
      document.removeEventListener("keydown", closeOnOutsideOrEscape);
    };
  }, []);

  return (
    <div className="admin-page-introduction">
      <div className="admin-page-header relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className={utilityActions ? "min-w-0 pr-14 sm:pr-0" : "min-w-0"}>
          {(eyebrow || section) && (
            <p className="admin-eyebrow">{eyebrow ?? section?.title ?? section?.label}</p>
          )}
          <h1 className="admin-page-title">{title}</h1>
          {description && (
            <p className="admin-copy mt-2 max-w-2xl text-sm leading-relaxed">{description}</p>
          )}
        </div>
        {(utilityActions || actions || help) && (
          <div className="contents sm:flex sm:shrink-0 sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            {utilityActions && (
              <div className="absolute right-0 top-0 flex items-center gap-2 sm:static">
                {utilityActions}
              </div>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
              {help && (
                <details ref={detailsRef} className="admin-help">
                  <summary className="admin-help-trigger" aria-label="How this page works">
                    <CircleHelp size={14} aria-hidden="true" />
                    <span>Help</span>
                    <ChevronDown className="admin-help-chevron" size={12} aria-hidden="true" />
                  </summary>
                  <div className="admin-help-panel">
                    <p className="font-semibold text-[var(--admin-ink)]">
                      {destination?.label ?? title}
                    </p>
                    <ol className="mt-3 grid gap-3">
                      {help.steps.map((step, index) => (
                        <li key={step} className="flex items-start gap-3">
                          <span className="admin-help-step" aria-hidden="true">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                    <Link href={help.guideHref} className="admin-help-guide">
                      Read the guide <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { ArrowUpRight, ChevronDown, CircleHelp } from "lucide-react";
import { resolveAdminNavLink } from "@/lib/admin/navigation";
import { adminPageGuidance, type AdminPageGuidance } from "@/lib/admin/page-guidance";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  utilityActions?: React.ReactNode;
  eyebrow?: string;
  guidance?: AdminPageGuidance | false;
}

// Renders into document.body so the floating panel can never be trapped
// inside an ancestor's stacking context (e.g. a framer-motion entrance
// animation leaves a `transform` on .admin-page-introduction, which would
// otherwise sandbox z-index and let later page content paint over it).
// Same approach as NotificationBell's overlay.
function HelpOverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- gate a portal behind mount
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
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
  const help =
    guidance === false
      ? undefined
      : (guidance ?? (destination ? adminPageGuidance[destination.id] : undefined));
  const description = subtitle ?? (isRoot ? help?.description : undefined);

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpOpenPathname, setHelpOpenPathname] = useState(pathname);
  const [panelPosition, setPanelPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the popover when navigating, without an Effect: adjust state
  // during render when the route we opened it on has changed.
  if (pathname !== helpOpenPathname) {
    setHelpOpenPathname(pathname);
    if (helpOpen) setHelpOpen(false);
  }

  const closeHelp = useCallback((restoreFocus = false) => {
    setHelpOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const toggleHelp = () => {
    if (!helpOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setHelpOpen((value) => !value);
  };

  useEffect(() => {
    if (!helpOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closeHelp();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHelp(true);
      }
    }
    function onViewportChange() {
      closeHelp();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [helpOpen, closeHelp]);

  return (
    <div className="admin-page-introduction">
      <div className="admin-page-header relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className={utilityActions ? "min-w-0 pr-14 sm:pr-0" : "min-w-0"}>
          {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
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
                <>
                  <button
                    ref={triggerRef}
                    type="button"
                    className="admin-help-trigger"
                    aria-expanded={helpOpen}
                    aria-haspopup="dialog"
                    onClick={toggleHelp}
                  >
                    <CircleHelp size={14} aria-hidden="true" />
                    <span>Help</span>
                    <ChevronDown
                      className="admin-help-chevron"
                      size={12}
                      aria-hidden="true"
                      style={{ transform: helpOpen ? "rotate(180deg)" : undefined }}
                    />
                  </button>
                  <HelpOverlayPortal>
                    <AnimatePresence>
                      {helpOpen && panelPosition && (
                        <motion.div
                          ref={panelRef}
                          role="dialog"
                          aria-label={`How ${destination?.label ?? title} works`}
                          className="admin-help-panel admin-overlay-token-scope"
                          style={{ top: panelPosition.top, right: panelPosition.right }}
                          initial={{ opacity: 0, y: -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <p className="admin-help-title">{destination?.label ?? title}</p>
                          <ol className="admin-help-steps">
                            {help.steps.map((step, index) => (
                              <li key={step} className="admin-help-step-row">
                                <span className="admin-help-step" aria-hidden="true">
                                  {index + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                          <Link
                            href={help.guideHref}
                            className="admin-help-guide"
                            onClick={() => closeHelp()}
                          >
                            Read the guide <ArrowUpRight size={14} aria-hidden="true" />
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </HelpOverlayPortal>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

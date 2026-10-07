"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useId,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "@/components/admin/AdminLink";
import { ArrowUpRight, ChevronDown, CircleHelp, X } from "lucide-react";
import { resolveAdminNavLink } from "@/lib/admin/navigation";
import { adminPageGuidance, type AdminPageGuidance } from "@/lib/admin/page-guidance";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  utilityActions?: React.ReactNode;
  eyebrow?: string | false;
  compact?: boolean;
  guidance?: AdminPageGuidance | false;
}

// Renders into document.body so the floating panel can never be trapped
// inside a route entrance's stacking context or content scroll viewport.
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
  compact = false,
  guidance,
}: PageHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminPath = pathname
    .replace(/^\/demo\/command-center\/[^/]+/, "/admin")
    .replace(/^\/t\/[^/]+\/admin/, "/admin");
  const identityHref = `${adminPath}?${searchParams.toString()}`;
  const destination = resolveAdminNavLink(identityHref);
  const isRoot = destination?.href.split("?")[0] === adminPath;
  const help =
    guidance === false
      ? undefined
      : (guidance ?? (destination ? adminPageGuidance[destination.id] : undefined));
  const description = subtitle || (isRoot ? help?.description : undefined);

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpOpenPathname, setHelpOpenPathname] = useState(identityHref);
  const [panelPosition, setPanelPosition] = useState<{ top: number; right: number } | null>(null);
  const helpId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the popover when navigating, without an Effect: adjust state
  // during render when the route we opened it on has changed.
  if (identityHref !== helpOpenPathname) {
    setHelpOpenPathname(identityHref);
    if (helpOpen) setHelpOpen(false);
  }

  const closeHelp = useCallback((restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    setHelpOpen(false);
  }, []);

  const toggleHelp = () => {
    if (!helpOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const height = Math.min(panelRef.current?.scrollHeight ?? 0, window.innerHeight - 24);
      const below = rect.bottom + 8;
      const top =
        below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 8);
      setPanelPosition({
        top,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setHelpOpen((value) => !value);
  };

  useEffect(() => {
    if (!helpOpen) return;
    panelRef.current?.focus({ preventScroll: true });
    function onPointerDown(event: PointerEvent) {
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
    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) closeHelp();
    }
    function onViewportChange(event: Event) {
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      closeHelp(Boolean(panelRef.current?.contains(document.activeElement)));
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [helpOpen, closeHelp]);

  return (
    <div className={`admin-page-introduction${compact ? " admin-page-introduction-compact" : ""}`}>
      <div className="admin-page-header relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
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
              <div className="admin-page-utilities absolute right-0 top-0 flex items-center gap-2 sm:static">
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
                    aria-controls={helpId}
                    aria-haspopup="dialog"
                    onClick={toggleHelp}
                  >
                    <CircleHelp size={14} aria-hidden="true" />
                    <span>How this works</span>
                    <ChevronDown
                      className="admin-help-chevron"
                      size={12}
                      aria-hidden="true"
                      style={{ transform: helpOpen ? "rotate(180deg)" : undefined }}
                    />
                  </button>
                  <HelpOverlayPortal>
                    <div
                      ref={panelRef}
                      id={helpId}
                      tabIndex={-1}
                      data-open={helpOpen}
                      aria-hidden={!helpOpen}
                      inert={!helpOpen}
                      onKeyDown={(event) => {
                        if (event.key !== "Tab") return;
                        const controls =
                          panelRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
                        if (!controls?.length) return;
                        const first = controls[0];
                        const last = controls[controls.length - 1];
                        if (
                          (event.shiftKey &&
                            (event.target === first || event.target === panelRef.current)) ||
                          (!event.shiftKey && event.target === last)
                        ) {
                          event.preventDefault();
                          closeHelp(true);
                        }
                      }}
                      role="dialog"
                      aria-label={`How ${destination?.label ?? title} works`}
                      className="admin-help-panel admin-overlay-token-scope"
                      style={
                        {
                          "--admin-help-top": `${panelPosition?.top ?? 12}px`,
                          "--admin-help-anchor-right": `${panelPosition?.right ?? 12}px`,
                        } as CSSProperties
                      }
                    >
                      <div className="admin-help-heading">
                        <p className="admin-help-title">Workflow steps</p>
                        <button
                          type="button"
                          className="admin-help-close"
                          aria-label="Close help"
                          onClick={() => closeHelp(true)}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
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
                      {help.savedOutcome && (
                        <p className="admin-copy mt-3 text-sm leading-relaxed">
                          <strong>Saved result: </strong>
                          {help.savedOutcome}
                        </p>
                      )}
                      <div className="admin-help-links">
                        <Link
                          href={help.guideHref}
                          prefetch={helpOpen ? null : false}
                          className="admin-help-guide"
                          onClick={() => closeHelp()}
                        >
                          Read the guide <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                        {help.workflowId && (
                          <Link
                            href={`/docs/start/daily-path#${help.workflowId}`}
                            prefetch={helpOpen ? null : false}
                            className="admin-help-guide"
                            onClick={() => closeHelp()}
                          >
                            Follow a worked example <ArrowUpRight size={14} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </HelpOverlayPortal>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {help?.startHint && (isRoot || guidance) && (
        <p className="admin-copy mt-3 max-w-3xl text-sm leading-relaxed" data-page-start-hint>
          <strong className="text-[var(--admin-ink)]">Start here: </strong>
          {help.startHint}
        </p>
      )}
    </div>
  );
}

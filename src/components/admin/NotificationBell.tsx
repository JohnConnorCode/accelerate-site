"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { ArrowRight, Bell, Check, Inbox, Users, MessageCircle, Handshake, FileCheck, CheckSquare, AlertCircle, Eye, Target, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/admin/useToast";

const DEFAULT_POLL_MS = 30_000;
const URGENT_POLL_MS = 10_000;

interface Notification {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  priority?: string;
  created_at: string;
}

interface PrioritySnapshot {
  status: "ready" | "degraded";
  summary: { total: number; urgent: number; critical: number };
}

const typeIcons: Record<string, LucideIcon> = {
  new_lead: Users,
  new_contact: Inbox,
  new_chat: MessageCircle,
  new_partner: Handshake,
  proposal_viewed: Eye,
  task_overdue: CheckSquare,
  contract_expiring: AlertCircle,
  proposal_accepted: FileCheck,
};

const priorityColors: Record<string, string> = {
  urgent: "border-l-2 border-l-red-500",
  important: "border-l-2 border-l-yellow-500",
  info: "",
};

function OverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Every notification surface belongs to the viewport overlay layer. Keeping
  // desktop inside the sidebar made its position depend on rail geometry and
  // allowed the panel to cover the workspace from the wrong origin.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function NotificationBell({ placement = "sidebar" }: { placement?: "sidebar" | "mobile" }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [priority, setPriority] = useState<PrioritySnapshot | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [desktopPosition, setDesktopPosition] = useState<{ left: number; top: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Placement is fixed by the persistent shell, so a semantic id is both
  // unique and hydration-stable across the public demo rewrite.
  const panelId = `admin-notifications-${placement}`;
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchErrorCount = useRef(0);

  const fetchNotifications = useCallback(async () => {
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    try {
      const res = await fetch("/api/admin/notifications", { signal: controller.signal });
      if (!res.ok) {
        // 401/403 mean the admin session expired — don't toast every poll.
        if (res.status !== 401 && res.status !== 403) {
          fetchErrorCount.current += 1;
          if (fetchErrorCount.current === 3) {
            toast.error("Can't reach notifications. Check your connection.");
          }
        }
        return;
      }
      fetchErrorCount.current = 0;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setUrgentCount(data.urgentCount || 0);
      setPriority(data.priority || null);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[NotificationBell] fetch failed:", err);
      fetchErrorCount.current += 1;
      if (fetchErrorCount.current === 3) {
        toast.error("Lost connection to notifications.");
      }
    } finally {
      if (fetchAbortRef.current === controller) fetchAbortRef.current = null;
    }
  }, []);

  // Two-tier polling: default 30s, faster 10s when there's an urgent unread.
  // Pauses while the tab is hidden.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        timer = setTimeout(tick, DEFAULT_POLL_MS);
        return;
      }
      await fetchNotifications();
      if (cancelled) return;
      const delay = urgentCount > 0 ? URGENT_POLL_MS : DEFAULT_POLL_MS;
      timer = setTimeout(tick, delay);
    };

    tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Refresh immediately when the user comes back.
        fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onPageHide = () => fetchAbortRef.current?.abort();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      fetchAbortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [fetchNotifications, urgentCount]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closePanel = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Desktop is a contextual popover. Mobile is modal and keeps keyboard focus
  // inside the sheet until the user dismisses it.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (placement !== "mobile" || event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePanel, isOpen, placement]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const togglePanel = () => {
    if (!isOpen && placement === "sidebar" && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelWidth = Math.min(360, window.innerWidth - 24);
      setDesktopPosition({
        left: Math.max(12, Math.min(rect.right + 12, window.innerWidth - panelWidth - 12)),
        top: Math.max(12, Math.min(rect.top - 8, window.innerHeight - 320)),
      });
    }
    setIsOpen((current) => !current);
  };

  // Mobile alerts and the dock share the bottom edge. Give the sheet exclusive
  // ownership of that interaction layer while it is open, then restore the
  // dock when focus returns to the trigger.
  useEffect(() => {
    if (placement !== "mobile" || !isOpen) return;
    document.body.classList.add("admin-notifications-open");
    return () => document.body.classList.remove("admin-notifications-open");
  }, [isOpen, placement]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      setUrgentCount(0);
    } catch (err) {
      console.error("[NotificationBell] markAllRead failed:", err);
      toast.error("Couldn't mark notifications read. Try again.");
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[NotificationBell] markRead failed:", err);
      toast.error("Couldn't mark that notification read.");
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const signalCount = unreadCount;
  const hasCriticalSignal = urgentCount > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={togglePanel}
        className={cn("admin-notification-trigger relative inline-flex items-center justify-center rounded-[10px] text-white-muted transition-[color,background-color,transform] duration-150 hover:bg-black/5 hover:text-white-primary active:scale-[0.96]", placement === "mobile" ? "size-11" : "size-10")}
        aria-label={isOpen ? "Close command center alerts" : `Open command center alerts${signalCount ? `, ${signalCount} need attention` : ""}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <Bell className="size-[17px]" />
        {signalCount > 0 && (
          <span className={cn(
            "admin-notification-count absolute right-0 top-0 flex size-[15px] items-center justify-center rounded-full font-mono text-[8px] font-bold tabular-nums text-white",
            hasCriticalSignal ? "bg-rose-500" : "bg-[var(--error)]"
          )}>
            {signalCount > 9 ? "9+" : signalCount}
          </span>
        )}
      </button>

      <OverlayPortal>
      <AnimatePresence initial={false}>
        {isOpen && (
          <>
            {placement === "mobile" && <motion.button type="button" aria-label="Dismiss notifications" onClick={() => closePanel()} className="fixed inset-0 z-[59] bg-black/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />}
            <motion.div
              ref={panelRef}
              id={panelId}
              data-admin-mobile-alerts={placement === "mobile" ? "" : undefined}
              data-placement={placement}
              role="dialog"
              aria-modal={placement === "mobile" ? true : undefined}
              aria-label="Notifications"
              tabIndex={-1}
              initial={placement === "mobile" ? { opacity: 0, y: 18 } : { opacity: 0, y: -4, scale: 0.95 }}
              animate={placement === "mobile" ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={placement === "mobile" ? { opacity: 0, y: 10 } : { opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="admin-notification-panel admin-overlay-token-scope z-[60] overflow-hidden bg-[var(--admin-surface,#fbfbfa)] text-[var(--admin-ink,#0b0b0b)]"
              style={placement === "sidebar" && desktopPosition ? desktopPosition : undefined}
            >
            {placement === "mobile" && <span className="mx-auto mt-2 block h-1 w-9 rounded-full bg-[var(--admin-ink)]/20" aria-hidden="true" />}
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
              <div><p className="admin-eyebrow">Command Center</p><h4 className="mt-0.5 text-sm font-semibold text-[var(--admin-ink)]">Notifications</h4></div>
              <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
              <button type="button" onClick={() => closePanel()} className="grid size-10 place-items-center rounded-lg text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]" aria-label="Close notifications"><X className="size-4" /></button>
              </div>
            </div>

            <div className="admin-notification-scroll overflow-y-auto overscroll-contain">
              {priority?.status === "ready" && priority.summary.total > 0 && (
                <Link href="/admin/today" onClick={() => closePanel(false)} className="group mx-3 mt-3 flex min-h-12 items-center gap-3 rounded-xl bg-[var(--admin-surface-subtle)] px-3 py-2.5 text-left shadow-[var(--admin-shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--admin-shadow-border-hover)] active:scale-[0.98]">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--admin-surface)] text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"><Target className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[var(--admin-ink)]">{priority.summary.total} priority {priority.summary.total === 1 ? "item" : "items"}</span><span className="mt-0.5 block text-[10px] text-[var(--admin-muted)]">{priority.summary.urgent ? `${priority.summary.urgent} urgent · ` : ""}Open Today</span></span>
                  <ArrowRight className="size-4 shrink-0 text-[var(--admin-muted)] transition-transform duration-150 group-hover:translate-x-0.5" />
                </Link>
              )}
              <div className="flex items-center justify-between px-4 pb-2 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">Notifications</p>{unreadCount > 0 && <span className="font-mono text-[10px] tabular-nums text-[var(--admin-muted)]">{unreadCount} unread</span>}</div>
              {notifications.length === 0 ? (
                <p className="px-4 pb-7 pt-3 text-center text-xs text-[var(--admin-muted)]">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const content = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03]",
                        !notification.read && "bg-black/[0.018] dark:bg-white/[0.025]",
                        priorityColors[notification.priority || "info"]
                      )}
                    >
                      <Icon className="h-4 w-4 text-[var(--admin-muted)] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm truncate",
                          notification.read ? "text-[var(--admin-muted)]" : "text-[var(--admin-ink)] font-medium"
                        )}>
                          {notification.title}
                        </p>
                        {notification.description && (
                          <p className="mt-0.5 truncate text-xs text-[var(--admin-muted)]">
                            {notification.description}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-[var(--admin-muted)]">
                          {timeAgo(notification.created_at)} ago
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--admin-ink)]" />
                      )}
                    </div>
                  );

                  if (notification.link) {
                    return (
                      <Link key={notification.id} href={notification.link} onClick={() => {
                        if (!notification.read) void handleMarkRead(notification.id);
                        closePanel(false);
                      }}>
                        {content}
                      </Link>
                    );
                  }

                  return <button key={notification.id} type="button" className="block w-full text-left" onClick={() => {
                    if (!notification.read) void handleMarkRead(notification.id);
                    closePanel(false);
                  }}>{content}</button>;
                })
              )}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
      </OverlayPortal>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "@/components/admin/AdminLink";
import { Bell, Check, Inbox, Users, MessageCircle, Handshake, FileCheck, CheckSquare, AlertCircle, Eye, ArrowRight, X } from "lucide-react";
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

interface PriorityItem {
  id: string;
  kind: "reply" | "task" | "follow_up" | "proposal" | "meeting" | "approval" | "system";
  title: string;
  urgency: "critical" | "high" | "normal" | "low";
  sourceTimestamp: string;
  priorityReason: string;
  recommendedNextAction: string;
  href: string;
}

interface PrioritySnapshot {
  status: "ready" | "degraded";
  summary: { total: number; urgent: number; critical: number };
  items: PriorityItem[];
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
  const [priority, setPriority] = useState<PrioritySnapshot>({ status: "ready", summary: { total: 0, urgent: 0, critical: 0 }, items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
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
      setPriority(data.priority || { status: "degraded", summary: { total: 0, urgent: 0, critical: 0 }, items: [] });
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

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      fetchAbortRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
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

  // A popover should never strand keyboard users. This is intentionally not a
  // focus trap: desktop alerts are a contextual menu, while the mobile sheet
  // has a visible close control and backdrop.
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

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

  const signalCount = unreadCount + priority.summary.urgent;
  const hasCriticalSignal = urgentCount > 0 || priority.summary.critical > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
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
            {placement === "mobile" && <motion.button type="button" aria-label="Dismiss command center alerts" onClick={() => setIsOpen(false)} className="fixed inset-0 z-[59] bg-black/35 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />}
            <motion.div
              ref={panelRef}
              id={panelId}
              data-admin-mobile-alerts={placement === "mobile" ? "" : undefined}
              data-placement={placement}
              role="dialog"
              aria-modal={placement === "mobile" ? true : undefined}
              aria-label="Command Center attention"
              initial={placement === "mobile" ? { opacity: 0, y: 18 } : { opacity: 0, y: -4, scale: 0.95 }}
              animate={placement === "mobile" ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={placement === "mobile" ? { opacity: 0, y: 10 } : { opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="admin-notification-panel admin-overlay-token-scope z-[60] overflow-hidden bg-[var(--admin-surface,#fbfbfa)] text-[var(--admin-ink,#0b0b0b)]"
            >
            {placement === "mobile" && <span className="mx-auto mt-2 block h-1 w-9 rounded-full bg-[var(--admin-ink)]/20" aria-hidden="true" />}
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
              <div><p className="admin-eyebrow">Command Center</p><h4 className="mt-0.5 text-sm font-semibold text-[var(--admin-ink)]">Attention</h4></div>
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
              <button type="button" onClick={() => setIsOpen(false)} className="grid size-10 place-items-center rounded-lg text-[var(--admin-muted)] transition-[background-color,color,transform] duration-150 hover:bg-black/[0.04] hover:text-[var(--admin-ink)] active:scale-[0.96] dark:hover:bg-white/[0.05]" aria-label="Close command center alerts"><X className="size-4" /></button>
              </div>
            </div>

            <div className="admin-notification-scroll overflow-y-auto overscroll-contain">
              {priority.items.length > 0 && <section aria-label="Priority work">
                <div className="flex items-center justify-between px-4 pb-2 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">Priority work</p><Link href="/admin/today" onClick={() => setIsOpen(false)} className="inline-flex min-h-10 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold text-[var(--admin-ink)] transition-[background-color,transform] duration-150 hover:bg-black/[0.04] active:scale-[0.96] dark:hover:bg-white/[0.05]">All {priority.summary.total}<ArrowRight className="size-3" /></Link></div>
                <div className="divide-y divide-[var(--admin-border)] border-y border-[var(--admin-border)]">
                  {priority.items.slice(0, 3).map((item) => {
                    return <Link key={item.id} href={item.href} onClick={() => setIsOpen(false)} className={cn("group flex min-h-[68px] items-start gap-3 border-l-2 px-4 py-3 transition-[background-color,transform] duration-150 hover:bg-black/[0.025] active:scale-[0.99] dark:hover:bg-white/[0.03]", item.urgency === "critical" ? "border-l-rose-500" : item.urgency === "high" ? "border-l-amber-500" : "border-l-transparent")}>
                      <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="block truncate text-xs font-semibold text-[var(--admin-ink)]">{item.title}</span>{item.urgency !== "normal" && item.urgency !== "low" && <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em]", item.urgency === "critical" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-amber-500/12 text-amber-800 dark:text-amber-300")}>{item.urgency}</span>}</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--admin-muted)]">{item.priorityReason}</span><span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[var(--admin-muted)]">Next: {item.recommendedNextAction}</span></span>
                      <ArrowRight className="mt-2 size-3.5 shrink-0 text-[var(--admin-muted)] transition-transform duration-150 group-hover:translate-x-0.5" />
                    </Link>;
                  })}
                </div>
              </section>}
              {priority.status === "degraded" && <div className="border-b border-[var(--admin-border)] bg-amber-500/[0.07] px-4 py-3 text-[11px] leading-4 text-amber-800 dark:text-amber-300">Priority work could not be refreshed. Notifications remain available; open Today to retry the live queue.</div>}
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
                        setIsOpen(false);
                      }}>
                        {content}
                      </Link>
                    );
                  }

                  return <button key={notification.id} type="button" className="block w-full text-left" onClick={() => {
                    if (!notification.read) void handleMarkRead(notification.id);
                    setIsOpen(false);
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

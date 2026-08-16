"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Bell, Check, Inbox, Users, MessageCircle, Handshake, FileCheck, CheckSquare, AlertCircle, Eye } from "lucide-react";
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="admin-notification-trigger relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-white-muted transition-[color,background-color,transform] duration-150 hover:bg-black/5 hover:text-white-primary active:scale-[0.96] cursor-pointer"
        aria-label={isOpen ? "Close notifications" : `Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center",
            urgentCount > 0 ? "bg-red-500 animate-pulse" : "bg-[var(--error)]"
          )}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 overflow-clip rounded-[14px] bg-[var(--admin-surface,#fbfbfa)] text-[var(--admin-ink,#0b0b0b)] shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-glass">
              <h4 className="text-sm font-semibold text-white-primary">Notifications</h4>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-white-muted hover:text-white-secondary transition-colors cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-sm text-white-muted text-center">
                  No notifications yet
                </p>
              ) : (
                notifications.map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const content = (
                    <div
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors",
                        !notification.read && "bg-white/[0.03]",
                        priorityColors[notification.priority || "info"]
                      )}
                      onClick={() => {
                        if (!notification.read) handleMarkRead(notification.id);
                        setIsOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4 text-white-muted shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm truncate",
                          notification.read ? "text-white-secondary" : "text-white-primary font-medium"
                        )}>
                          {notification.title}
                        </p>
                        {notification.description && (
                          <p className="text-xs text-white-muted truncate mt-0.5">
                            {notification.description}
                          </p>
                        )}
                        <p className="text-[10px] text-white-muted mt-1">
                          {timeAgo(notification.created_at)} ago
                        </p>
                      </div>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-[var(--gold-light)] shrink-0 mt-1.5" />
                      )}
                    </div>
                  );

                  if (notification.link) {
                    return (
                      <Link key={notification.id} href={notification.link}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={notification.id}>{content}</div>;
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

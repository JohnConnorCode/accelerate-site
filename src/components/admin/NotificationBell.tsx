"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Bell, Check, Inbox, Users, MessageCircle, Handshake, FileCheck, CheckSquare, AlertCircle, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setUrgentCount(data.urgentCount || 0);
    } catch {
      // silent — table may not exist yet
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // poll every minute
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity -- relative-time formatting needs real "now"
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
        className="relative p-1.5 text-white-muted hover:text-white-primary transition-colors cursor-pointer"
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 glass-prominent rounded-xl shadow-2xl border border-border-glass z-50 overflow-clip"
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

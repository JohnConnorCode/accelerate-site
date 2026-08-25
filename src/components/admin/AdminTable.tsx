"use client";

import { Fragment, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminSurface } from "./AdminSurface";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render: (item: T, index: number) => ReactNode;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: string) => void;
  onRowClick?: (item: T) => void;
  expandedId?: string | null;
  renderExpanded?: (item: T) => ReactNode;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
}

export function AdminTable<T>({
  columns,
  data,
  keyExtractor,
  sortField,
  sortOrder,
  onSort,
  onRowClick,
  expandedId,
  renderExpanded,
  emptyMessage = "No data found",
  emptyIcon,
}: AdminTableProps<T>) {
  return (
    <AdminSurface padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)] bg-black/[0.018] dark:bg-white/[0.025]">
            {columns.map((col) => (
              <th
                key={col.key}
                aria-sort={col.sortable && sortField === col.key ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
                className={cn(
                  "px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]",
                  col.className
                )}
              >
                {col.sortable ? <button type="button" onClick={() => onSort?.(col.key)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-left transition-[color,transform] duration-150 hover:text-[var(--admin-ink)] active:scale-[0.96]">
                  {col.label}
                  <ArrowUpDown className={cn("size-3", sortField === col.key ? "text-[var(--admin-ink)]" : "text-[var(--admin-muted)]/60")} />
                  {sortField === col.key && <span className="text-[9px] normal-case tracking-normal">{sortOrder === "asc" ? "asc" : "desc"}</span>}
                </button> : <span>{col.label}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const key = keyExtractor(item);
            const isExpanded = expandedId === key;
            return (
              <Fragment key={key}>
                <motion.tr
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "border-b border-[var(--admin-border)] transition-[background-color] duration-150 hover:bg-black/[0.022] dark:hover:bg-white/[0.025]",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3", col.className)}>
                      {col.render(item, index)}
                    </td>
                  ))}
                </motion.tr>
                <AnimatePresence initial={false}>
                  {isExpanded && renderExpanded && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <td colSpan={columns.length} className="bg-[var(--admin-surface-subtle)] px-4 py-4">
                        {renderExpanded(item)}
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
      {data.length === 0 && (
        <EmptyState message={emptyMessage} icon={emptyIcon} />
      )}
    </AdminSurface>
  );
}

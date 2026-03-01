"use client";

import { Fragment, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
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
    <GlassCard padding="none" hover="none" className="overflow-clip">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-glass">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "text-left px-4 py-3 text-xs font-semibold text-white-muted uppercase",
                  col.sortable && "cursor-pointer hover:text-white-secondary select-none",
                  col.className
                )}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <ArrowUpDown
                      className={cn(
                        "h-3 w-3",
                        sortField === col.key
                          ? "text-white-primary"
                          : "text-white-muted/50"
                      )}
                    />
                  )}
                  {col.sortable && sortField === col.key && (
                    <span className="text-[10px] text-white-muted">
                      {sortOrder === "asc" ? "asc" : "desc"}
                    </span>
                  )}
                </span>
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
                    "border-b border-border-glass hover:bg-white/[0.02] transition-colors",
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
                <AnimatePresence>
                  {isExpanded && renderExpanded && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <td colSpan={columns.length} className="px-4 py-4 bg-bg-elevated">
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
      {data.length === 0 && (
        <EmptyState message={emptyMessage} icon={emptyIcon} />
      )}
    </GlassCard>
  );
}

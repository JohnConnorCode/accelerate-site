"use client";

import { Calendar } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-[var(--admin-muted)] shrink-0" />
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="admin-field admin-field--inline rounded-lg bg-[var(--admin-surface-subtle)] border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-ink)] focus-visible:outline-none focus-visible:border-[var(--admin-action)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)]/30 transition-[border-color,box-shadow,background-color] [color-scheme:dark]"
        placeholder="From"
      />
      <span className="text-xs text-[var(--admin-muted)]">to</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="admin-field admin-field--inline rounded-lg bg-[var(--admin-surface-subtle)] border border-[var(--admin-border)] px-3 py-1.5 text-sm text-[var(--admin-ink)] focus-visible:outline-none focus-visible:border-[var(--admin-action)] focus-visible:ring-2 focus-visible:ring-[var(--admin-action)]/30 transition-[border-color,box-shadow,background-color] [color-scheme:dark]"
        placeholder="To"
      />
    </div>
  );
}

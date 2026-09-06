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
      <Calendar className="h-4 w-4 text-white-muted shrink-0" />
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30 transition-[border-color,box-shadow,background-color] [color-scheme:dark]"
        placeholder="From"
      />
      <span className="text-xs text-white-muted">to</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className="rounded-lg bg-bg-subtle border border-border-glass px-3 py-1.5 text-sm text-white-primary focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30 transition-[border-color,box-shadow,background-color] [color-scheme:dark]"
        placeholder="To"
      />
    </div>
  );
}

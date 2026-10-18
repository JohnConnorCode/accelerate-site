/**
 * Shared number, money, rate and date formatting for admin surfaces.
 *
 * One place owns these rules so the same figure cannot read differently on two
 * pages. Every formatter returns an explicit unknown value instead of a
 * fabricated zero.
 */

export const UNKNOWN_VALUE = "—";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export interface FormatOptions {
  /** Text used when the value is unknown or unavailable. */
  unknown?: string;
}

export function formatMoney(
  value: number | null | undefined,
  options: FormatOptions & { currency?: string; maximumFractionDigits?: number } = {},
): string {
  if (!isFiniteNumber(value)) return options.unknown ?? UNKNOWN_VALUE;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: options.currency ?? "USD",
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  options: FormatOptions = {},
): string {
  if (!isFiniteNumber(value)) return options.unknown ?? UNKNOWN_VALUE;
  return value.toLocaleString("en-US");
}

/** A percentage value already expressed as a number, e.g. 72 renders as "72%". */
export function formatRate(
  value: number | null | undefined,
  options: FormatOptions = {},
): string {
  if (!isFiniteNumber(value)) return options.unknown ?? UNKNOWN_VALUE;
  return `${value}%`;
}

export const formatPercent = formatRate;

/** A duration in hours, rendered as minutes below one hour. */
export function formatHours(
  value: number | null | undefined,
  options: FormatOptions = {},
): string {
  if (!isFiniteNumber(value)) return options.unknown ?? UNKNOWN_VALUE;
  return value < 1 ? `${Math.round(value * 60)} min` : `${value} hr`;
}

/**
 * Parse a value into a Date. A bare `YYYY-MM-DD` is treated as a local calendar
 * date so it does not shift a day in timezones behind UTC.
 */
function toDate(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
  unknown: string = UNKNOWN_VALUE,
): string {
  if (value === null || value === undefined || value === "") return unknown;
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return unknown;
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatShortDate(
  value: string | number | Date | null | undefined,
  unknown: string = UNKNOWN_VALUE,
): string {
  return formatDate(value, { month: "short", day: "numeric" }, unknown);
}

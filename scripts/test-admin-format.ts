/**
 * Scoped guard for the shared admin formatters.
 *
 * Locks the two invariants the metric primitive depends on: one formatting rule
 * per figure type, and an explicit unknown value instead of a fabricated zero.
 */
import assert from "node:assert/strict";
import {
  UNKNOWN_VALUE,
  formatDate,
  formatHours,
  formatMoney,
  formatNumber,
  formatRate,
  formatShortDate,
} from "../src/lib/admin/format";

assert.equal(formatMoney(1500), "$1,500", "money uses USD with no fraction digits");
assert.equal(formatMoney(0), "$0", "a real zero is formatted, not hidden");
assert.equal(formatMoney(null), UNKNOWN_VALUE, "missing money is unknown, not zero");
assert.equal(formatMoney(undefined), UNKNOWN_VALUE, "undefined money is unknown");
assert.equal(
  formatMoney(null, { unknown: "Not reported" }),
  "Not reported",
  "the unknown text is overridable",
);
assert.equal(
  formatMoney(1234.5, { maximumFractionDigits: 2 }),
  "$1,234.50",
  "money honours a fraction-digit override",
);
assert.equal(formatMoney(999, { currency: "EUR" }), "€999", "money honours a currency override");

assert.equal(formatRate(72), "72%", "a rate renders as a percentage");
assert.equal(formatRate(null), UNKNOWN_VALUE, "a missing rate is unknown, not 0%");
assert.equal(formatRate(0), "0%", "a real zero rate renders");

assert.equal(formatNumber(1234), "1,234", "numbers use grouping");
assert.equal(formatNumber(Number.NaN), UNKNOWN_VALUE, "a non-finite number is unknown");

assert.equal(formatHours(0.5), "30 min", "sub-hour durations render as minutes");
assert.equal(formatHours(3), "3 hr", "hour durations render as hours");
assert.equal(formatHours(null), UNKNOWN_VALUE, "a missing duration is unknown");

assert.equal(formatDate("not-a-date"), UNKNOWN_VALUE, "an unparseable date is unknown");
assert.equal(formatDate("2026-01-15"), "Jan 15, 2026", "dates use the shared format");
assert.equal(formatShortDate("2026-01-15"), "Jan 15", "short dates drop the year");

console.log("admin format: money, rate, hours, number and date guards pass");

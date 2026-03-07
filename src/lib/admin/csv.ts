/**
 * Sanitize a string value for CSV export to prevent formula injection.
 * Prefixes dangerous characters with a single quote so Excel/Sheets
 * treat the cell as plain text instead of executing a formula.
 */
export function sanitizeCsv(value: string): string {
  if (value.length > 0 && /^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

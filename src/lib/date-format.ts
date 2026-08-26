const UTC_TIME_ZONE = "UTC";

export function formatDateOnly(
  date: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Date(date).toLocaleDateString("en-US", {
    ...options,
    timeZone: UTC_TIME_ZONE,
  });
}

export function getUtcMonthKey(date: string) {
  const parsed = new Date(date);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

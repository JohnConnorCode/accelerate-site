export function isMissingRevenueSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "42703" ||
    candidate.code === "PGRST204" ||
    candidate.code === "PGRST205" ||
    /relation .* does not exist|column .* does not exist|could not find .* column/i.test(
      candidate.message || "",
    )
  );
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function domainFromEmailOrWebsite(
  email?: string | null,
  website?: string | null,
): string | null {
  if (website) {
    try {
      return new URL(website.includes("://") ? website : `https://${website}`).hostname
        .replace(/^www\./, "")
        .toLowerCase();
    } catch {
      // Fall through to email.
    }
  }
  const normalized = normalizeEmail(email);
  return normalized?.split("@")[1] || null;
}

export function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

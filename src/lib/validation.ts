/**
 * Validates an email address with stricter rules than a basic regex:
 * - Requires 2+ character TLD
 * - No consecutive dots in domain
 * - No leading/trailing dots in local part
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(trimmed) &&
    !trimmed.includes("..") &&
    !trimmed.startsWith(".") &&
    !trimmed.includes(".@");
}

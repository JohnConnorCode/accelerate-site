/** Content links are data. Never let imported or generated content become script,
 * a protocol-relative redirect, or a URL with an embedded credential. */
export function isSiteContentHref(value: string): boolean {
  if (!value || value !== value.trim() || /[\\\u0000-\u0020\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (value.startsWith("#")) return /^#[a-zA-Z][\w-]*$/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

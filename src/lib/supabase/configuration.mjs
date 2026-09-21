/** @param {string | undefined} value */
export function isSetupPlaceholder(value) {
  return !value || /^(?:https?:\/\/)?(?:your-|use-a-local|generate-a-)/i.test(value);
}

/** Public configuration validation only; this does not establish connectivity. */
/** @param {string | undefined} url @param {string | undefined} key */
export function isSupabasePublicConfigured(url, key) {
  if (
    isSetupPlaceholder(url) ||
    isSetupPlaceholder(key) ||
    !url ||
    !key ||
    url !== url.trim() ||
    key !== key.trim()
  )
    return false;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["", "/"].includes(parsed.pathname) ||
      /^(your-|example\.)/i.test(parsed.hostname)
    )
      return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    const parts = key.split(".");
    if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "anon";
  } catch {
    return false;
  }
}

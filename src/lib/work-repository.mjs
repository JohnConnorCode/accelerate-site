/** Credential-free Git addresses shared by board validation and local preflight.
 * Keep the grammar aligned with work_repository_url_valid in the ordered migration.
 * @param {unknown} value
 * @returns {string | null}
 */
export function repositoryIdentity(value) {
  if (typeof value !== "string" || !value || value.length > 500) return null;
  if (/[^\x21-\x7e]|[?#\\]/.test(value)) return null;
  const input = value.replace(/^([a-zA-Z0-9._-]+)@([^/:]+):/, "ssh://$1@$2/");
  if (!/^(https:\/\/|ssh:\/\/|file:\/\/)/i.test(input)) return null;
  if (/%(?![a-f0-9]{2})/i.test(input)) return null;
  const network = /^(https|ssh):\/\/(?:([a-zA-Z0-9._-]+)@)?(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?(\/.+)$/i.exec(input);
  if (!/^file:/i.test(input) && !network) return null;
  const path = network?.[5] ?? input.replace(/^file:\/\/(localhost)?/i, "");
  if (/(^|\/)(\.|%2e){1,2}(\/|$)/i.test(path)) return null;
  try {
    const url = new URL(input);
    if (url.password || url.search || url.hash || !url.pathname.replaceAll("/", ""))
      return null;
    if (url.protocol === "file:") {
      if (!/^file:\/\/(localhost)?\/[^/]/i.test(input) || url.hostname) return null;
    } else {
      if (url.protocol === "https:" && url.username) return null;
      if (url.username && !/^[a-zA-Z0-9._-]+$/.test(url.username)) return null;
      const host = network?.[3] ?? "";
      if (!host.startsWith("[")) {
        if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host)) return null;
        if (/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(host.split(".").at(-1) ?? "") &&
            (!/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.split(".").some(part => Number(part) > 255 || (part.length > 1 && part.startsWith("0"))))) return null;
      }
      if (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) return null;
      if (url.port) url.port = String(Number(url.port));
    }
    // Include non-default ports: repositories on different SSH services are distinct.
    return `${url.host.toLowerCase()}${url.pathname.replace(/\.git\/?$/, "").replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

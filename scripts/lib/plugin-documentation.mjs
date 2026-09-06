import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";

/** Offline structural checks. Factual/task review remains a release obligation. */
export function pluginDocumentationFailures(root, manifest) {
  const failures = [];
  if (!/^[a-z][a-z0-9-]{2,48}$/.test(manifest.id ?? "")) return failures;
  const guide = `plugins/${manifest.id}/README.md`;
  const path = join(root, guide);
  if (!existsSync(path)) failures.push(`missing operator guide ${guide}`);
  else if (relative(realpathSync(root), realpathSync(path)).startsWith(".."))
    failures.push(`operator guide must be inside the repository: ${guide}`);
  else if (!/^# .+\n[\s\S]*\S/m.test(readFileSync(path, "utf8")))
    failures.push(`operator guide needs a title and content: ${guide}`);

  const href = manifest.docsUrl;
  if (typeof href !== "string" || !href.trim()) {
    failures.push("docsUrl is required for every extension");
    return failures;
  }
  if (/^\/docs\/[a-z0-9][a-z0-9/-]*$/.test(href)) return failures;
  if (!URL.canParse(href)) failures.push("docsUrl must be a public HTTPS URL or /docs/... path");
  else {
    const url = new URL(href);
    if (url.protocol !== "https:" || url.username || url.password)
      failures.push("docsUrl must use HTTPS without credentials");
    // Check this repository's public README links without network requests.
    const prefix = "/JohnConnorCode/accelerate-site/blob/main/plugins/";
    if (
      url.hostname === "github.com" &&
      url.pathname.startsWith(prefix) &&
      url.pathname !== `/JohnConnorCode/accelerate-site/blob/main/${guide}`
    )
      failures.push(`docsUrl must link to this plugin's guide: ${guide}`);
  }
  return failures;
}

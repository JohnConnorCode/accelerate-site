#!/usr/bin/env node
/**
 * Every optional module's own API routes must refuse a request when that
 * module is disabled for the tenant, not only hide the page's nav link and
 * data-fetch UI. requireAdminForModule() (src/lib/admin/module-guard.ts) is
 * the one place that check happens; this proves every route file under a
 * module's owned API directories actually calls it instead of the plain
 * requireAdmin(), which authorizes the caller but never checks the module.
 *
 * The directory list below is the "reviewed core allowlist" the module route
 * gating card calls for, expressed as required coverage rather than an
 * exemption list: everything named here must guard by module. Everything not
 * named here is core, unowned (redirects, auth pages), or the module toggle
 * route itself, which must stay reachable so a disabled module can be turned
 * back on. src/app/api/admin/integrations is deliberately excluded: gating
 * the "Integrations & Modules" console's own read behind its own module flag
 * would let an operator lock themselves out of the one screen that re-enables
 * it, and there is no card yet for building the console a bypass.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const MODULE_API_DIRECTORIES = {
  proposals: ["src/app/api/admin/proposals"],
  campaigns: ["src/app/api/admin/revenue-os/campaigns"],
  "email-studio": ["src/app/api/admin/emails"],
  recovery: ["src/app/api/admin/revenue-os/recovery"],
  revenue: ["src/app/api/admin/revenue"],
  bookings: ["src/app/api/admin/bookings"],
  clients: ["src/app/api/admin/clients"],
  content: ["src/app/api/admin/content"],
  resources: ["src/app/api/admin/resources"],
  "leads-capture": ["src/app/api/admin/leads", "src/app/api/admin/chat-leads"],
  subscribers: ["src/app/api/admin/subscribers"],
  partners: ["src/app/api/admin/partners"],
  "website-grades": ["src/app/api/admin/website-grades"],
  analytics: ["src/app/api/admin/analytics", "src/app/api/admin/revenue-os/analytics"],
};

const failures = [];

// The map above must name real, non-core modules, so a typo or a renamed
// module id fails loudly instead of silently guarding nothing.
const modulesSource = read("src/lib/revenue-os/modules.ts");
for (const moduleId of Object.keys(MODULE_API_DIRECTORIES)) {
  const declared = new RegExp(`id:\\s*"${moduleId}"`).test(modulesSource);
  if (!declared) {
    failures.push(
      `MODULE_API_DIRECTORIES names "${moduleId}", which is not a module id in modules.ts.`,
    );
  }
}

function walkRouteFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walkRouteFiles(path));
    else if (name === "route.ts") files.push(path);
  }
  return files;
}

let checkedFiles = 0;
for (const [moduleId, directories] of Object.entries(MODULE_API_DIRECTORIES)) {
  for (const directory of directories) {
    const absolute = join(repoRoot, directory);
    if (!existsSync(absolute)) {
      failures.push(`MODULE_API_DIRECTORIES names "${directory}", which does not exist.`);
      continue;
    }
    for (const file of walkRouteFiles(absolute)) {
      checkedFiles += 1;
      const relative = file.slice(repoRoot.length);
      const source = readFileSync(file, "utf8");
      const guarded = source.includes(`requireAdminForModule("${moduleId}")`);
      const bareRequireAdmin = /(?<!requireAdminFor)requireAdmin\(\)/.test(source);
      if (!guarded) {
        failures.push(
          `${relative} is owned by module "${moduleId}" but does not call requireAdminForModule("${moduleId}").`,
        );
      } else if (bareRequireAdmin) {
        failures.push(
          `${relative} mixes requireAdminForModule("${moduleId}") with a bare requireAdmin() call; every handler in a module-owned file must gate by module.`,
        );
      }
    }
  }
}

if (checkedFiles < 15) {
  failures.push(
    `Only checked ${checkedFiles} route files across MODULE_API_DIRECTORIES; the directory list and the tree have drifted.`,
  );
}

// Generic bundled report adapter has a request-selected module, then the host
// independently rechecks current enablement before execution and publication.
const reportRoute = read("src/app/api/admin/plugins/run/route.ts");
if (
  !reportRoute.includes("requireAdminForModule(input.data.pluginId)") ||
  !/runReportPlugin\(\s*authorization\.database/.test(reportRoute)
)
  failures.push("Report adapter must authenticate its declared module and use the shared host");
if (failures.length) {
  console.error(`Module route guard check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    { result: "passed", modules: Object.keys(MODULE_API_DIRECTORIES).length, files: checkedFiles },
    null,
    2,
  ),
);

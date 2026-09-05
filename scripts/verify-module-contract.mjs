#!/usr/bin/env node
/**
 * Module contract resolution check.
 *
 * The module registry is the thing that decides whether a nav entry renders,
 * whether an AI tool is offered, and whether a route is reachable. A typo in
 * any of those three lists silently disables the wrong thing, or worse,
 * silently gates nothing at all. This resolves every declared reference
 * against the real source of truth:
 *
 * - every module's navLinkIds must exist in adminNavSections
 * - every module's routes must exist as a page under src/app/admin
 * - every module's aiToolNames must be registered in ai-tools.ts
 * - every registered AI tool must belong to exactly one module, so a new tool
 *   cannot escape module gating by not being claimed
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), "utf8");

const failures = [];

// --- Modules -------------------------------------------------------------
const modulesSource = read("src/lib/revenue-os/modules.ts");
const generatedSource = read("src/lib/revenue-os/extension-modules.generated.ts");

function parseModules(source) {
  const modules = [];
  // Each module literal starts at an `id:` line; capture the block until the
  // next `id:` or the end, then pull the arrays out of that block. Keys are
  // matched both bare (modules.ts) and quoted (the JSON-shaped generated
  // file), so an extension manifest is checked exactly like a core module.
  const blocks = source.split(/\n\s*\{\s*\n/).slice(1);
  for (const block of blocks) {
    const id = block.match(/"?id"?:\s*"([a-z0-9-]+)"/)?.[1];
    if (!id) continue;
    const pick = (key) => {
      const raw = block.match(new RegExp(`"?${key}"?:\\s*\\[([^\\]]*)\\]`, "s"))?.[1] ?? "";
      return [...raw.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    };
    modules.push({
      id,
      navLinkIds: pick("navLinkIds"),
      aiToolNames: pick("aiToolNames"),
      routes: pick("routes"),
      setupChecks: pick("setupChecks"),
    });
  }
  return modules;
}

// Only the EXTENSION_MODULES array from the generated file; EXTENSION_NAV_LINKS
// below it also carries `id` fields and would otherwise be counted as modules.
const extensionModulesSection = generatedSource.slice(
  generatedSource.indexOf("EXTENSION_MODULES"),
  generatedSource.indexOf("EXTENSION_NAV_LINKS") === -1
    ? undefined
    : generatedSource.indexOf("export const EXTENSION_NAV_LINKS"),
);
const modules = [...parseModules(modulesSource), ...parseModules(extensionModulesSection)];
if (modules.length < 10) {
  failures.push(
    `Only parsed ${modules.length} modules from modules.ts; the parser and the file have drifted.`,
  );
}

// --- Nav link ids --------------------------------------------------------
const navSource = read("src/lib/admin/navigation.ts");
const navIds = new Set([...navSource.matchAll(/^\s{8}id:\s*"([a-z0-9-]+)",/gm)].map((m) => m[1]));
for (const link of [...generatedSource.matchAll(/"?id"?:\s*"([a-z0-9-]+)"/g)].map((m) => m[1])) {
  navIds.add(link);
}
for (const mod of modules) {
  for (const navId of mod.navLinkIds) {
    if (!navIds.has(navId)) {
      failures.push(
        `Module "${mod.id}" declares navLinkId "${navId}", which no entry in adminNavSections defines.`,
      );
    }
  }
}

// --- Routes --------------------------------------------------------------
const adminAppDir = join(repoRoot, "src/app/admin");
const existingRoutes = new Set();
function walkRoutes(dir, prefix) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkRoutes(path, `${prefix}/${name}`);
    else if (name === "page.tsx") existingRoutes.add(prefix);
  }
}
if (existsSync(adminAppDir)) walkRoutes(adminAppDir, "/admin");
for (const mod of modules) {
  for (const route of mod.routes) {
    // A route declared by an extension whose pages are not in the tree yet is
    // the one case worth naming precisely, since it is the likeliest mistake.
    if (!existingRoutes.has(route)) {
      failures.push(
        `Module "${mod.id}" declares route "${route}", which has no page.tsx under src/app/admin.`,
      );
    }
  }
}

// Reverse direction: every real admin page must be claimed by some module,
// or module-route-gating-enforcement's longest-prefix resolver silently
// leaves it ungated. A page is claimed if its path exactly matches, or is
// nested under, a declared route. Redirect shells and the auth pages have no
// module by design and are named here rather than left to fail silently.
const KNOWN_UNOWNED_ADMIN_ROUTES = new Set([
  "/admin",
  "/admin/ai-operations",
  "/admin/login",
  "/admin/update-password",
]);
const declaredRoutes = modules.flatMap((mod) => mod.routes);
for (const route of existingRoutes) {
  if (KNOWN_UNOWNED_ADMIN_ROUTES.has(route)) continue;
  const claimed = declaredRoutes.some(
    (declared) => route === declared || route.startsWith(`${declared}/`),
  );
  if (!claimed) {
    failures.push(
      `Admin page "${route}" exists but is not claimed by any module's routes[] and is not in KNOWN_UNOWNED_ADMIN_ROUTES, so it would never be gated when its intended module is disabled.`,
    );
  }
}

// --- AI tools ------------------------------------------------------------
// Resolve the runtime registry, including generated report tools, rather than
// confusing a source-code literal with a registered capability.
const runtimeTools = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "-e",
      `const {getRevenueAiTools,REVENUE_TOOL_PACKS}=require('./src/lib/revenue-os/ai-tools.ts'); process.stdout.write(JSON.stringify({registered:getRevenueAiTools().map(t=>t.name),packed:REVENUE_TOOL_PACKS.flatMap(p=>getRevenueAiTools(p).map(t=>t.name))}));`,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  ),
);
const registeredTools = new Set(runtimeTools.registered);
if (registeredTools.size < 5) {
  failures.push(
    `Only parsed ${registeredTools.size} tools from ai-tools.ts; the parser and the file have drifted.`,
  );
}
const claimedTools = new Map();
for (const mod of modules) {
  for (const tool of mod.aiToolNames) {
    if (!registeredTools.has(tool)) {
      failures.push(
        `Module "${mod.id}" declares aiToolName "${tool}", which is not registered in ai-tools.ts.`,
      );
    }
    if (claimedTools.has(tool)) {
      failures.push(
        `AI tool "${tool}" is claimed by both "${claimedTools.get(tool)}" and "${mod.id}". A tool belongs to exactly one module.`,
      );
    }
    claimedTools.set(tool, mod.id);
  }
}
for (const tool of registeredTools) {
  if (!claimedTools.has(tool)) {
    failures.push(
      `AI tool "${tool}" is registered but claimed by no module, so module gating would never apply to it. Add it to a module's aiToolNames in modules.ts.`,
    );
  }
}

// --- Tool pack coverage ---------------------------------------------------
// availabilityFor() marks any tool outside PACK_TOOL_NAMES unavailable, and
// ai-agent.ts always passes a pack, so a registered, module-claimed tool that
// no pack lists is permanently unreachable even though every other gate
// above it passes. This is the check that would have caught that.
const packedTools = new Set(runtimeTools.packed);
for (const tool of registeredTools) {
  if (!packedTools.has(tool))
    failures.push(
      `AI tool "${tool}" is registered but cannot be selected from any runtime tool pack.`,
    );
}

// --- Setup Center checks ---------------------------------------------------
const setupSource = read("src/app/api/admin/setup/route.ts");
const setupCheckIds = new Set(
  [...setupSource.matchAll(/^\s{6}id:\s*"([a-z_]+)",/gm)].map((m) => m[1]),
);
if (setupCheckIds.size < 10) {
  failures.push(
    `Only parsed ${setupCheckIds.size} checks from setup/route.ts; the parser and the file have drifted.`,
  );
}
for (const mod of modules) {
  for (const check of mod.setupChecks ?? []) {
    if (!setupCheckIds.has(check)) {
      failures.push(
        `Module "${mod.id}" declares setupChecks "${check}", which is not a real check id in src/app/api/admin/setup/route.ts.`,
      );
    }
  }
}

if (failures.length) {
  console.error(`Module contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      modules: modules.length,
      navLinks: navIds.size,
      adminRoutes: existingRoutes.size,
      aiTools: registeredTools.size,
      setupChecks: setupCheckIds.size,
    },
    null,
    2,
  ),
);

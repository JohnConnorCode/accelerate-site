#!/usr/bin/env node
/**
 * The capability data API (src/lib/revenue-os/capability-data-api.ts) is the
 * only data interface capability code may ever touch. That claim is only
 * true if no path exists from a capability to a raw database handle — which
 * cannot be established by review, because a future import is one line. So:
 *
 * 1. The boundary module itself must never manufacture a handle: no runtime
 *    import of a Supabase client factory (type-only imports are erased and
 *    carry no handle; the host wires the client in).
 * 2. It must export exactly the three shapes (plus shared types): a new
 *    export is a new primitive and needs its own card, not a drive-by.
 * 3. The extensions tree stays pure data: no TypeScript file under
 *    extensions/ may import a database client factory or any revenue-os
 *    service module (they may share nothing but types and pure validators).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const BOUNDARY_FILE = "src/lib/revenue-os/capability-data-api.ts";
// The three shapes, their inputs, and shared helper types. Anything else is
// a new primitive smuggled past review.
const ALLOWED_VALUE_EXPORTS = new Set([
  "queryCapabilityEntities",
  "runCapabilityRecipe",
  "getCapabilityNamespace",
  "setCapabilityNamespace",
]);
const HANDLE_FACTORY_PATTERN = /(createClient|createServerClient)\s*\(/;
const RUNTIME_SUPABASE_IMPORT =
  /import\s+(?!type\b)[^;]*from\s*["'](@supabase\/supabase-js|@supabase\/ssr)["']/;
const SERVER_MODULE_IMPORT =
  /import\s+(?!type\b)\{([^}]*)\}\s*from\s*["']@\/lib\/supabase\/(server|client)["']/;
// The single permitted runtime import: the tenant-binding enforcement
// itself. Everything else from the server/client modules is a handle path.
const ALLOWED_SERVER_IMPORTS = new Set(["bindTenantDatabase", "tenantIdForDatabase"]);

const failures = [];
const boundarySource = readFileSync(join(repoRoot, BOUNDARY_FILE), "utf8");

if (HANDLE_FACTORY_PATTERN.test(boundarySource)) {
  failures.push(
    `${BOUNDARY_FILE} manufactures a database handle. The host wires the client in; the boundary never creates one.`,
  );
}
if (RUNTIME_SUPABASE_IMPORT.test(boundarySource)) {
  failures.push(
    `${BOUNDARY_FILE} runtime-imports a Supabase client factory module. Type-only imports are allowed; runtime imports are a handle path.`,
  );
}
for (const match of boundarySource.matchAll(new RegExp(SERVER_MODULE_IMPORT.source, "g"))) {
  const names = match[1]
    .split(",")
    .map((n) => n.trim().split(" as ")[0].trim())
    .filter(Boolean);
  for (const name of names) {
    if (!ALLOWED_SERVER_IMPORTS.has(name)) {
      failures.push(
        `${BOUNDARY_FILE} imports "${name}" from a Supabase server module. Only tenant binding and tenant scope inspection are allowed; anything else is a handle path.`,
      );
    }
  }
}
const exportedValues = new Set();
for (const match of boundarySource.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm))
  exportedValues.add(match[1]);
for (const match of boundarySource.matchAll(/^export\s+const\s+(\w+)\s*=/gm))
  exportedValues.add(match[1]);
for (const name of exportedValues) {
  if (!ALLOWED_VALUE_EXPORTS.has(name)) {
    failures.push(
      `${BOUNDARY_FILE} exports "${name}", which is outside the three-shape contract (query, recipe, namespace get/set). New primitives need their own card.`,
    );
  }
}

function sourceFiles(dir) {
  const files = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) files.push(path);
  }
  return files;
}

for (const file of sourceFiles(join(repoRoot, "extensions"))) {
  const relative = file.slice(repoRoot.length);
  if (relative.endsWith(".d.ts")) continue;
  const source = readFileSync(file, "utf8");
  if (HANDLE_FACTORY_PATTERN.test(source) || RUNTIME_SUPABASE_IMPORT.test(source)) {
    failures.push(`${relative} reaches for a database handle. extensions/ stays pure data.`);
  }
  if (/from\s*["']@\/lib\/revenue-os\/[^"']*["']/.test(source)) {
    failures.push(
      `${relative} imports a revenue-os service module. Extensions may share nothing but types and pure validators.`,
    );
  }
}

if (failures.length) {
  console.error(`Capability isolation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  JSON.stringify({
    result: "passed",
    exports: [...ALLOWED_VALUE_EXPORTS],
    extensionsScanned: true,
  }),
);

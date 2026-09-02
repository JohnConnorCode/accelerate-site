#!/usr/bin/env node
/**
 * Validates every extensions/*.module.json manifest and regenerates
 * src/lib/revenue-os/extension-modules.generated.ts.
 *
 * This is the seam that lets a third party register a module without editing
 * a core array, while keeping the invariant modules.ts states plainly: no
 * dynamic execution of untrusted code. A manifest is data. It is validated
 * here, at build time, and compiled into a typed constant that the rest of the
 * app imports like any other module definition.
 *
 * Run with --check to verify the committed generated file is in sync without
 * writing anything, which is what CI does.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const extensionsDir = join(repoRoot, "extensions");
const generatedPath = join(repoRoot, "src/lib/revenue-os/extension-modules.generated.ts");
const checkOnly = process.argv.includes("--check");

/**
 * Icons an extension may name. Deliberately an allowlist rather than the whole
 * lucide surface: a manifest names an icon, it never supplies a component, and
 * the bundle should not grow because someone typed a new string.
 */
const ALLOWED_ICONS = [
  "Activity",
  "BarChart3",
  "Bot",
  "BriefcaseBusiness",
  "CalendarCheck",
  "FileCheck",
  "FileText",
  "Globe2",
  "Handshake",
  "Inbox",
  "KanbanSquare",
  "LayoutDashboard",
  "Library",
  "ListChecks",
  "Mail",
  "MailCheck",
  "MessageCircleMore",
  "MessageSquareText",
  "PlugZap",
  "RotateCcw",
  "Settings",
  "Target",
  "UserPlus",
  "UserRound",
  "UsersRound",
];

const CATEGORIES = ["revenue", "delivery", "intelligence", "sources", "system"];
const MORE_GROUPS = ["Revenue", "Delivery", "Intelligence", "System", "Sources"];
const SETTING_TYPES = ["string", "number", "boolean", "enum", "url"];

/**
 * Independent of the JSON Schema's own key pattern: a manifest author's
 * `label` or `description` can smuggle a secret-shaped field past a key
 * regex ("apiKey" fails the pattern, "Your API Key" as a label does not).
 * tenants.config, where every setting value is stored, reaches client
 * components, so this check exists specifically to catch that.
 */
const SECRET_LOOKING = /secret|token|password|api[_-]?key|credential/i;

/** Core module ids, read from the source of truth so this cannot drift. */
function coreModuleIds() {
  const source = readFileSync(join(repoRoot, "src/lib/revenue-os/modules.ts"), "utf8");
  const ids = new Set();
  for (const match of source.matchAll(/^\s{4}id:\s*"([a-z0-9-]+)",/gm)) ids.add(match[1]);
  return ids;
}

const failures = [];
function fail(file, message) {
  failures.push(`${file}: ${message}`);
}

function validateManifest(file, manifest, seenIds, seenNavIds, coreIds) {
  const req = ["id", "name", "description", "category", "defaultEnabled", "navLinks"];
  for (const key of req) {
    if (manifest[key] === undefined) fail(file, `missing required field "${key}"`);
  }
  if (typeof manifest.id === "string") {
    if (!/^[a-z][a-z0-9-]{2,48}$/.test(manifest.id))
      fail(file, `id "${manifest.id}" must be kebab-case, 3-49 chars`);
    if (coreIds.has(manifest.id))
      fail(file, `id "${manifest.id}" collides with a core module; core is not overridable`);
    if (seenIds.has(manifest.id))
      fail(file, `id "${manifest.id}" is already declared by ${seenIds.get(manifest.id)}`);
    seenIds.set(manifest.id, file);
  }
  if (manifest.category !== undefined && !CATEGORIES.includes(manifest.category))
    fail(file, `category "${manifest.category}" must be one of ${CATEGORIES.join(", ")}`);
  if (manifest.defaultEnabled !== undefined && typeof manifest.defaultEnabled !== "boolean")
    fail(file, "defaultEnabled must be a boolean");

  const navLinks = Array.isArray(manifest.navLinks) ? manifest.navLinks : [];
  if (!Array.isArray(manifest.navLinks)) fail(file, "navLinks must be an array");
  for (const link of navLinks) {
    for (const key of ["id", "label", "href", "icon", "description"]) {
      if (!link?.[key]) fail(file, `navLinks entry missing "${key}"`);
    }
    if (link?.icon && !ALLOWED_ICONS.includes(link.icon))
      fail(
        file,
        `navLinks icon "${link.icon}" is not in the allowlist. Add it to ALLOWED_ICONS in scripts/build-extension-modules.mjs and import it in src/lib/admin/extension-nav-icons.ts if it genuinely belongs.`,
      );
    if (link?.href && !link.href.startsWith("/admin/"))
      fail(file, `navLinks href "${link.href}" must start with /admin/`);
    if (link?.moreGroup && !MORE_GROUPS.includes(link.moreGroup))
      fail(file, `navLinks moreGroup "${link.moreGroup}" must be one of ${MORE_GROUPS.join(", ")}`);
    if (link?.id) {
      if (seenNavIds.has(link.id))
        fail(file, `navLinks id "${link.id}" is already declared by ${seenNavIds.get(link.id)}`);
      seenNavIds.set(link.id, file);
    }
  }
  for (const route of manifest.routes ?? []) {
    if (!String(route).startsWith("/admin/"))
      fail(file, `route "${route}" must start with /admin/`);
  }

  const seenSettingKeys = new Set();
  for (const setting of manifest.settings ?? []) {
    const key = setting?.key;
    if (!key || typeof key !== "string") {
      fail(file, "each settings entry needs a string key");
      continue;
    }
    if (seenSettingKeys.has(key)) fail(file, `settings key "${key}" is declared twice`);
    seenSettingKeys.add(key);
    if (SECRET_LOOKING.test(key) || SECRET_LOOKING.test(setting.label ?? ""))
      fail(
        file,
        `settings key "${key}" looks like a secret. Credentials go through integration-adapters.ts, never tenants.config.`,
      );
    if (!SETTING_TYPES.includes(setting.type))
      fail(file, `settings "${key}" type must be one of ${SETTING_TYPES.join(", ")}`);
    if (setting.type === "enum" && !(Array.isArray(setting.options) && setting.options.length))
      fail(file, `settings "${key}" is type enum but declares no options`);
    if (setting.type !== "enum" && setting.options)
      fail(file, `settings "${key}" declares options but is not type enum`);
  }
}

const manifests = [];
if (existsSync(extensionsDir)) {
  const coreIds = coreModuleIds();
  const seenIds = new Map();
  const seenNavIds = new Map();
  const files = readdirSync(extensionsDir)
    .filter((name) => name.endsWith(".module.json"))
    .sort();
  for (const name of files) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(extensionsDir, name), "utf8"));
    } catch (error) {
      fail(name, `is not valid JSON: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    validateManifest(name, manifest, seenIds, seenNavIds, coreIds);
    manifests.push(manifest);
  }
}

if (failures.length) {
  console.error(`Extension manifest validation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

const modules = manifests.map((manifest) => ({
  id: manifest.id,
  name: manifest.name,
  description: manifest.description,
  category: manifest.category,
  isCore: false,
  defaultEnabled: manifest.defaultEnabled,
  navLinkIds: (manifest.navLinks ?? []).map((link) => link.id),
  aiToolNames: manifest.aiToolNames ?? [],
  routes: manifest.routes ?? [],
  setupChecks: manifest.setupChecks ?? [],
  ...(manifest.docsUrl ? { docsUrl: manifest.docsUrl } : {}),
  ...(manifest.settings?.length ? { settings: manifest.settings } : {}),
}));

const navLinks = manifests.flatMap((manifest) =>
  (manifest.navLinks ?? []).map((link) => ({
    moduleId: manifest.id,
    id: link.id,
    label: link.label,
    href: link.href,
    icon: link.icon,
    description: link.description,
    ...(link.keywords ? { keywords: link.keywords } : {}),
    ...(link.moreGroup ? { moreGroup: link.moreGroup } : {}),
  })),
);

const rawGenerated = `// Generated by scripts/build-extension-modules.mjs. Do not edit by hand.
// Source of truth: extensions/*.module.json. Run \`npm run build:extensions\`
// after changing a manifest; CI fails if this file drifts from the manifests.
import type { RevenueOSModule } from "./modules";

/** Nav link icon names are validated against an allowlist at build time and
 *  resolved to components in src/lib/admin/extension-nav-icons.ts. */
export interface ExtensionNavLink {
  moduleId: string;
  id: string;
  label: string;
  href: string;
  icon: string;
  description: string;
  keywords?: string;
  moreGroup?: "Revenue" | "Delivery" | "Intelligence" | "System" | "Sources";
}

export const EXTENSION_MODULES: readonly RevenueOSModule[] = ${JSON.stringify(modules, null, 2)} as const;

export const EXTENSION_NAV_LINKS: readonly ExtensionNavLink[] = ${JSON.stringify(navLinks, null, 2)} as const;
`;

// Format with the repo's own prettier config. Without this the generated file
// and `npm run format:check` disagree forever: one of them rewrites the file,
// the other then reports it out of sync.
const prettierOptions = await prettier.resolveConfig(generatedPath);
const generated = await prettier.format(rawGenerated, {
  ...prettierOptions,
  filepath: generatedPath,
});

if (checkOnly) {
  const current = existsSync(generatedPath) ? readFileSync(generatedPath, "utf8") : "";
  if (current !== generated) {
    console.error(
      "src/lib/revenue-os/extension-modules.generated.ts is out of sync with extensions/*.module.json. Run: npm run build:extensions",
    );
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      { result: "in-sync", manifests: manifests.length, navLinks: navLinks.length },
      null,
      2,
    ),
  );
} else {
  writeFileSync(generatedPath, generated);
  console.log(
    JSON.stringify(
      { result: "generated", manifests: manifests.length, navLinks: navLinks.length },
      null,
      2,
    ),
  );
}

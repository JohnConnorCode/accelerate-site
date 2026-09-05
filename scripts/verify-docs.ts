#!/usr/bin/env tsx
/**
 * Gate precedent: scripts/verify-articles.ts. The manifest is the authority
 * for structure; MDX files hold only prose. Fails on orphans, missing pages,
 * forbidden frontmatter keys (section/order/kind/slug are derivable), and
 * conversion components or booking links (a docs page ending in a booking
 * call reads as marketing).
 *
 * --allow-missing downgrades missing MDX files to warnings so later volume
 * steps can land the spine before every page is written.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { docsManifest, flattenDocsPages } from "../src/content/docs/manifest";
import { capabilities } from "../src/content/command-center";
import { REVENUE_OS_MODULES } from "../src/lib/revenue-os/modules";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated";

const DOCS_DIR = path.join(process.cwd(), "src/content/docs");
const ALLOW_MISSING = process.argv.includes("--allow-missing");

const FORBIDDEN_FRONTMATTER = ["section", "order", "kind", "slug"];
const REQUIRED_FRONTMATTER = ["title", "description", "updated"];
const CONVERSION_COMPONENTS = ["<CTACard", "<BookCallButton", "<ArticleCTA", "<ToolRecommendation"];
const BOOKING_HREFS = ["/contact", "/plan-builder"];

const failures: string[] = [];
const warnings: string[] = [];

function walk(dir: string, base: string[] = []): string[][] {
  const out: string[][] = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) {
      if (name.name === "node_modules") continue;
      out.push(...walk(path.join(dir, name.name), [...base, name.name]));
    } else if (name.name.endsWith(".mdx")) {
      out.push([...base, name.name.replace(/\.mdx$/, "")]);
    }
  }
  return out;
}

// 1. Manifest shape: unique slugs, non-empty sections, overview-first.
{
  const seen = new Set<string>();
  for (const section of docsManifest) {
    if (!section.pages.length) failures.push(`Section "${section.id}" has no pages.`);
    const first = section.pages[0];
    if (first && first.slug[first.slug.length - 1] !== "overview") {
      failures.push(
        `Section "${section.id}" must start with its overview page (directory collapse target).`,
      );
    }
    for (const page of section.pages) {
      const key = page.slug.join("/");
      if (seen.has(key)) failures.push(`Duplicate manifest slug "${key}".`);
      seen.add(key);
      if (!page.title.trim() || !page.description.trim()) {
        failures.push(`Manifest page "${key}" needs a title and description.`);
      }
    }
  }
}

// 2. Every manifest page resolves to an MDX file.
const manifestKeys = new Set(flattenDocsPages().map((p) => p.slug.join("/")));
for (const key of manifestKeys) {
  const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
  if (!fs.existsSync(file)) {
    const message = `Manifest page "${key}" has no MDX file.`;
    if (ALLOW_MISSING) warnings.push(message);
    else failures.push(message);
  }
}

// 3. No orphan MDX files: everything on disk is in the manifest.
for (const slug of walk(DOCS_DIR)) {
  if (!manifestKeys.has(slug.join("/"))) {
    failures.push(`Orphan MDX "src/content/docs/${slug.join("/")}.mdx" is not in the manifest.`);
  }
}

// 4. Frontmatter contract per file.
for (const key of manifestKeys) {
  const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
  if (!fs.existsSync(file)) continue;
  const { data, content } = matter(fs.readFileSync(file, "utf-8"));
  for (const field of REQUIRED_FRONTMATTER) {
    if (typeof data[field] !== "string" || !data[field].trim()) {
      failures.push(`"${key}" frontmatter needs a non-empty "${field}".`);
    }
  }
  for (const field of FORBIDDEN_FRONTMATTER) {
    if (data[field] !== undefined) {
      failures.push(
        `"${key}" frontmatter must not carry "${field}" (derivable; manifest owns it).`,
      );
    }
  }
  if (typeof data.updated === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
    failures.push(`"${key}" frontmatter "updated" must be YYYY-MM-DD.`);
  }
  for (const tag of CONVERSION_COMPONENTS) {
    if (content.includes(tag)) {
      failures.push(`"${key}" must not use conversion component ${tag} (docs are not marketing).`);
    }
  }
  for (const href of BOOKING_HREFS) {
    const linkPattern = new RegExp(`\\]\\(\\s*${href.replace("/", "\\/")}[^)]*\\)`);
    if (linkPattern.test(content)) {
      failures.push(
        `"${key}" must not link to "${href}" (a docs page ending in a booking call reads as marketing).`,
      );
    }
  }
}

// 5. Reserved slugs must not collide with generated public boards.
for (const key of manifestKeys) {
  const leaf = key.split("/").pop();
  if (leaf === "roadmap" || leaf === "changelog") {
    failures.push(
      `Slug "${key}" duplicates the generated ${leaf} page. Point at it; do not restate it.`,
    );
  }
}

// 6. Internal /docs links resolve to a manifest slug or section id.
const docsHrefs = new Set([
  "/docs",
  ...docsManifest.map((section) => `/docs/${section.id}`),
  ...flattenDocsPages().map((page) => `/docs/${page.slug.join("/")}`),
]);
for (const key of manifestKeys) {
  const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
  if (!fs.existsSync(file)) continue;
  const { content } = matter(fs.readFileSync(file, "utf-8"));
  for (const match of content.matchAll(/\]\((\/docs\/[^)\s]+)\)/g)) {
    const href = (match[1] ?? "").replace(/\/$/, "");
    if (href && !docsHrefs.has(href)) {
      failures.push(`"${key}" links to "${href}", which is not a docs manifest slug.`);
    }
  }
}

// 7. Capability list and AI tool list each have exactly one owner page.
const catalogOwners: string[] = [];
const toolOwners: string[] = [];
for (const key of manifestKeys) {
  const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
  if (!fs.existsSync(file)) continue;
  const { content } = matter(fs.readFileSync(file, "utf-8"));
  if (content.includes("<DocsCapabilityCatalog")) catalogOwners.push(key);
  if (content.includes("<DocsAiToolCatalog")) toolOwners.push(key);
}
if (catalogOwners.length !== 1) {
  failures.push(
    `DocsCapabilityCatalog must appear on exactly one page so command-center capabilities are claimed once, found ${catalogOwners.join(", ") || "none"}.`,
  );
}
if (toolOwners.length !== 1) {
  failures.push(
    `DocsAiToolCatalog must appear on exactly one page so registered AI tools are claimed once, found ${toolOwners.join(", ") || "none"}.`,
  );
}
if (!capabilities.length) {
  failures.push("command-center.ts exported no capabilities; the catalog would be empty.");
}

// 8. Non-extension modules and user-guide sections are a bijection via docsUrl.
const extensionIds = new Set(EXTENSION_MODULES.map((mod) => mod.id));
const firstPartyIds = new Set(
  REVENUE_OS_MODULES.filter((mod) => !extensionIds.has(mod.id)).map((mod) => mod.id),
);
const claimed = new Map<string, string>();
for (const section of docsManifest) {
  for (const moduleId of section.modules ?? []) {
    if (claimed.has(moduleId)) {
      failures.push(
        `Module "${moduleId}" is documented by both "${claimed.get(moduleId)}" and "${section.id}".`,
      );
    }
    claimed.set(moduleId, section.id);
    const mod = REVENUE_OS_MODULES.find((item) => item.id === moduleId);
    if (!mod) {
      failures.push(
        `Section "${section.id}" names module "${moduleId}", which is not in the registry.`,
      );
      continue;
    }
    const expected = `/docs/${section.id}`;
    if (mod.docsUrl !== expected) {
      failures.push(
        `Module "${moduleId}" docsUrl is "${mod.docsUrl ?? "(missing)"}"; it must be "${expected}".`,
      );
    }
  }
}
for (const moduleId of firstPartyIds) {
  if (!claimed.has(moduleId)) {
    failures.push(`Module "${moduleId}" is not claimed by any user-guide section's modules list.`);
  }
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (failures.length) {
  console.error(`verify:docs failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `verify:docs passed: ${manifestKeys.size} manifest page(s)${ALLOW_MISSING ? " (allow-missing)" : ""}.`,
);

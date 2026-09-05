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

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (failures.length) {
  console.error(`verify:docs failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `verify:docs passed: ${manifestKeys.size} manifest page(s)${ALLOW_MISSING ? " (allow-missing)" : ""}.`,
);

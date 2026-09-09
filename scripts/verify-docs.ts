#!/usr/bin/env tsx
/**
 * Gate precedent: scripts/verify-articles.ts. The manifest is the authority
 * for structure; MDX files hold only prose. Fails on orphans, missing pages,
 * forbidden frontmatter keys (section/order/kind/slug are derivable), and
 * conversion components or booking links (a docs page ending in a booking
 * call reads as marketing).
 *
 * Source mode runs without a build. --strict also checks real prerendered
 * routes and rendered references. --report returns findings without treating
 * incomplete coverage as a strict pass; --allow-missing is a report alias.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { docsManifest as defaultManifest, type DocsSection } from "../src/content/docs/manifest";
import { capabilities as defaultCapabilities } from "../src/content/command-center";
import { REVENUE_OS_MODULES } from "../src/lib/revenue-os/modules";
import { EXTENSION_MODULES } from "../src/lib/revenue-os/extension-modules.generated";

export type DocsInspectionInput = {
  docsDir?: string;
  manifest?: DocsSection[];
  modules?: Array<{ id: string; docsUrl?: string }>;
  extensionIds?: string[];
  capabilityIds?: string[];
  toolIds?: string[];
  allowMissing?: boolean;
  requireBuild?: boolean;
  prerenderRoutes?: string[];
  renderedPages?: Record<string, string>;
};

function visibleSource(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

export function inspectDocs(input: DocsInspectionInput = {}) {
  const DOCS_DIR = input.docsDir ?? path.join(process.cwd(), "src/content/docs");
  const ALLOW_MISSING = input.allowMissing ?? false;
  const docsManifest = input.manifest ?? defaultManifest;
  const flattenDocsPages = () => docsManifest.flatMap((section) => section.pages);
  const modules = input.modules ?? REVENUE_OS_MODULES;
  const capabilityIds = input.capabilityIds ?? defaultCapabilities.map((item) => item.id);
  const FORBIDDEN_FRONTMATTER = ["section", "order", "kind", "slug"];
  const REQUIRED_FRONTMATTER = ["title", "description", "updated"];
  const CONVERSION_COMPONENTS = [
    "<CTACard",
    "<BookCallButton",
    "<ArticleCTA",
    "<ToolRecommendation",
  ];
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
    let sawBuilder = false;
    for (const section of docsManifest) {
      if (!section.pages.length) failures.push(`Section "${section.id}" has no pages.`);
      const first = section.pages[0];
      if (first && first.slug[first.slug.length - 1] !== "overview") {
        failures.push(
          `Section "${section.id}" must start with its overview page (directory collapse target).`,
        );
      }
      if (!section.track) {
        failures.push(`Section "${section.id}" needs a track ("operator" or "builder").`);
      } else {
        if (section.track === "operator" && sawBuilder) {
          failures.push(
            `Section "${section.id}" is an operator section listed after a builder section; ` +
              `every operator section must come before every builder section so the pager and ` +
              `sidebar can treat each track as one contiguous run.`,
          );
        }
        if (section.track === "builder") sawBuilder = true;
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
    const proseOnly = visibleSource(content)
      .replace(/<[^>]*>/g, "")
      .replace(/^\s*#+.*$/gm, "")
      .trim();
    if (
      !proseOnly ||
      /^(?:TODO|TBD|Coming soon|Under construction|Placeholder)[.!:]?\s*$/im.test(proseOnly)
    ) {
      failures.push(`"${key}" has empty or placeholder prose; write the actual task guidance.`);
    }
    for (const field of REQUIRED_FRONTMATTER) {
      if (typeof data[field] !== "string" || !data[field].trim()) {
        failures.push(`"${key}" frontmatter needs a non-empty "${field}".`);
      }
    }
    const entry = flattenDocsPages().find((page) => page.slug.join("/") === key);
    if (entry && (entry.title !== data.title || entry.description !== data.description)) {
      failures.push(
        `"${key}" title/description must match the manifest so navigation and search agree with the page.`,
      );
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
        failures.push(
          `"${key}" must not use conversion component ${tag} (docs are not marketing).`,
        );
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

  // 6. Internal docs links resolve to a manifest route; fragments do not change route ownership.
  const fragments: Array<{ page: string; href: string; route: string; id: string }> = [];
  const docsHrefs = new Set([
    "/docs",
    ...docsManifest.map((section) => `/docs/${section.id}`),
    ...flattenDocsPages().map((page) => `/docs/${page.slug.join("/")}`),
  ]);
  for (const key of manifestKeys) {
    const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
    if (!fs.existsSync(file)) continue;
    const { content } = matter(fs.readFileSync(file, "utf8"));
    const prose = visibleSource(content);
    const links = [
      ...prose.matchAll(/\]\(\s*([^\s)]+)(?:\s+"[^"]*")?\s*\)|\bhref=["']([^"']+)["']/g),
    ];
    for (const match of links) {
      const href = match[1] ?? match[2] ?? "";
      if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) continue;
      const url = new URL(href, `https://docs.invalid/docs/${key}`);
      const resolved = url.pathname.replace(/\/$/, "");
      if (url.hash && docsHrefs.has(resolved)) {
        try {
          fragments.push({
            page: key,
            href,
            route: resolved,
            id: decodeURIComponent(url.hash.slice(1)),
          });
        } catch {
          failures.push(`"${key}" has an invalid encoded fragment in "${href}".`);
        }
      }
      if ((resolved === "/docs" || resolved.startsWith("/docs/")) && !docsHrefs.has(resolved))
        failures.push(
          `"${key}" links to "${href}", which resolves to missing docs route "${resolved}".`,
        );
    }
  }

  // 7. Capability list and AI tool list each have exactly one owner page.
  const catalogOwners: string[] = [];
  const toolOwners: string[] = [];
  for (const key of manifestKeys) {
    const file = path.join(DOCS_DIR, ...key.split("/")) + ".mdx";
    if (!fs.existsSync(file)) continue;
    const { content } = matter(fs.readFileSync(file, "utf-8"));
    const visible = visibleSource(content);
    catalogOwners.push(
      ...[...visible.matchAll(/<DocsCapabilityCatalog(?:\s|\/?>)/g)].map(() => key),
    );
    toolOwners.push(...[...visible.matchAll(/<DocsAiToolCatalog(?:\s|\/?>)/g)].map(() => key));
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
  if (!capabilityIds.length) {
    failures.push("command-center.ts exported no capabilities; the catalog would be empty.");
  }

  // 8. Non-extension modules and user-guide sections are a bijection via docsUrl.
  const extensionIds = new Set(input.extensionIds ?? EXTENSION_MODULES.map((mod) => mod.id));
  // Bundled examples need an individual public guide, not a repository README
  // or a generic extension landing page. Existing page checks verify its prose.
  for (const id of extensionIds) {
    const pluginModule = modules.find((item) => item.id === id);
    const expected = `/docs/plugins/${id}`;
    if (!pluginModule || pluginModule.docsUrl !== expected || !manifestKeys.has(`plugins/${id}`)) {
      failures.push(
        `Bundled plugin "${id}" needs its dedicated public guide at "${expected}" and matching docsUrl.`,
      );
    }
  }
  const firstPartyIds = new Set(
    modules.filter((mod) => !extensionIds.has(mod.id)).map((mod) => mod.id),
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
      const mod = modules.find((item) => item.id === moduleId);
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
      failures.push(
        `Module "${moduleId}" is not claimed by any user-guide section's modules list.`,
      );
    }
  }

  const sourcePassed = failures.length === 0 && warnings.length === 0;
  const requiredRoutes = [...docsHrefs].sort();
  if (input.requireBuild && !input.prerenderRoutes) {
    failures.push("Build evidence is missing: run npm run build, then verify:docs -- --strict.");
  }
  if (input.prerenderRoutes) {
    const actual = new Set(
      input.prerenderRoutes.filter((route) => route === "/docs" || route.startsWith("/docs/")),
    );
    for (const route of requiredRoutes)
      if (!actual.has(route))
        failures.push(
          `Documentation route "${route}" is missing from the build prerender manifest.`,
        );
    for (const route of actual)
      if (!docsHrefs.has(route))
        failures.push(`Orphan prerendered documentation route "${route}" is not in the manifest.`);
    for (const fragment of fragments) {
      const html = input.renderedPages?.[fragment.route] ?? "";
      if (![...html.matchAll(/\bid="([^"]+)"/g)].some((match) => match[1] === fragment.id)) {
        failures.push(`"${fragment.page}" links to missing built anchor "${fragment.href}".`);
      }
    }
    for (const [owner, ids, name] of [
      [catalogOwners[0], capabilityIds, "capability"],
      [toolOwners[0], input.toolIds, "AI tool"],
    ] as const) {
      if (!ids?.length) {
        failures.push(`No registered ${name} IDs supplied for built-reference verification.`);
        continue;
      }
      const route = owner ? `/docs/${owner}` : undefined;
      const html = route ? input.renderedPages?.[route] : undefined;
      if (!html) {
        failures.push(`Built ${name} reference HTML is missing for ${route ?? "unowned catalog"}.`);
        continue;
      }
      for (const id of ids) {
        const matches = [...html.matchAll(/\bid="([^"]+)"/g)].filter((match) => match[1] === id);
        if (matches.length !== 1)
          failures.push(
            `Built ${name} reference "${route}" must contain ID "${id}" exactly once; found ${matches.length}.`,
          );
      }
    }
  }
  return {
    failures,
    warnings,
    pages: manifestKeys.size,
    requiredRoutes,
    catalogPages: [...catalogOwners, ...toolOwners].map((key) => `/docs/${key}`),
    sourcePassed,
    strictPassed: failures.length === 0 && warnings.length === 0 && !!input.prerenderRoutes,
    buildChecked: !!input.prerenderRoutes,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const report = args.includes("--report") || args.includes("--allow-missing");
  const strict = args.includes("--strict") || args.includes("--prerender");
  const input: DocsInspectionInput = {
    allowMissing: args.includes("--allow-missing"),
    requireBuild: strict,
  };
  if (strict) {
    const at = args.indexOf("--prerender");
    const manifestPath = at >= 0 ? args[at + 1] : ".next/prerender-manifest.json";
    if (!manifestPath || manifestPath.startsWith("--"))
      throw new Error("--prerender requires a build manifest path");
    if (fs.existsSync(manifestPath)) {
      const build = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      input.prerenderRoutes = Object.keys(build.routes ?? {});
      const source = inspectDocs();
      input.renderedPages = Object.fromEntries(
        source.requiredRoutes.map((route) => {
          const file = path.join(path.dirname(manifestPath), "server/app", route + ".html");
          return [route, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""];
        }),
      );
      const { getRevenueAiTools } = await import("../src/lib/revenue-os/ai-tools");
      input.toolIds = getRevenueAiTools().map((tool) => tool.name);
    }
  }
  const result = inspectDocs(input);
  if (report || args.includes("--json")) {
    console.log(
      JSON.stringify(
        { mode: report ? "report" : strict ? "strict" : "source", ...result },
        null,
        2,
      ),
    );
  } else {
    for (const issue of [...result.failures, ...result.warnings]) console.error(`- ${issue}`);
    console.log(
      `Documentation ${strict ? "build and source" : "source"} coverage: ${result.pages} pages; ${result.failures.length} errors, ${result.warnings.length} warnings. Full strict coverage: ${result.strictPassed ? "passed" : "not established"}.`,
    );
  }
  if (!report && (result.failures.length || result.warnings.length)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

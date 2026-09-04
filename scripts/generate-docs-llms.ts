#!/usr/bin/env tsx
/**
 * Generates the machine-readable docs index (llms.txt style) from the docs
 * manifest plus live frontmatter, with a --check mode for CI.
 *
 * A static file in public/ shadows any route handler at the same path, so
 * this is a build script, not a route: it writes public/docs-llms.txt and
 * fails --check when the file is stale. Delete the generated file and the
 * old hand-written marketing sheets it replaces never come back.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { docsManifest } from "../src/content/docs/manifest";

const OUT_FILE = path.join(process.cwd(), "public/docs-llms.txt");
const BASE_URL = "https://www.acceleratewith.us";
const CHECK = process.argv.includes("--check");

function pageFile(slug: string[]): string {
  return path.join(process.cwd(), "src/content/docs", ...slug) + ".mdx";
}

function build(): string {
  const lines: string[] = [
    "# Accelerate Documentation",
    "> Practical guides for working with Accelerate and running the Command Center.",
    "",
  ];
  for (const section of docsManifest) {
    lines.push(`## ${section.title}`);
    lines.push(section.description);
    lines.push("");
    for (const page of section.pages) {
      const file = pageFile(page.slug);
      let description = page.description;
      let updated = "";
      if (fs.existsSync(file)) {
        const { data } = matter(fs.readFileSync(file, "utf-8"));
        if (typeof data.description === "string" && data.description.trim()) {
          description = data.description.trim();
        }
        if (typeof data.updated === "string") updated = data.updated;
      }
      const stamp = updated ? ` (updated ${updated})` : "";
      lines.push(
        `- [${page.title}](${BASE_URL}/docs/${page.slug.join("/")})${stamp}: ${description}`,
      );
    }
    lines.push("");
  }
  lines.push(`- [Documentation landing](${BASE_URL}/docs): all guides.`);
  lines.push("");
  return lines.join("\n");
}

const built = build();
if (CHECK) {
  const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf-8") : null;
  if (current !== built) {
    console.error(
      "docs llms index is stale: run `npm run docs:llms` and commit public/docs-llms.txt.",
    );
    process.exit(1);
  }
  console.log("docs llms index is current.");
} else {
  fs.writeFileSync(OUT_FILE, built);
  console.log(`Wrote ${OUT_FILE} (${built.length} bytes).`);
}

// Enforces docs/contracts/BRAND-SYSTEM.md in source so the system cannot drift:
// no serif faces, display tracking no tighter than -0.04em, no text under
// 10.5px, signal orange defined only by the token files, admin code on admin
// tokens, and table headers styled only by the shared .admin-table anatomy.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const src = join(root, "src");
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|tsx|ts)$/.test(name)) files.push(path);
  }
}
walk(src);

// Tenants may still choose a serif face for their own workspace, website or invoices.
const serifAllowed = new Set([
  "src/lib/admin/theme-definition.ts",
  "src/app/layout.tsx",
  "src/lib/site-studio/website-theme.ts",
  "src/components/business/InvoiceDocument.tsx",
  "src/components/admin/InvoicePageDesigner.module.css",
]);
const signalAllowed = new Set([
  "src/app/globals.css",
  "src/app/admin-themes.css",
  "src/lib/admin/themes.json",
]);
const failures = [];
const px = (value, unit) => (unit === "rem" ? Number(value) * 16 : Number(value));

for (const file of files) {
  const path = relative(root, file);
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  if (/^src\/(app\/admin|components\/admin)\//.test(path)) {
    for (const match of source.matchAll(/<th\b[^>]*>/g)) {
      if (
        /className=[\s\S]*(?<![\w-])(?:p[xy]?-[\d.]+|uppercase|tracking-|font-mono)\b/.test(
          match[0],
        )
      ) {
        const line = source.slice(0, match.index).split("\n").length;
        failures.push(
          `${path}:${line} restyles a table header; .admin-table th owns header type and spacing`,
        );
      }
    }
  }
  lines.forEach((line, index) => {
    const at = `${path}:${index + 1}`;
    // A documented exception sits on the line before: /* brand-system: allow (reason) */
    if ((lines[index - 1] ?? "").includes("brand-system: allow")) return;
    if (
      !serifAllowed.has(path) &&
      /var\(--(font-editorial|font-serif|serif)\)|\bfont-serif\b|Newsreader|Georgia, serif/.test(
        line,
      ) &&
      !/^\s*--font-editorial: var\(--font-editorial\);/.test(line)
    )
      failures.push(`${at} uses a serif face`);
    for (const match of line.matchAll(
      /tracking-\[-(\d*\.\d+)em\]|letter-spacing:\s*-(\d*\.\d+)em|letterSpacing:\s*"-(\d*\.\d+)em"/g,
    )) {
      const value = Number(match[1] ?? match[2] ?? match[3]);
      if (value > 0.04) failures.push(`${at} tracks tighter than -0.04em (-${value}em)`);
    }
    for (const match of line.matchAll(
      /text-\[(\d*\.?\d+)(px|rem)\]|font(?:-size)?:\s*(?:\d{3}\s+)?(\d*\.?\d+)(px|rem)\b/g,
    )) {
      const size = px(match[1] ?? match[3], match[2] ?? match[4]);
      if (size < 10.5) failures.push(`${at} sets text below 10.5px (${size}px)`);
    }
    // Headings use the --type-* scale; nothing outgrows the 68px display cap.
    for (const match of line.matchAll(
      /(?:text-\[|font-size:\s*|font:[^;]*?)clamp\([^,]+,[^,]+,\s*(\d*\.?\d+)(px|rem)\)/g,
    )) {
      const size = px(match[1], match[2]);
      if (size > 68) failures.push(`${at} sets a heading above the 68px display cap (${size}px)`);
    }
    if (!signalAllowed.has(path) && /#(ff5a1f|c2410c|ff7a45)\b/i.test(line))
      failures.push(`${at} hard-codes signal orange; use --signal or --admin-accent`);
    if (!/^src\/(app\/admin|components\/admin)\//.test(path)) return;
    if (
      /(?<![\w-])(?:text-white-(?:primary|secondary|muted)|border-border-glass|bg-bg-(?:elevated|subtle)|(?:text|border|ring)-gold)(?![\w-])/.test(
        line,
      )
    )
      failures.push(`${at} uses a marketing-site color class; use the --admin-* tokens`);
  });
}

if (failures.length) {
  console.error(`Brand system contract failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`Brand system contract passed across ${files.length} source files.`);

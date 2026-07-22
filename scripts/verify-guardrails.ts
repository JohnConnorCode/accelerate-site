/**
 * Guardrail checks — fast, static, no browser. Turns the manual audit
 * (2026-07) into enforcement so regressions can't slip through silently the
 * way "Every call answered" did for 18 rounds.
 *
 * Run: npm run verify:guardrails   (also wired into the pre-commit hook)
 * Exits non-zero on any failure.
 *
 * Covers three regression classes that actually bit us:
 *   1. Banned call-centric / stale-CTA copy in live components + content.
 *   2. Article <title>/description lengths that truncate in search results.
 *   3. API routes that write to the DB without checking the error.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const ROOT = process.cwd();
const failures: string[] = [];

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

/** Strip // line comments and block comments so we only check real copy. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ── 1. Banned copy ──────────────────────────────────────────────────────────
// John's hard rules: Accelerate is channel-agnostic (never call-centric in
// identity/product copy), and the CTA is "strategy call", never "discovery".
const BANNED: { re: RegExp; why: string }[] = [
  { re: /every call answered/i, why: 'call-centric ("every call answered") — use channel-agnostic' },
  { re: /answer(?:ed|s)? every call/i, why: 'call-centric ("answer every call")' },
  { re: /missed[ -]calls?\b/i, why: 'call-centric ("missed call")' },
  { re: /incoming calls?\b/i, why: 'call-centric ("incoming call")' },
  { re: /\bdiscovery call\b/i, why: 'stale CTA ("discovery call") — should be "strategy call"' },
];
// Scan live components + content data. SEO articles (src/content/articles) are
// exempt: they intentionally rank for call-related terms and use "discovery
// call" in generic advice, per the positioning rules.
const copyFiles = [
  ...walk(path.join(ROOT, "src/components"), [".tsx", ".ts"]),
  ...walk(path.join(ROOT, "src/content"), [".ts"]),
  ...walk(path.join(ROOT, "src/lib/chat"), [".ts"]),
];
for (const file of copyFiles) {
  const body = stripComments(fs.readFileSync(file, "utf8"));
  for (const { re, why } of BANNED) {
    const m = body.match(re);
    if (m) failures.push(`BANNED COPY  ${path.relative(ROOT, file)}: "${m[0]}" — ${why}`);
  }
}

// ── 2. Article SEO lengths ──────────────────────────────────────────────────
// Articles opt out of the "| Accelerate" template (absoluteTitle), so the
// rendered <title> IS the seoTitle. Google truncates ~60 chars / ~160 desc.
const ARTICLES = path.join(ROOT, "src/content/articles");
for (const file of walk(ARTICLES, [".mdx"])) {
  const { data } = matter(fs.readFileSync(file, "utf8"));
  const slug = path.basename(file, ".mdx");
  const title: string = data.seoTitle || data.title || "";
  const desc: string = data.seoDescription || data.excerpt || "";
  if (title.length > 60) failures.push(`SEO TITLE   ${slug}: ${title.length} chars > 60 (truncates in search)`);
  if (desc.length > 160) failures.push(`SEO DESC    ${slug}: ${desc.length} chars > 160 (truncates in search)`);
  if (desc.length > 0 && desc.length < 70) failures.push(`SEO DESC    ${slug}: ${desc.length} chars < 70 (thin snippet)`);
}

// ── 3. API DB-write error handling ──────────────────────────────────────────
// Every route that inserts/upserts must inspect the returned error, or a DB
// failure silently returns success and the lead is lost (the June bug).
const apiRoutes = walk(path.join(ROOT, "src/app/api"), [".ts"]).filter((f) => f.endsWith("route.ts"));
for (const file of apiRoutes) {
  const body = fs.readFileSync(file, "utf8");
  const writes = /\.(insert|upsert)\s*\(/.test(body);
  if (!writes) continue;
  const checksError = /(?:error:\s*\w+|\bdbError\b|\binsertError\b|if\s*\(\s*\w*[Ee]rror)/.test(body);
  if (!checksError) failures.push(`DB ERROR    ${path.relative(ROOT, file)}: writes to DB but never checks the returned error`);
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n❌ ${failures.length} guardrail failure(s):\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log("✅ Guardrails passed — no banned copy, SEO lengths in range, all DB routes error-checked.");

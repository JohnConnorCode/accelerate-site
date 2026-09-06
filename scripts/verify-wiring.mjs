#!/usr/bin/env node
/**
 * Makes "shipped" mechanically earned instead of self-reported prose.
 *
 * Every check here is a regression test for a real defect this repo shipped
 * and called done, not a hypothetical:
 *   - agent_memory/learned_policies/budget_limits/budget_usage were queried
 *     by memory.ts/budgets.ts for months with no migration ever creating
 *     them (fixed in migrations/20260903-agent-memory-and-budgets.sql).
 *   - work-executor.ts's four .catch(() => []) / .catch(() => {}) sites
 *     silently no-opped every gate failure (fixed the same commit).
 *   - /api/cron/work-engine, the sole entrypoint for the whole autonomous
 *     loop, was never registered in vercel.json — the loop had never run.
 *   - mcp-client.ts and agent-activity.ts shipped with zero UI/runtime
 *     callers ("Add Agent Activity surfaces" was marked shipped with no
 *     surface anywhere).
 *
 * Run standalone (`npm run verify:wiring`) or via `collectWiringFailures()`,
 * which `verify-agent-contract.mjs` calls so every required verification
 * pass covers this too.
 *
 * Exceptions are real and expected — not every module needs a caller today
 * (a freshly landed primitive awaiting its first consumer, a deliberately
 * best-effort telemetry catch). List them in WIRING_ALLOWLIST below with a
 * reason. An allowlist entry is a decision, not a way to make a red check
 * green — read the reason before adding to it, and remove entries once
 * they're wired.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

// -----------------------------------------------------------------------------
// Allowlist: { failureId: "reason" }. failureId is the exact string printed
// before " ::" in a failure line below — copy it verbatim from a failing run.
// -----------------------------------------------------------------------------
export const WIRING_ALLOWLIST = {
  "unwired-module:delivery-handoff.ts":
    "Existing partial won-to-delivery-handoff service (7712951); operator route, demo and browser acceptance remain incomplete on that card. Merge does not claim delivery wiring.",
  "unwired-module:capability-data-api.ts":
    "Tested capability primitive awaiting the plugin host; host invocation remains a distinct acceptance item. See northstar-runtime-consolidation audit.",
  "unwired-module:plugin-isolate.ts":
    "Standalone tested isolate primitive; host integration is explicitly not claimed by plugin-isolate-host. See northstar-runtime-consolidation audit.",
  "unwired-module:mcp-client.ts":
    "Standalone external MCP client awaiting host integration; tests establish the primitive only, not production wiring. See northstar-runtime-consolidation audit.",
};

// -----------------------------------------------------------------------------
// Baseline: pre-existing findings snapshotted when each check was introduced,
// so the gate fails on new regressions without retroactively failing the
// whole legacy codebase in one commit. See scripts/verify-wiring-baseline.json
// for the burn-down note. Regenerate after fixing an entry by re-running the
// generator in that file's own comment, or just delete the fixed line.
// -----------------------------------------------------------------------------
const BASELINE_PATH = "scripts/verify-wiring-baseline.json";
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : { unknownTables: [], swallowedCatchFiles: [], unregisteredCronRoutes: [], unwiredModules: [] };
const baselineSets = {
  unknownTables: new Set(baseline.unknownTables ?? []),
  swallowedCatchFiles: new Set(baseline.swallowedCatchFiles ?? []),
  unregisteredCronRoutes: new Set(baseline.unregisteredCronRoutes ?? []),
  unwiredModules: new Set(baseline.unwiredModules ?? []),
};

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith("."))
      continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

function readAll(files) {
  const map = new Map();
  for (const file of files) map.set(file, readFileSync(file, "utf8"));
  return map;
}

function allowed(id) {
  return Object.prototype.hasOwnProperty.call(WIRING_ALLOWLIST, id);
}

// -----------------------------------------------------------------------------
// Check 1: every src/lib/revenue-os/*.ts module has a caller outside itself,
// or a test that names it.
// -----------------------------------------------------------------------------
export function findUnwiredModules() {
  const failures = [];
  const moduleDir = "src/lib/revenue-os";
  const moduleFiles = walk(moduleDir, [".ts"]).filter((f) => !f.endsWith(".d.ts"));
  const candidateFiles = [
    ...walk("src/app", [".ts", ".tsx"]),
    ...walk("src/components", [".ts", ".tsx"]),
    ...walk("src/lib", [".ts", ".tsx"]),
    ...walk("scripts", [".ts", ".mjs"]).filter((file) => !/\/(test|qa|verify)-/.test(file)),
  ];
  const contents = readAll(candidateFiles);

  for (const file of moduleFiles) {
    const name = basename(file, ".ts");
    const id = `unwired-module:${name}.ts`;
    if (allowed(id) || baselineSets.unwiredModules.has(`${name}.ts`)) continue;

    let hasCaller = false;
    for (const [candidate, content] of contents) {
      if (candidate === file) continue;
      if (content.includes(`revenue-os/${name}"`) || content.includes(`revenue-os/${name}'`)) {
        hasCaller = true;
        break;
      }
      // A sibling import inside the same directory only counts as a real
      // caller if the candidate itself lives in src/lib/revenue-os.
      if (
        candidate.startsWith(moduleDir + "/") &&
        (content.includes(`"./${name}"`) || content.includes(`'./${name}'`))
      ) {
        hasCaller = true;
        break;
      }
    }
    if (!hasCaller) {
      failures.push(
        `${id} :: src/lib/revenue-os/${name}.ts has no runtime caller outside itself; tests are not execution wiring`,
      );
    }
  }
  return failures;
}

// -----------------------------------------------------------------------------
// Check 2: every table a `supabase.from("...")` / `sb.from("...")` call
// names actually has a migration that creates it (or a view over one).
// -----------------------------------------------------------------------------
export function findUnknownTables() {
  const failures = [];
  const migrationFiles = walk("migrations", [".sql"]);
  const created = new Set();
  const createRegex =
    /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|MATERIALIZED\s+VIEW)(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  for (const file of migrationFiles) {
    const content = readFileSync(file, "utf8");
    let m;
    while ((m = createRegex.exec(content))) created.add(m[1]);
  }

  const sourceFiles = [...walk("src", [".ts", ".tsx"]), ...walk("scripts", [".ts", ".mjs"])];
  const usedIn = new Map();
  const fromRegex = /\b(?:supabase|sb)\.from\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/g;
  for (const file of sourceFiles) {
    const content = readFileSync(file, "utf8");
    for (const line of content.split("\n")) {
      if (line.includes(".storage.from(")) continue; // storage bucket, not a DB table
      let m;
      fromRegex.lastIndex = 0;
      while ((m = fromRegex.exec(line))) {
        const table = m[1];
        if (!usedIn.has(table)) usedIn.set(table, file);
      }
    }
  }

  for (const [table, file] of usedIn) {
    const id = `unknown-table:${table}`;
    if (allowed(id) || baselineSets.unknownTables.has(table)) continue;
    if (!created.has(table)) {
      failures.push(
        `${id} :: ${file} queries "${table}" but no migration creates a table or view by that name`,
      );
    }
  }
  return failures;
}

// -----------------------------------------------------------------------------
// Check 3: every src/app/api/cron/<name>/route.ts is registered in
// vercel.json's crons array.
// -----------------------------------------------------------------------------
export function findUnregisteredCronRoutes() {
  const failures = [];
  const cronDir = "src/app/api/cron";
  if (!existsSync(cronDir) || !existsSync("vercel.json")) return failures;
  const routeDirs = readdirSync(cronDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => existsSync(join(cronDir, name, "route.ts")));
  const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
  const registered = new Set((vercelConfig.crons ?? []).map((c) => c.path));
  for (const name of routeDirs) {
    const routePath = `/api/cron/${name}`;
    const id = `unregistered-cron:${routePath}`;
    if (allowed(id) || baselineSets.unregisteredCronRoutes.has(routePath)) continue;
    if (!registered.has(routePath)) {
      failures.push(`${id} :: ${routePath} exists but is absent from vercel.json's crons array`);
    }
  }
  return failures;
}

// -----------------------------------------------------------------------------
// Check 4: a caught error must be logged, rethrown, or otherwise recorded —
// never silently discarded. Covers both `.catch(() => <trivial>)` and
// `catch (e) { ... }` blocks whose body never mentions console/logger/throw.
// -----------------------------------------------------------------------------
export function findSwallowedCatches() {
  const failures = [];
  const files = [...walk("src/lib/revenue-os", [".ts"]), ...walk("src/app/api", [".ts"])];
  // Deliberately excludes the bare `{}` block form here — that's an empty
  // block, caught once by the block-body scanner below. Including it here
  // too double-reported the same line under both checks.
  const oneLinerRegex =
    /\.catch\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*(\[\]|\(\{\}\)|undefined|null)\s*\)/g;

  for (const file of files) {
    const content = readFileSync(file, "utf8");

    let m;
    oneLinerRegex.lastIndex = 0;
    while ((m = oneLinerRegex.exec(content))) {
      const line = content.slice(0, m.index).split("\n").length;
      const id = `swallowed-catch:${file}:${line}`;
      if (allowed(id) || baselineSets.swallowedCatchFiles.has(file)) continue;
      failures.push(
        `${id} :: ${file}:${line} discards a rejection with no logging: ${m[0].replace(/\s+/g, " ").slice(0, 70)}`,
      );
    }

    // Block-body catches: `.catch(... => { ... })` and `catch (e) { ... }`.
    // Brace-matched by hand since these can nest and span many lines.
    const blockStartRegex =
      /(\.catch\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)|(catch\s*(\([^)]*\))?\s*\{)/g;
    blockStartRegex.lastIndex = 0;
    while ((m = blockStartRegex.exec(content))) {
      const braceStart = m.index + m[0].length - 1; // index of the opening '{'
      let depth = 1;
      let i = braceStart + 1;
      while (i < content.length && depth > 0) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") depth--;
        i++;
      }
      const body = content.slice(braceStart + 1, i - 1);
      const line = content.slice(0, m.index).split("\n").length;
      const id = `swallowed-catch:${file}:${line}`;
      if (allowed(id) || baselineSets.swallowedCatchFiles.has(file)) continue;
      const trimmed = body.trim();
      const hasLogging = /console\.|logger\.|log\(/.test(body);
      const hasRethrow = /throw\b/.test(body);
      const hasRecording =
        /\.push\(|record[A-Z]|set[A-Z][a-zA-Z]*\(|toast\.|failures\.|errors\./.test(body);
      // Catches that build a result/outcome string from the error (e.g.
      // `return { outcome: \`Skipped: ...${safeErrorMessage(err)}\` }`) are
      // recording it too, just via a different idiom than the ones above —
      // if the bound catch identifier is referenced anywhere in the body,
      // treat that as evidence the error wasn't thrown away unexamined.
      const caughtName = m[0].match(/catch\s*\(\s*([A-Za-z_$][\w$]*)/)?.[1];
      const referencesCaughtVar = caughtName ? new RegExp(`\\b${caughtName}\\b`).test(body) : false;
      if (trimmed === "" || (!hasLogging && !hasRethrow && !hasRecording && !referencesCaughtVar)) {
        failures.push(
          `${id} :: ${file}:${line} catch block ${trimmed === "" ? "is empty" : "never logs, rethrows, or records the error"}`,
        );
      }
    }
  }
  return failures;
}

export function collectWiringFailures() {
  return [
    ...findUnwiredModules(),
    ...findUnknownTables(),
    ...findUnregisteredCronRoutes(),
    ...findSwallowedCatches(),
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = collectWiringFailures();
  if (failures.length) {
    console.error(JSON.stringify({ result: "failed", count: failures.length, failures }, null, 2));
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        result: "passed",
        checked: [
          "unwired-modules",
          "unknown-tables",
          "unregistered-cron-routes",
          "swallowed-catches",
        ],
      },
      null,
      2,
    ),
  );
}

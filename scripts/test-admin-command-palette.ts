#!/usr/bin/env tsx
/**
 * Command palette contract: discoverability, shared write paths, and
 * authorization for the admin Cmd+K surface.
 *
 * Static checks (no server needed) prove the registry shape: every command
 * carries plain-language keywords, labels are unique, the required write /
 * setup / AI-read commands exist, and the palette's "New lead" command
 * lands on the same shared AddLeadModal the Leads page button opens
 * (?create=1) instead of inventing its own create path.
 *
 * Live checks hit HTTP endpoints with no session. They assert nothing except
 * status codes on read-only or rejected requests, so they are safe against
 * production: unauthenticated admin calls must fail closed before any
 * validation, lookup, or write can happen, and a PostgREST-injection-shaped
 * query must not turn into a 500.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const shellSrc = readFileSync(join(ROOT, "src/components/admin/AdminShell.tsx"), "utf8");
const leadsSrc = readFileSync(join(ROOT, "src/app/admin/leads/page.tsx"), "utf8");
const searchSrc = readFileSync(join(ROOT, "src/app/api/admin/search/route.ts"), "utf8");

// ---- Static: command registry shape ---------------------------------------

interface CommandDef {
  label: string;
  description: string;
  keywords: string;
}

function extractCommands(src: string): CommandDef[] {
  const block = src.slice(src.indexOf("const commandActions"));
  const out: CommandDef[] = [];
  const re = /label:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"[\s\S]*?keywords:\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    out.push({ label: match[1]!, description: match[2]!, keywords: match[3]! });
  }
  return out;
}

const commands = extractCommands(shellSrc);
assert.ok(commands.length >= 8, `expected at least 8 palette commands, found ${commands.length}`);
for (const command of commands) {
  assert.ok(command.label.trim(), "every palette command needs a label");
  assert.ok(command.description.trim(), `command "${command.label}" needs a description`);
  assert.ok(
    command.keywords.split(/\s+/).filter(Boolean).length >= 2,
    `command "${command.label}" needs plain-language keywords for discoverability`,
  );
}
assert.deepEqual(
  new Set(commands.map((c) => c.label)).size,
  commands.length,
  "palette command labels must be unique so keyboard selection is unambiguous",
);

const haystack = commands.map((c) => `${c.label} ${c.description} ${c.keywords}`.toLowerCase());
const requires = ["task", "lead", "note", "email", "setup", "recover", "risk", "next"];
for (const need of requires) {
  assert.ok(
    haystack.some((h) => h.includes(need)),
    `palette must expose a discoverable command for "${need}"`,
  );
}

// ---- Static: shared write path --------------------------------------------

assert.ok(
  shellSrc.includes('router.push("/admin/leads?create=1")'),
  'palette "New lead" must route to the shared AddLeadModal via ?create=1',
);
assert.ok(
  leadsSrc.includes('get("create") === "1"'),
  "Leads page must honor ?create=1 by opening the shared AddLeadModal",
);
assert.ok(
  leadsSrc.includes("window.history.replaceState"),
  "Leads page must drop ?create=1 so refresh does not reopen the modal",
);
// AI-read commands must reuse the gated workspace event, not a new AI path.
assert.ok(
  shellSrc.includes('new CustomEvent("admin:open-ai"'),
  "AI-read commands must dispatch the existing gated admin:open-ai event",
);
// Canonical-first record search with injection sanitization.
assert.ok(
  searchSrc.includes("canonicalRes"),
  "admin search must prefer canonical contacts over legacy rows",
);
assert.ok(
  searchSrc.includes('.replace(/[,()\\\\"]/g, "")'),
  "admin search must sanitize PostgREST-significant characters",
);

// ---- Live: authorization gates (no session, read-only/rejected only) -------

function hydrateEnvFromLocalFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(rawLine.trim());
    if (!match || process.env[match[1]!] !== undefined) continue;
    const value = match[2]!;
    process.env[match[1]!] =
      value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
  }
}

hydrateEnvFromLocalFile(".env.local");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "https://www.acceleratewith.us";

async function expectClosed(label: string, path: string, init?: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  const status = response.status;
  assert.ok(
    status === 401 || status === 403 || status === 307 || status === 308,
    `${label}: unauthenticated admin call must fail closed, got ${status}`,
  );
  await response.arrayBuffer().catch(() => undefined);
}

async function main() {
  await expectClosed("admin search gate", "/api/admin/search?q=test");
  await expectClosed("admin search gate (short query)", "/api/admin/search?q=a");
  await expectClosed(
    "admin search gate (injection-shaped query)",
    "/api/admin/search?q=a,b)(c%22d",
  );
  await expectClosed("tasks create gate", "/api/admin/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  await expectClosed("leads create gate", "/api/admin/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });

  console.log(
    JSON.stringify(
      { commands: commands.length, liveGates: 5, base: BASE_URL, result: "passed" },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

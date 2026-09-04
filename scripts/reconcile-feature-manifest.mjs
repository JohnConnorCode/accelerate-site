#!/usr/bin/env node
/**
 * One-way DB -> manifest sync for status/owner on Feature Board cards.
 *
 * The claim system (migrations/20260903-feature-request-claims.sql,
 * scripts/agent-dispatch.ts) made feature_requests.status/owner live-managed
 * in the database — npm run seed:features -- --apply intentionally stopped
 * reconciling those two fields on reseed (see AGENTS.md), so the moment a
 * card is claimed, shipped, or stale-recovered, scripts/feature-backlog-data.mjs's
 * `status`/`owner` args for that card freeze at whatever they were when the
 * file was last hand-edited. Nothing else drifts (description, acceptance
 * criteria, dependencies stay hand-authored and correct) — but two things
 * read the frozen text as if it were current:
 *   - a human or agent opening the file directly, since `status:`'s value
 *     also drives the generated `notes` block's "Board milestone: ..." line
 *     and taxonomy labels the next time this file is loaded
 *   - scripts/generate-northstar-build-plan.mjs, which computes every number
 *     in docs/NORTHSTAR-BUILD-PLAN.md from this file, not from the database
 *
 * This script closes that loop the other direction: pull live status/owner
 * per seed_key from feature_requests and patch just those two argument
 * values inside each matching `card({ ... })` call, leaving every other
 * field (including derived notes/labels, which recompute from `status` at
 * import time) untouched. Run it after any claim/release/complete/stale
 * recovery — scripts/agent-dispatch.ts calls it automatically on `release`
 * and `complete` so this can't silently drift again. `--check` exits 1 if
 * anything is out of sync without writing, for CI.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "scripts", "feature-backlog-data.mjs");

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing required env var ${key}`);
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

function findCardBlock(source, seedKey) {
  const keyPattern = new RegExp(`key:\\s*"${seedKey}"`);
  const keyMatch = keyPattern.exec(source);
  if (!keyMatch) return null;
  const callStart = source.lastIndexOf("card({", keyMatch.index);
  if (callStart === -1) return null;
  let depth = 0;
  let i = callStart + "card(".length - 1;
  const openIndex = source.indexOf("{", callStart);
  depth = 1;
  i = openIndex + 1;
  while (depth > 0 && i < source.length) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    i++;
  }
  return { start: callStart, end: i, body: source.slice(callStart, i) };
}

function patchField(block, field, value) {
  const replacement = value === null ? "null" : `"${value.replace(/"/g, '\\"')}"`;
  const re = new RegExp(`(\\b${field}:\\s*)(?:"[^"]*"|null)`);
  if (re.test(block)) return block.replace(re, `$1${replacement}`);
  // Field uses its default (omitted entirely) — insert it right after `key:`.
  const keyLine = /(\bkey:\s*"[^"]*",\n)/;
  if (!keyLine.test(block)) throw new Error(`Could not find key: line to insert ${field} near`);
  return block.replace(keyLine, `$1    ${field}: ${replacement},\n`);
}

// `agent:complete --evidence "<text>"` (src/lib/revenue-os/feature-board-claims.ts
// completeFeatureCard) appends `\n\nCompleted <ISO date> by <lease owner>[...]:\n<text>`
// to the DB notes column — the only place that evidence text is ever
// recorded for a card shipped through the live claim flow. The manifest's
// own `evidence`/LATEST_IMPLEMENTATION_EVIDENCE/CURRENT_IMPLEMENTATION_EVIDENCE
// fields have no automatic way to receive it, so a card can ship with real,
// verified evidence sitting in the database while its manifest entry (and
// anything checked against it, like verify:agent-contract's "Current
// implementation evidence:" requirement) stays permanently blank. Pull the
// most recent Completed block back out as a one-time backfill.
function extractShippedEvidence(notes) {
  if (!notes) return null;
  const matches = [...notes.matchAll(/\n\nCompleted [^\n]*:\n/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  const text = notes.slice(last.index + last[0].length).trim();
  return text || null;
}

function insertEvidenceField(block, text) {
  if (/(^|\n)\s*evidence:\s*/.test(block)) return block; // hand-authored (or already backfilled) — never overwrite
  const keyLine = /(\bkey:\s*"[^"]*",\n)/;
  if (!keyLine.test(block)) throw new Error("Could not find key: line to insert evidence near");
  return block.replace(keyLine, `$1    evidence:\n      ${JSON.stringify(text)},\n`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const { data, error } = await supabase
    .from("feature_requests")
    .select("seed_key,status,owner,notes")
    .not("seed_key", "is", null);
  if (error) throw new Error(error.message);

  let source = readFileSync(manifestPath, "utf8");
  const drift = [];
  const evidenceBackfilled = [];

  for (const row of data ?? []) {
    const block = findCardBlock(source, row.seed_key);
    if (!block) continue; // card exists in DB (e.g. ad hoc, non-seeded) but not in the manifest — nothing to patch
    const statusMatch = /\bstatus:\s*"([^"]*)"/.exec(block.body);
    const manifestStatus = statusMatch?.[1] ?? "backlog";
    const ownerMatch = /\bowner:\s*(?:"([^"]*)"|null)/.exec(block.body);
    const manifestOwner = ownerMatch ? (ownerMatch[1] ?? null) : null;

    const statusOrOwnerDrifted = manifestStatus !== row.status || manifestOwner !== row.owner;
    if (statusOrOwnerDrifted) {
      drift.push({
        seed_key: row.seed_key,
        manifestStatus,
        dbStatus: row.status,
        manifestOwner,
        dbOwner: row.owner,
      });
    }

    let patched = block.body;
    if (statusOrOwnerDrifted) {
      patched = patchField(patched, "status", row.status);
      patched = patchField(patched, "owner", row.owner);
    }
    if (row.status === "shipped") {
      const evidence = extractShippedEvidence(row.notes);
      if (evidence) {
        const before = patched;
        patched = insertEvidenceField(patched, evidence);
        if (patched !== before) evidenceBackfilled.push(row.seed_key);
      }
    }
    if (patched !== block.body) {
      source = source.slice(0, block.start) + patched + source.slice(block.end);
    }
  }

  if (!drift.length && !evidenceBackfilled.length) {
    console.log(
      "Manifest already matches live Feature Board status/owner/evidence for every seeded card.",
    );
    return;
  }

  if (drift.length) {
    console.log(`${drift.length} card(s) out of sync with the live board:`);
    for (const d of drift) {
      console.log(
        `  ${d.seed_key}: status ${d.manifestStatus} -> ${d.dbStatus}` +
          (d.manifestOwner !== d.dbOwner
            ? `, owner ${d.manifestOwner ?? "null"} -> ${d.dbOwner ?? "null"}`
            : ""),
      );
    }
  }
  if (evidenceBackfilled.length) {
    console.log(
      `${evidenceBackfilled.length} shipped card(s) missing manifest evidence, backfilled from the DB's Completed note:`,
    );
    for (const key of evidenceBackfilled) console.log(`  ${key}`);
  }

  if (checkOnly) {
    console.log("\n--check: manifest not written. Run `npm run reconcile:feature-status` to fix.");
    process.exitCode = 1;
    return;
  }

  writeFileSync(manifestPath, source);
  console.log(`\nWrote ${manifestPath}. Regenerate docs with: npm run report:build-plan.`);
}

main().catch((err) => {
  console.error(`[reconcile-feature-manifest] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

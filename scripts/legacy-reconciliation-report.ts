#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_LEGACY_CAPTURE_SOURCES,
  buildLegacyCanonicalReconciliationReport,
} from "../src/lib/revenue-os/legacy-reconciliation";
import { createServiceRoleClient } from "../src/lib/supabase/server";

function getArg(name: string): string | undefined {
  const equalsArg = `${name}=`;
  const directArg = process.argv.find((arg) => arg.startsWith(equalsArg));
  if (directArg) return directArg.slice(equalsArg.length);

  const direct = process.argv.find((arg) => arg === name);
  if (!direct) return undefined;
  const argIndex = process.argv.indexOf(direct);
  return process.argv[argIndex + 1];
}

function parseSources(): typeof DEFAULT_LEGACY_CAPTURE_SOURCES {
  const sourceArg = getArg("--sources");
  if (!sourceArg) return DEFAULT_LEGACY_CAPTURE_SOURCES;
  const requested = new Set(
    sourceArg
      .split(",")
      .map((source) => source.trim())
      .filter(Boolean),
  );
  return DEFAULT_LEGACY_CAPTURE_SOURCES.filter((source) => requested.has(source.sourceRecordType));
}

async function main() {
  const outputPath = getArg("--output");
  const includeSources = parseSources();

  const supabase = createServiceRoleClient();
  const report = await buildLegacyCanonicalReconciliationReport(supabase, includeSources);

  const summary = {
    generatedAt: report.generatedAt,
    scope: report.scope,
    totalRows: report.summary.totalRows,
    matched: report.summary.matched,
    missingCanonical: report.summary.missingCanonical,
    ambiguousIdentity: report.summary.ambiguousIdentity,
    duplicateCanonical: report.summary.duplicateCanonical,
    canonicalCounts: report.canonicalCounts,
    sourceStats: report.sourceStats,
    errors: report.errors,
  };

  if (outputPath) {
    const filePath = resolve(outputPath);
    const directory = dirname(filePath);
    mkdirSync(directory, { recursive: true });
    writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`Wrote legacy reconciliation report to ${filePath}`);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (report.errors.length > 0) {
    console.error("Legacy reconciliation completed with read errors:");
    for (const error of report.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

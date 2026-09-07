#!/usr/bin/env tsx
/**
 * Regenerates docs/generated/record-permission-reference.json from the
 * executable registrations. Run after any module, tool-grant, autonomy, or
 * permission-primitive change and commit the result; the contract test fails
 * on drift.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecordPermissionReference } from "../src/lib/revenue-os/record-permission-reference";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "docs/generated/record-permission-reference.json");
writeFileSync(outPath, `${JSON.stringify(buildRecordPermissionReference(), null, 2)}\n`);
console.log(`Wrote ${outPath}`);

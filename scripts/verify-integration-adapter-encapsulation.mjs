#!/usr/bin/env node
/**
 * INTEGRATION_ADAPTERS (src/lib/revenue-os/integration-adapters.ts) is
 * documented as the registry every adapter-backed provider write resolves
 * through. That claim is only true if nothing else imports a named adapter
 * directly and branches on it by hand — which is exactly what
 * src/app/api/admin/tenant/providers/route.ts did before this gate existed,
 * importing whatsAppAdapter and hubSpotAdapter and calling them from an
 * if/else chain the registry's own comment claimed to make unnecessary.
 *
 * This does not forbid importing the adapters' other exports (ingestMessage,
 * importBatch, the credential interfaces); it forbids importing the named
 * adapter objects themselves, which is what lets a caller bypass the
 * registry lookup in configureAdapterProvider().
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const OWNER_FILE = "src/lib/revenue-os/integration-adapters.ts";
const ADAPTER_EXPORT_NAMES = ["whatsAppAdapter", "hubSpotAdapter"];

function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) files.push(path);
  }
  return files;
}

const failures = [];
for (const file of sourceFiles(join(repoRoot, "src"))) {
  const relative = file.slice(repoRoot.length);
  if (relative === OWNER_FILE) continue;
  const source = readFileSync(file, "utf8");
  for (const name of ADAPTER_EXPORT_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(source)) {
      failures.push(
        `${relative} references "${name}" directly. Provider-scoped writes must resolve it through INTEGRATION_ADAPTERS instead.`,
      );
    }
  }
}

if (failures.length) {
  console.error(`Integration adapter encapsulation failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({ result: "passed", checkedExports: ADAPTER_EXPORT_NAMES.length }));

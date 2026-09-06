import { readFileSync, statSync } from "node:fs";
import { evaluateCollectionsSnapshot } from "../plugins/receivables-collections/evaluate";
async function main() {
  const [file, tenantId, ...extra] = process.argv.slice(2);
  if (extra.length || Boolean(file) !== Boolean(tenantId))
    throw new Error("Usage: npm run preview:collections [-- snapshot.json expected-tenant-uuid]");
  const path = file ?? new URL("../plugins/receivables-collections/example.json", import.meta.url);
  if (statSync(path).size > 65_536) throw new Error("Snapshot file exceeds 64 KiB");
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  const result = await evaluateCollectionsSnapshot(
    tenantId ?? "00000000-0000-4000-8000-000000000001",
    raw,
  );
  console.log(
    JSON.stringify(
      { mode: file ? "unverified-input-preview" : "fictional-example", effects: "none", ...result },
      null,
      2,
    ),
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Preview failed");
  process.exitCode = 1;
});

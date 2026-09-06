/** Explicit read-only export. Only allowlisted planning metadata reaches Git. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { listWorkBoard } from "../src/lib/revenue-os/work-board";
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const features = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await listWorkBoard(
      db,
      { id: "backlog-snapshot", projects: ["accelerate"], scopes: ["read"], reviewer: true },
      { offset, limit: 500 },
    );
    features.push(...page.features);
    offset = page.nextOffset;
  }
  const classification = existsSync("docs/planning/backlog-audit.json")
    ? JSON.parse(readFileSync("docs/planning/backlog-audit.json", "utf8")).audit
    : [];
  const fields = [
    "id",
    "seed_key",
    "title",
    "status",
    "revision",
    "labels",
    "priority",
    "sort_order",
    "initiative",
    "parent_id",
    "work_kind",
    "work_spec",
    "work_delivery",
    "dependencies",
    "readiness",
  ];
  const safe = features.map((c) => ({
    ...Object.fromEntries(fields.map((k) => [k, (c as Record<string, unknown>)[k]])),
    ...(!c.work_spec?.northstar
      ? {
          auditClassification:
            classification.find((a: { id: string }) => a.id === c.id)?.classification ??
            (c.seed_key === "backlog-execution-quality"
              ? { phase: "B", origin: "Founder-approved backlog implementation task" }
              : undefined),
        }
      : {}),
  }));
  mkdirSync("docs/planning", { recursive: true });
  writeFileSync(
    "docs/planning/backlog-snapshot.json",
    JSON.stringify(
      { schemaVersion: 2, exportedAt: new Date().toISOString(), features: safe },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Exported ${features.length} active cards; no notes, owner identities, credentials or claim tokens included.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

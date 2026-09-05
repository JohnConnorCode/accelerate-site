import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function validateSnapshot(snapshot) {
  const failures = [];
  const cards = snapshot.features ?? [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const keys = new Set();
  if (!snapshot.exportedAt || Number.isNaN(Date.parse(snapshot.exportedAt)))
    failures.push("Snapshot needs an explicit export timestamp");
  if (byId.size !== cards.length) failures.push("Duplicate card UUID");
  for (const c of cards) {
    if (keys.has(c.seed_key)) failures.push(`Duplicate key ${c.seed_key}`);
    keys.add(c.seed_key);
    for (const id of c.dependencies ?? [])
      if (!byId.has(id)) failures.push(`${c.seed_key}: missing dependency ${id}`);
    const spec = c.work_spec ?? {};
    if (
      ["backlog", "planned", "blocked"].includes(c.status) &&
      ["feature", "bug"].includes(c.work_kind)
    ) {
      for (const k of [
        "scope",
        "exclusions",
        "references",
        "workflow",
        "failureModes",
        "verification",
        "acceptance",
      ])
        if (!Array.isArray(spec[k]) || !spec[k].length)
          failures.push(`${c.seed_key}: missing ${k}`);
      if (!spec.northstar?.phase || !spec.repository?.baseCommit)
        failures.push(`${c.seed_key}: incomplete phase/base`);
      const ids = new Set();
      for (const a of spec.acceptance ?? []) {
        if (!a.id || ids.has(a.id) || !a.environment)
          failures.push(`${c.seed_key}: invalid acceptance`);
        ids.add(a.id);
      }
    }
    if (
      c.readiness?.length === 0 &&
      (c.dependencies ?? []).some((id) => byId.get(id)?.status !== "shipped")
    )
      failures.push(`${c.seed_key}: falsely ready with unverified prerequisite`);
    if (c.work_kind === "initiative" && c.readiness?.length === 0)
      failures.push(`${c.seed_key}: initiative is executable`);
  }
  const visited = new Set(),
    visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) {
      failures.push(`Dependency cycle at ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const d of byId.get(id)?.dependencies ?? []) visit(d);
    visiting.delete(id);
    visited.add(id);
  }
  for (const c of cards) visit(c.id);
  return failures;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(readFileSync("docs/planning/backlog-snapshot.json", "utf8"));
  const failures = validateSnapshot(snapshot);
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      `PASS ${snapshot.features.length} cards: unique keys/UUIDs, complete executable packets, acyclic references and truthful readiness.`,
    );
}

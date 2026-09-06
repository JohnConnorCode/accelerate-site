/** Build a revision-checked UUID-link proposal after definition creation. */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { SECOND_BRAIN_IMPLEMENTATIONS } from "./feature-backlog-data.mjs";
const [snapshotPath, linksPath, out] = process.argv.slice(2);
if (!out) throw new Error("Use snapshot.json links.json proposal.json");
const rows = JSON.parse(readFileSync(snapshotPath, "utf8")).features;
const spec = JSON.parse(readFileSync(linksPath, "utf8"));
const byKey = new Map(rows.map((c) => [c.seed_key, c]));
const changes = [];
const revisions = new Map(rows.map((c) => [c.id, c.revision]));
function change(key, operation, payload) {
  const card = byKey.get(key);
  if (!card) throw new Error("Missing card " + key);
  if (["in_progress", "in_review", "shipped"].includes(card.status))
    throw new Error("Preserve active or historical card " + key);
  changes.push({
    operation,
    id: card.id,
    revision: revisions.get(card.id),
    requestKey: randomUUID(),
    payload,
  });
  revisions.set(card.id, revisions.get(card.id) + 1);
}
function dependencies(key, keys) {
  const ids = [
    ...new Set(
      keys.map((k) => {
        const row = byKey.get(k);
        if (!row) throw new Error("Missing prerequisite " + k);
        return row.id;
      }),
    ),
  ];
  change(key, "dependencies", { dependencies: ids });
}
for (const a of spec.additions) {
  if (a.parent) change(a.key, "edit", { parent_id: byKey.get(a.parent).id });
  dependencies(a.key, a.dependencies);
}
for (const parent of spec.splits)
  dependencies(
    parent,
    spec.additions.filter((a) => a.parent === parent).map((a) => a.key),
  );
for (const parent of spec.rollups) {
  const children =
    parent === "receivables-collections-plugin"
      ? [
          "receivables-case-lifecycle",
          "receivables-decision-engine",
          "receivables-approved-reminders",
          "receivables-workspace-demo",
        ]
      : SECOND_BRAIN_IMPLEMENTATIONS[parent];
  if (children?.length) dependencies(parent, children);
}
writeFileSync(out, JSON.stringify({ schemaVersion: 1, changes }, null, 2) + "\n");
console.log(
  `${changes.length} explicit parent/dependency changes; no title matching or status changes.`,
);

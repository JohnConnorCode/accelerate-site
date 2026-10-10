import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateInIsolate } from "../src/lib/revenue-os/plugin-isolate";

/** A local exercise over the actual report source, with no database or provider calls. */
async function main() {
  const args = process.argv.slice(2);
  const days =
    args.length === 0 ? 7 : args[0] === "--days" && args.length === 2 ? Number(args[1]) : NaN;
  assert(
    [3, 7].includes(days),
    "Use --days 7 for the original report or --days 3 after your change.",
  );
  const now = Date.parse("2026-10-10T12:00:00Z");
  const date = (age: number) => new Date(now - age * 86400000).toISOString();
  const records = [
    {
      id: "recent",
      name: "Recent inquiry",
      stage: "new",
      updated_at: date(2),
      next_action_at: null,
    },
    {
      id: "three-days",
      name: "Three quiet days",
      stage: "qualified",
      updated_at: date(3),
      next_action_at: null,
    },
    {
      id: "four-days",
      name: "Four quiet days",
      stage: "proposal",
      updated_at: date(4),
      next_action_at: null,
    },
    {
      id: "seven-days",
      name: "Seven quiet days",
      stage: "new",
      updated_at: date(7),
      next_action_at: null,
    },
    {
      id: "overdue",
      name: "Overdue callback",
      stage: "new",
      updated_at: date(1),
      next_action_at: date(1),
    },
    { id: "closed", name: "Won job", stage: "won", updated_at: date(10), next_action_at: null },
  ];
  const source = readFileSync("plugins/pipeline-watch/report.js", "utf8");
  const report = await evaluateInIsolate(source, {
    pluginId: "pipeline-followup-exercise",
    bindings: {
      reportContext: () => ({ now: new Date(now).toISOString() }),
      readSource: (key) => {
        assert.equal(key, "records");
        return records;
      },
    },
  });
  const value = report.value as {
    items: Array<{ id: string; title: string; detail: string }>;
    totalFindings: number;
  };
  const expected =
    days === 3 ? ["three-days", "four-days", "seven-days", "overdue"] : ["seven-days", "overdue"];
  assert.deepEqual(
    value.items.map((item) => item.id),
    expected,
    "The saved report does not match the requested threshold. Check report.js.",
  );
  assert.equal(value.totalFindings, expected.length);
  console.table(value.items.map(({ id, title, detail }) => ({ id, title, detail })));
  console.log(
    `Verified ${days}-day follow-up: recent and closed opportunities stay out; overdue next actions remain visible.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/** Founder-only reviewed import/export adapter. Live DB owns work; Git supplies templates. */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseDependencyTitles } from "./lib/feature-board-graph.mjs";
import { featureBacklog } from "./feature-backlog-data.mjs";
import { mutateWorkBoard, listWorkBoard, type WorkActor } from "../src/lib/revenue-os/work-board";
async function main() {
  const args = process.argv.slice(2);
  const value = (flag: string) => args[args.indexOf(flag) + 1];
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const actor: WorkActor = {
    id: "founder:reviewed-import",
    projects: ["*"],
    scopes: ["*"],
    reviewer: true,
  };
  const rows: Awaited<ReturnType<typeof listWorkBoard>>["features"] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const result = await listWorkBoard(db, actor, { offset, limit: 500 });
    rows.push(...result.features);
    offset = result.nextOffset;
  }
  if (args.includes("--export")) {
    writeFileSync(
      value("--export")!,
      JSON.stringify(
        { schemaVersion: 1, exportedAt: new Date().toISOString(), features: rows },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Exported ${rows.length} live cards. This is a snapshot, not an overwrite authority.`,
    );
  } else if (args.includes("--apply")) {
    if (!args.includes("--plan"))
      throw new Error(
        "--apply requires --plan <reviewed.json>. Generate and review a plan first; absent cards are never archived.",
      );
    const plan = z
      .object({
        schemaVersion: z.literal(1),
        changes: z.array(
          z
            .object({
              operation: z.enum(["create", "edit", "dependencies"]),
              id: z.string().uuid().optional(),
              revision: z.number().int().optional(),
              requestKey: z.string().uuid(),
              payload: z.record(z.string(), z.unknown()),
            })
            .strict(),
        ),
      })
      .strict()
      .parse(JSON.parse(readFileSync(value("--plan")!, "utf8")));
    for (const change of plan.changes) {
      const result = await mutateWorkBoard(db, actor, change);
      console.log(
        `${change.operation}: ${result.card.seed_key ?? result.card.id} revision ${result.card.revision}${result.replayed ? " (replayed)" : ""}`,
      );
    }
    console.log(
      "Import complete. Unlisted cards, status, assignments, evidence and history preserved.",
    );
  } else {
    const keys = args.includes("--cards") ? new Set(value("--cards")!.split(",")) : null;
    const fields = [
      "title",
      "description",
      "acceptance_criteria",
      "notes",
      "priority",
      "labels",
      "initiative",
      "work_kind",
      "work_spec",
    ];
    const changes = [];
    for (const template of featureBacklog) {
      if (keys && !keys.has(template.seed_key)) continue;
      const live = rows.find((row) => row.seed_key === template.seed_key);
      if (args.includes("--link-dependencies")) {
        if (!live) throw new Error(`Create ${template.seed_key} before linking dependencies`);
        const dependencies = parseDependencyTitles(template).map((title: string) => {
          const candidates = rows.filter((row) => row.title === title);
          if (candidates.length !== 1) throw new Error(`Unresolved dependency: ${title}`);
          return candidates[0]!.id;
        });
        if (
          JSON.stringify([...dependencies].sort()) !==
          JSON.stringify([...(live.dependencies ?? [])].sort())
        )
          changes.push({
            operation: "dependencies",
            id: live.id,
            revision: live.revision,
            requestKey: randomUUID(),
            payload: { dependencies },
          });
        continue;
      }
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const next = (template as Record<string, unknown>)[field];
        if (next === undefined) continue;
        if (
          !live ||
          JSON.stringify(next) !== JSON.stringify((live as Record<string, unknown>)[field])
        )
          payload[field] = next;
      }
      if (!Object.keys(payload).length) continue;
      if (!live) {
        payload.project_key = "accelerate";
        payload.seed_key = template.seed_key;
      }
      changes.push({
        operation: live ? "edit" : "create",
        ...(live ? { id: live.id, revision: live.revision } : {}),
        requestKey: randomUUID(),
        payload,
      });
    }
    const plan = { schemaVersion: 1, changes };
    if (args.includes("--plan"))
      writeFileSync(value("--plan")!, JSON.stringify(plan, null, 2) + "\n");
    console.log(
      JSON.stringify(
        {
          mode: "review-only",
          liveCards: rows.length,
          proposedChanges: changes.length,
          archival: 0,
          plan: args.includes("--plan") ? value("--plan") : null,
        },
        null,
        2,
      ),
    );
    if (args.includes("--verify"))
      console.log("Template differences are advisory. Live-only cards and edits are valid.");
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Work command failed");
  process.exitCode = 1;
});

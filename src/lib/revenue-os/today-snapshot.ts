import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import {
  todayFacts,
  validateTodayBrief,
  type TodaySnapshot,
  type TodayRegion,
  type TodayApp,
} from "@/lib/admin/today-data";
import { loadOperatorQueue } from "./queue";
import { projectOperatorAttention } from "./operator-attention";
import { loadActivityTimeline } from "./activities";
import { getActiveModules } from "./modules";
import { loadPipelineStages } from "./pipeline-stage-resolver";
import { readCollectionWorkspace } from "./collection-workspace";
import { pipelineMetrics } from "./pipeline-metrics";
import { readRadarStore } from "./radar-store";

async function region<T>(read: () => Promise<T>, fallback: T, at: string): Promise<TodayRegion<T>> {
  try {
    const data = await read();
    return {
      data,
      observedAt: at,
      state: data === null || (Array.isArray(data) && !data.length) ? "empty" : "ready",
    };
  } catch (error) {
    console.warn(
      "[today] source unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
    return {
      data: fallback,
      observedAt: at,
      state: "unavailable",
      message: "This source could not be refreshed.",
    };
  }
}
export async function loadTodaySnapshot(
  db: SupabaseClient,
  options: { includeBrief?: boolean } = {},
): Promise<TodaySnapshot> {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Today requires an explicit workspace.");
  const tenant = await db.from("tenants").select("config,status").eq("id", tenantId).single();
  if (tenant.error || tenant.data?.status !== "active") throw new Error("Workspace unavailable.");
  const modules = getActiveModules(tenant.data.config);
  const enabled = new Set(modules.map((module) => module.id));
  const generatedAt = new Date().toISOString();
  const warnings: string[] = [];
  const [attention, handling, activity, metrics, apps, brief] = await Promise.all([
    region(
      async () => {
        const items = projectOperatorAttention(
          await loadOperatorQueue(db, { onSourceError: (source) => warnings.push(source) }),
        );
        return items.filter(
          (item) =>
            (item.sourceType !== "proposal" || enabled.has("proposals")) &&
            (item.sourceType !== "campaign_member" || enabled.has("campaigns")) &&
            (item.sourceType !== "calendar_event" || enabled.has("bookings")),
        );
      },
      [],
      generatedAt,
    ),
    region(
      async () => {
        const result = await db
          .from("work_items")
          .select(
            "id,objective,status,coworker_id,outcome,next_check_at,next_check_reason,created_at",
          )
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(20);
        if (result.error) throw result.error;
        const coworkers = await db.from("coworkers").select("id,name").limit(100);
        if (coworkers.error) throw coworkers.error;
        return (result.data ?? []).map((row) => ({
          id: row.id,
          title: row.objective,
          status: row.status,
          owner: coworkers.data?.find((c) => c.id === row.coworker_id)?.name || "Workspace",
          outcome: row.outcome,
          nextCheckAt: row.next_check_at,
          nextCheckReason: row.next_check_reason,
          href: "/admin/inbox?type=coworker",
        }));
      },
      [],
      generatedAt,
    ),
    region(
      async () =>
        (await loadActivityTimeline(db, { limit: 20 })).map((row) => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          at: row.occurred_at,
          href: row.opportunity_id ? "/admin/pipeline/" + row.opportunity_id : "/admin/activity",
        })),
      [],
      generatedAt,
    ),
    region(
      async () => {
        const [result, stages] = await Promise.all([
          db.from("opportunities").select("stage,estimated_value,probability").limit(1000),
          loadPipelineStages(db, tenantId),
        ]);
        if (result.error) throw result.error;
        return pipelineMetrics(result.data ?? [], stages);
      },
      null,
      generatedAt,
    ),
    region(
      async () =>
        Promise.all(
          modules
            .filter((module) => module.today)
            .map(async (module): Promise<TodayApp> => {
              const base = { id: module.id, name: module.name, href: module.today!.href };
              try {
                let items: TodayApp["items"] = [];
                if (module.today!.source === "collection_case") {
                  items = (
                    await readCollectionWorkspace(db, undefined, {
                      status: "open",
                      maxCases: 8,
                      includeInvoiceOptions: false,
                      includeActionPreviews: false,
                    })
                  ).cases.map((row) => ({
                    id: row.id,
                    title: row.name + " · " + row.currency.toUpperCase(),
                    detail: row.nextAction || "Review the case and outstanding invoices.",
                    observedAt: row.events[0]?.at ?? row.invoices[0]?.observedAt ?? "",
                    sourceId: row.id,
                    sourceType: "collection_case",
                    href: "/admin/collections?case=" + row.id,
                  }));
                } else if (module.today!.source === "radar_opportunity") {
                  const result = await readRadarStore(db, { limit: 8 });
                  const rows =
                    "opportunities" in result && Array.isArray(result.opportunities)
                      ? result.opportunities
                      : [];
                  items = rows.map((row) => ({
                    id: String(row.id),
                    title: String(row.title),
                    detail: String(row.summary || "Review the supporting evidence."),
                    observedAt: String(row.updated_at || ""),
                    sourceType: "radar_opportunity",
                    sourceId: String(row.id),
                    href: "/admin/radar/opportunities/" + row.id,
                  }));
                }
                return { ...base, items, state: items.length ? "ready" : "empty" };
              } catch (error) {
                console.warn(
                  "[today] app contribution unavailable",
                  module.id,
                  error instanceof Error ? error.message : "unknown error",
                );
                return { ...base, items: [], state: "unavailable" };
              }
            }),
        ),
      [],
      generatedAt,
    ),
    region(
      async () => {
        if (options.includeBrief === false) return null;
        const result = await db
          .from("work_items")
          .select("outcome,finished_at")
          .eq("kind", "daily_digest")
          .eq("status", "completed")
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data?.outcome) return null;
        try {
          return JSON.parse(result.data.outcome) as unknown;
        } catch (error) {
          console.warn(
            "[today] stored brief could not be parsed",
            error instanceof Error ? error.message : "unknown error",
          );
          return null;
        }
      },
      null,
      generatedAt,
    ),
  ]);
  if (warnings.length && attention.state !== "unavailable") {
    attention.state = attention.data.length ? "partial" : "unavailable";
    attention.message = "Could not refresh: " + warnings.join(", ") + ".";
  }
  const facts = todayFacts(attention.data, activity.data);
  for (const app of apps.data)
    for (const item of app.items.slice(0, 2))
      facts.push({
        id: item.sourceType + ":" + item.sourceId,
        title: item.title,
        detail: item.detail,
        href: item.href,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        observedAt: item.observedAt || "unknown",
        nextStep: "Open the original record to review the next step.",
        severity: "normal",
      });
  const parsed = validateTodayBrief(brief.data, facts);
  const freshBrief =
    parsed && Date.now() - Date.parse(parsed.generatedAt) < 86400000 ? parsed : null;
  return {
    generatedAt,
    attention,
    handling,
    activity,
    metrics,
    apps,
    facts: {
      state:
        attention.state === "unavailable" && activity.state === "unavailable"
          ? "unavailable"
          : warnings.length || activity.state === "unavailable"
            ? "partial"
            : facts.length
              ? "ready"
              : "empty",
      data: facts,
      observedAt: generatedAt,
    },
    brief: {
      ...brief,
      data: freshBrief,
      state: brief.state === "unavailable" ? "unavailable" : freshBrief ? "ready" : "empty",
    },
  };
}

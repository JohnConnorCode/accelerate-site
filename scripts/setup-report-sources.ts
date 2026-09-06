/** Explicit host administration, never called by an application request. */
import { createPlatformServiceRoleClient, bindTenantDatabase } from "../src/lib/supabase/server";
import { getEntityType, registerEntityType } from "../src/lib/revenue-os/entity-registry";
async function main() {
  const tenantId = process.argv[2];
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId))
    throw new Error(
      "Usage: npm run plugins:setup -- <tenant UUID> [--apply]. Defaults to a read-only plan.",
    );
  const sources = [
    {
      typeKey: "report_opportunities",
      label: "Pipeline report source",
      backingTable: "opportunities",
      readableColumns: ["name", "stage", "updated_at", "next_action_at"],
    },
    {
      typeKey: "report_tasks",
      label: "Commitment report source",
      backingTable: "tasks",
      readableColumns: ["title", "status", "due_date"],
    },
    {
      typeKey: "report_calendar_events",
      label: "Meeting report source",
      backingTable: "calendar_events",
      readableColumns: ["title", "status", "start_at", "end_at"],
    },
  ];
  const db = bindTenantDatabase(
    createPlatformServiceRoleClient("report-source-setup"),
    tenantId,
    true,
  );
  const { data: tenant, error } = await db
    .from("tenants")
    .select("id,slug,status")
    .eq("id", tenantId)
    .single();
  if (error || !tenant) throw new Error("Workspace not found");
  console.log({
    workspace: tenant.slug,
    tenantId,
    project: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    apply: process.argv.includes("--apply"),
  });
  for (const source of sources) {
    const existing = await getEntityType(db, tenantId, source.typeKey);
    if (existing) {
      console.log(`${source.typeKey}: already registered; preserving host policy`);
      continue;
    }
    console.log(`${source.typeKey}: register bounded fields ${source.readableColumns.join(", ")}`);
    if (process.argv.includes("--apply")) await registerEntityType(db, { tenantId, ...source });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

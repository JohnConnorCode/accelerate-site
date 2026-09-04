import { createClient } from "@supabase/supabase-js";
import { featureBacklog, validateFeatureBacklog } from "./feature-backlog-data.mjs";

const summary = validateFeatureBacklog();
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
if (!apply && !verify) {
  console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
  console.log(
    "Run `npm run seed:features -- --apply` to reconcile the entire active board to this master backlog.",
  );
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

const { data: before, error: readError } = await supabase
  .from("feature_requests")
  .select(
    "id,seed_key,source,archived_at,title,description,status,priority,labels,sort_order,owner,target_date,acceptance_criteria,notes",
  );
if (readError) throw readError;

const canonicalKeys = new Set(featureBacklog.map((feature) => feature.seed_key));
// `status` and `owner` are live-managed columns, not manifest-managed, since
// migrations/20260903-feature-request-claims.sql added a real atomic claim
// (claim_feature_request RPC via scripts/agent-dispatch.ts / `npm run
// agent:next`). Diffing or overwriting them here would silently revert a
// live claim on the next `--apply` — exactly the footgun the claim system
// exists to remove. They're still seeded on first insert (below), just never
// reconciled against an existing row.
const LIVE_MANAGED_FIELDS = new Set(["status", "owner", "subtasks"]);
if (verify) {
  const active = (before ?? []).filter((row) => !row.archived_at);
  const liveByKey = new Map(active.map((row) => [row.seed_key, row]));
  const fields = [
    "title",
    "description",
    "priority",
    "labels",
    "sort_order",
    "target_date",
    "acceptance_criteria",
    "notes",
    "source",
  ];
  const missing = featureBacklog
    .filter((feature) => !liveByKey.has(feature.seed_key))
    .map((feature) => feature.seed_key);
  const drifted = featureBacklog
    .filter((feature) => {
      const live = liveByKey.get(feature.seed_key);
      return (
        live &&
        fields.some((field) => JSON.stringify(live[field]) !== JSON.stringify(feature[field]))
      );
    })
    .map((feature) => feature.seed_key);
  const outsideManifest = active
    .filter((row) => !row.seed_key || !canonicalKeys.has(row.seed_key))
    .map((row) => row.id);
  const liveStatus = active
    .filter((row) => canonicalKeys.has(row.seed_key))
    .reduce((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {});
  const result = {
    mode: "verified",
    expected: featureBacklog.length,
    activeManaged: active.filter((row) => canonicalKeys.has(row.seed_key)).length,
    byStatus: liveStatus,
    missing,
    drifted,
    outsideManifest,
  };
  console.log(JSON.stringify(result, null, 2));
  if (missing.length || drifted.length || outsideManifest.length) process.exit(1);
  process.exit(0);
}

const existingKeys = new Set((before ?? []).map((row) => row.seed_key));
const newCards = featureBacklog.filter((feature) => !existingKeys.has(feature.seed_key));
const existingCards = featureBacklog.filter((feature) => existingKeys.has(feature.seed_key));

// New rows: seed every field, including initial status/owner from the
// manifest (there is nothing live to clobber yet).
for (let index = 0; index < newCards.length; index += 40) {
  const batch = newCards.slice(index, index + 40);
  const { error } = await supabase.from("feature_requests").upsert(batch, { onConflict: "seed_key" });
  if (error) throw error;
}

// Existing rows: upsert everything except the live-managed fields, so an
// active claim survives reconciliation. Omitting a key from the upsert
// payload leaves that column untouched (PostgREST only updates columns
// present in the row object).
for (let index = 0; index < existingCards.length; index += 40) {
  const batch = existingCards.slice(index, index + 40).map((feature) =>
    Object.fromEntries(Object.entries(feature).filter(([key]) => !LIVE_MANAGED_FIELDS.has(key))),
  );
  const { error } = await supabase.from("feature_requests").upsert(batch, { onConflict: "seed_key" });
  if (error) throw error;
}

const inserted = newCards.length;
const outsideManifest = (before ?? []).filter(
  (row) => !row.archived_at && (!row.seed_key || !canonicalKeys.has(row.seed_key)),
);
for (let index = 0; index < outsideManifest.length; index += 100) {
  const ids = outsideManifest.slice(index, index + 100).map((row) => row.id);
  const { error } = await supabase
    .from("feature_requests")
    .update({ archived_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}
console.log(
  JSON.stringify(
    {
      mode: "applied",
      ...summary,
      inserted,
      updated: featureBacklog.length - inserted,
      archivedOutsideManifest: outsideManifest.length,
    },
    null,
    2,
  ),
);

import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabaseForTest } from "@/lib/supabase/server";
import {
  contentCalendarChangesSchema,
  previewContentCalendarUpdate,
} from "@/lib/revenue-os/content-calendar";

const tenantId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: itemId,
  title: "First draft",
  slug: "first-draft",
  status: "draft",
  category: "education",
  target_keywords: ["onboarding"],
  pillar: null,
  funnel_stage: "awareness",
  target_publish_date: null,
  actual_publish_date: null,
  author: "Editor",
  notes: null,
  seo_title: null,
  seo_description: null,
  word_count_target: 900,
  updated_at: "2026-09-23T12:00:00.000Z",
};

const fakeDatabase = {
  from(table: string) {
    assert.equal(table, "content_calendar");
    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      async maybeSingle() {
        return { data: row, error: null };
      },
    };
    return query;
  },
} as unknown as SupabaseClient;

async function main() {
  const database = bindTenantDatabaseForTest(fakeDatabase, tenantId);
  const preview = await previewContentCalendarUpdate(database, {
    id: itemId,
    changes: { status: "review", notes: "Ready for editorial review." },
  });

  assert.match(preview.digest, /^[a-f0-9]{64}$/);
  assert.equal(preview.tenantId, tenantId);
  assert.equal(preview.before.status, "draft");
  assert.equal(preview.after.status, "review");
  assert.deepEqual(
    preview.changes.map(({ field }) => field),
    ["status", "notes"],
  );
  assert.equal(preview.requiresHumanApproval, true);

  assert.equal(
    Object.keys(
      contentCalendarChangesSchema.parse({
        title: "Updated title",
        slug: "updated-title",
        status: "review",
        category: "education",
        target_keywords: ["onboarding"],
        pillar: null,
        funnel_stage: "awareness",
        target_publish_date: null,
        actual_publish_date: null,
        author: "Editor",
        notes: null,
        seo_title: null,
        seo_description: null,
        word_count_target: 900,
      }),
    ).length,
    14,
  );

  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: {
        title: "New title",
        slug: "new-title",
        status: "review",
        category: "education",
        pillar: "resources",
        notes: "Ready",
      },
    }),
    /no more than five fields/i,
  );

  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: { target_publish_date: "2026-02-30" },
    }),
  );
  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: { status: "review", is_published: true },
    }),
  );
  await assert.rejects(
    previewContentCalendarUpdate(database, { id: itemId, changes: { status: "draft" } }),
    /No content calendar values would change/,
  );

  process.stdout.write(
    `${JSON.stringify({ result: "passed", checks: ["exact preview", "tenant binding", "approval requirement", "invalid date", "unknown field", "no-op refusal"] })}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

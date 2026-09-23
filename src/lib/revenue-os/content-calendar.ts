import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentCalendarReadInput = {
  status?: string;
  category?: string;
  limit?: number;
};

export async function listContentCalendarItems(
  database: SupabaseClient,
  input: ContentCalendarReadInput = {},
) {
  const { status, category, limit } = input;
  if (status !== undefined && (!status.trim() || status.length > 120))
    throw new Error("Status must be 1 to 120 characters");
  if (category !== undefined && (!category.trim() || category.length > 120))
    throw new Error("Category must be 1 to 120 characters");
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50))
    throw new Error("Limit must be an integer from 1 to 50");

  let query = database
    .from("content_calendar")
    .select(
      "id,title,slug,status,sort_order,category,target_keywords,pillar,funnel_stage,target_publish_date,actual_publish_date,author,notes,seo_title,seo_description,word_count_target,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status.trim());
  if (category) query = query.eq("category", category.trim());
  if (limit !== undefined) query = query.limit(limit + 1);

  const { data, error } = await query;
  if (error) throw new Error(`Could not read content calendar: ${error.message}`);
  const rows = data ?? [];
  return {
    items: limit === undefined ? rows : rows.slice(0, limit),
    count: limit === undefined ? rows.length : Math.min(rows.length, limit),
    truncated: limit !== undefined && rows.length > limit,
  };
}

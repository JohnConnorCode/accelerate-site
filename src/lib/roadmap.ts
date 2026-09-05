import "server-only";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import {
  isFeatureStatus,
  isFeaturePriority,
  type FeatureStatus,
  type FeaturePriority,
} from "@/lib/feature-board";

export interface PublicRoadmapCard {
  seed_key: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: FeaturePriority;
  category: string | null;
  acceptance_criteria: string;
}

/**
 * The public roadmap is a filtered read of the live `feature_requests`
 * board (the same table src/lib/revenue-os/work-board.ts and
 * /admin/features operate on), not a static export — the self-hosting pitch
 * on /open-source explicitly sells "acceptance criteria written out for
 * every planned change" as a live feature, so this must reflect the real
 * board, not a build-time snapshot.
 *
 * Never select notes, owner, lease fields, or claimed_at: notes carries agent evidence
 * (commit SHAs, branch names, internal identities) that has no reason to be
 * public. A card only appears here once it carries a `category:` label,
 * which every card authored through scripts/feature-backlog-data.mjs's
 * card() factory already has — a public submission (src/app/api/roadmap/
 * route.ts) is inserted with no labels at all, so it stays invisible here
 * until a human triages it in /admin/features and gives it one.
 */
export async function getPublicRoadmapCards(): Promise<PublicRoadmapCard[]> {
  const supabase = createPlatformServiceRoleClient("public-roadmap");
  const { data, error } = await supabase
    .from("feature_requests")
    .select("seed_key, title, description, status, priority, labels, acceptance_criteria")
    .is("archived_at", null)
    .not("seed_key", "is", null);
  if (error) throw new Error(`Could not load roadmap: ${error.message}`);

  const cards: PublicRoadmapCard[] = [];
  for (const row of data ?? []) {
    const labels = Array.isArray(row.labels) ? (row.labels as string[]) : [];
    const category = labels.find((label) => label.startsWith("category:"));
    if (!category) continue; // untriaged (e.g. a raw public submission) — not shown yet
    if (!isFeatureStatus(row.status) || !isFeaturePriority(row.priority)) continue;
    if (!row.seed_key || !row.title) continue;
    cards.push({
      seed_key: row.seed_key,
      title: row.title,
      description: row.description ?? "",
      status: row.status,
      priority: row.priority,
      category: category.slice("category:".length),
      acceptance_criteria: row.acceptance_criteria ?? "",
    });
  }
  return cards;
}

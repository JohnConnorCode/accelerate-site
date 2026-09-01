import assert from "node:assert/strict";
import {
  applyPipelineView,
  countPipelineSystemViews,
  DEFAULT_PIPELINE_VIEW,
  type PipelineViewOpportunity,
} from "../src/lib/admin/pipelineViews";

const now = new Date("2026-08-24T15:00:00.000Z");
const base: PipelineViewOpportunity = {
  id: "base",
  name: "Base",
  email: "base@example.com",
  stage: "qualified",
  canonical_stage: "qualified",
  estimated_value: 10000,
  next_action: "Follow up",
  next_action_at: "2026-08-28T15:00:00.000Z",
  created_at: "2026-08-20T15:00:00.000Z",
  owner_email: "founder@acceleratewith.us",
};
const fixtures: PipelineViewOpportunity[] = [
  { ...base, id: "missing", name: "Missing action", next_action: null, next_action_at: null },
  { ...base, id: "overdue", name: "Overdue", next_action_at: "2026-08-20T15:00:00.000Z" },
  { ...base, id: "upcoming", name: "Upcoming", next_meeting_at: "2026-08-26T15:00:00.000Z" },
  {
    ...base,
    id: "risk",
    name: "Quiet account",
    next_action_at: "2026-09-20T15:00:00.000Z",
    last_activity_at: "2026-08-01T15:00:00.000Z",
  },
  {
    ...base,
    id: "proposal",
    name: "Proposal",
    stage: "proposal",
    canonical_stage: "proposal",
    next_action_at: "2026-09-20T15:00:00.000Z",
  },
  {
    ...base,
    id: "win",
    name: "Recent win",
    stage: "won",
    canonical_stage: "won",
    closed_at: "2026-08-18T15:00:00.000Z",
    next_action: null,
    next_action_at: null,
  },
  {
    ...base,
    id: "old-win",
    name: "Old win",
    stage: "won",
    canonical_stage: "won",
    closed_at: "2026-06-01T15:00:00.000Z",
    next_action: null,
    next_action_at: null,
  },
];

const counts = countPipelineSystemViews(fixtures, now);
assert.equal(counts["missing-next-action"], 1);
assert.equal(counts.overdue, 1);
assert.equal(counts["at-risk"], 1);
assert.equal(counts["recent-wins"], 1);
assert.deepEqual(
  applyPipelineView(fixtures, { ...DEFAULT_PIPELINE_VIEW, systemView: "at-risk" }, now).map(
    (item) => item.id,
  ),
  ["risk"],
);
assert.deepEqual(
  applyPipelineView(
    fixtures,
    { ...DEFAULT_PIPELINE_VIEW, systemView: "all", search: "quiet" },
    now,
  ).map((item) => item.id),
  ["risk"],
);
assert.equal(
  applyPipelineView(
    fixtures,
    { ...DEFAULT_PIPELINE_VIEW, systemView: "all", owner: "unassigned" },
    now,
  ).length,
  0,
);
assert.deepEqual(
  applyPipelineView(
    fixtures,
    {
      ...DEFAULT_PIPELINE_VIEW,
      systemView: "all",
      sortField: "estimated_value",
      sortDirection: "asc",
    },
    now,
  ).map((item) => item.id),
  [...fixtures].sort((a, b) => a.id.localeCompare(b.id)).map((item) => item.id),
);
console.log(
  "Pipeline operator view matching, counts, search, owner filtering, and deterministic sorting passed.",
);

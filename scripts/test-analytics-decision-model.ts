import assert from "node:assert/strict";
import { summarizeReplySignals, summarizeRevenueAnalytics } from "../src/lib/revenue-os/analytics";
import { createDefaultPipelineStageResolver } from "../src/lib/revenue-os/pipeline-stage-resolver";

const stages = createDefaultPipelineStageResolver();

const opportunities = [
  {
    id: "one",
    stage: "proposal",
    source: "website",
    source_detail: null,
    campaign_id: "campaign-a",
    owner_email: "founder@example.com",
    next_action: "Review proposal",
    next_action_at: "2026-08-25T12:00:00Z",
    estimated_value: 10000,
    won_value: 0,
    probability: 50,
    created_at: "2026-08-20T12:00:00Z",
  },
  {
    id: "two",
    stage: "won",
    source: "referral",
    source_detail: "Partner",
    campaign_id: null,
    owner_email: "founder@example.com",
    next_action: null,
    next_action_at: null,
    estimated_value: 20000,
    won_value: 18000,
    probability: 100,
    created_at: "2026-08-21T12:00:00Z",
  },
  {
    id: "three",
    stage: "qualified",
    source: null,
    source_detail: null,
    campaign_id: null,
    owner_email: null,
    next_action: null,
    next_action_at: null,
    estimated_value: 8000,
    won_value: 0,
    probability: 25,
    created_at: "2026-08-22T12:00:00Z",
  },
];

const all = summarizeRevenueAnalytics(opportunities, { days: 30 }, stages);
assert.equal(all.funnel.opportunities, 3);
assert.equal(all.funnel.pipelineValue, 18000);
assert.equal(
  all.forecast.weightedPipeline,
  7000,
  "forecast must use recorded open value × probability",
);
assert.equal(
  all.funnel.wonRevenue,
  18000,
  "recorded won revenue must remain separate from forecast",
);
assert.equal(all.quality.missingAttribution, 1);
assert.equal(all.quality.missingOwner, 1);
assert.equal(all.quality.missingNextAction, 1);
assert.deepEqual(all.filterOptions.sources, ["Partner", "Unknown", "website"]);

const filtered = summarizeRevenueAnalytics(
  opportunities,
  {
    days: 30,
    owner: "founder@example.com",
    stage: "proposal",
  },
  stages,
);
assert.deepEqual(filtered.opportunityIds, ["one"]);
assert.equal(filtered.forecast.weightedPipeline, 5000);
assert.equal(filtered.appliedFilters.stage, "proposal");

const replies = summarizeReplySignals([
  { conversation_id: "a", direction: "inbound", created_at: "2026-08-24T10:00:00Z" },
  { conversation_id: "a", direction: "outbound", created_at: "2026-08-24T12:00:00Z" },
  { conversation_id: "b", direction: "inbound", created_at: "2026-08-24T09:00:00Z" },
  { conversation_id: "c", direction: "outbound", created_at: "2026-08-24T08:00:00Z" },
]);
assert.deepEqual(replies, {
  inboundConversations: 2,
  repliedConversations: 1,
  replyRate: 50,
  medianResponseHours: 2,
});
console.log(
  "Analytics filters, recorded-vs-estimated revenue, quality counts, and reply evidence passed.",
);

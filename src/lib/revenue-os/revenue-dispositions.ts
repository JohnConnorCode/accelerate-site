/** Ownership of each value the Revenue screen shows: canonical opportunity
 * analytics, or a retained source field with no canonical replacement yet.
 * Browser-safe, so the read route, its fixtures and the fictional demo runtime
 * all report the same dispositions. */
export interface RevenueFieldDisposition {
  field: string;
  owner: "canonical" | "retained";
  note: string;
}

export function revenueDispositions(): RevenueFieldDisposition[] {
  return [
    {
      field: "pipelineValue",
      owner: "canonical",
      note: "Sum of opportunities.estimated_value for stages whose role is open",
    },
    { field: "weightedValue", owner: "canonical", note: "Open estimated_value x probability" },
    { field: "wonRevenue", owner: "canonical", note: "Sum of opportunities.won_value" },
    {
      field: "totalMRR",
      owner: "retained",
      note: "clients.monthly_value contract value; no canonical replacement",
    },
    {
      field: "totalOneTime",
      owner: "retained",
      note: "clients.one_time_value; no canonical replacement",
    },
    {
      field: "proposalRevenue",
      owner: "retained",
      note: "accepted proposals.total_monthly; kept separate from opportunity revenue",
    },
  ];
}

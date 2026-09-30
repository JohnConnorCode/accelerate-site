import { formatDateOnly, getUtcMonthKey } from "../date-format";

export interface RevenueClient {
  id?: string;
  business_name?: string | null;
  industry?: string | null;
  status?: string | null;
  monthly_value?: number | string | null;
  one_time_value?: number | string | null;
  contract_start?: string | null;
  created_at?: string | null;
}

export interface RevenueProposal {
  total_monthly?: number | string | null;
}

function cents(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid recorded contract value");
  return Math.round(amount * 100);
}

/** Retained agreement values remain separate from opportunity and payment values. */
export function summarizeRetainedContractValue(
  clients: RevenueClient[],
  acceptedProposals: RevenueProposal[],
) {
  return {
    totalMRR:
      clients
        .filter((client) => client.status === "active")
        .reduce((sum, client) => sum + cents(client.monthly_value), 0) / 100,
    totalOneTime: clients.reduce((sum, client) => sum + cents(client.one_time_value), 0) / 100,
    proposalRevenue:
      acceptedProposals.reduce((sum, proposal) => sum + cents(proposal.total_monthly), 0) / 100,
  };
}

/** Current active contracts grouped by start month, not a historical MRR ledger.
 * Both the connected Revenue read and the fictional demo use this projection. */
export function summarizeContractRevenue(clients: RevenueClient[], proposals: RevenueProposal[]) {
  const totals = summarizeRetainedContractValue(clients, proposals);
  const active = clients.filter((client) => client.status === "active");
  const industries = new Map<string, number>();
  const months = new Map<string, number>();
  let creationDateFallbackCount = 0;
  let unknownDateCount = 0;
  let unknownDateCents = 0;
  const validDate = (value: string | null | undefined) =>
    value && Number.isFinite(Date.parse(value)) ? value : null;

  const byClient = active
    .map((client) => {
      const monthlyCents = cents(client.monthly_value);
      const industry = client.industry?.replace(/_/g, " ") || "Other";
      industries.set(industry, (industries.get(industry) ?? 0) + monthlyCents);
      let date = validDate(client.contract_start);
      if (!date) {
        date = validDate(client.created_at);
        if (date) creationDateFallbackCount++;
      }
      if (date) {
        const month = getUtcMonthKey(date);
        months.set(month, (months.get(month) ?? 0) + monthlyCents);
      } else {
        unknownDateCount++;
        unknownDateCents += monthlyCents;
      }
      return {
        id: client.id,
        name: client.business_name || "Unnamed client",
        monthly: monthlyCents / 100,
        oneTime: cents(client.one_time_value) / 100,
      };
    })
    .sort((a, b) => b.monthly - a.monthly);

  let runningCents = 0;
  const mrrTimeline = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      runningCents += value;
      return {
        date: formatDateOnly(`${month}-01`, { month: "short", year: "2-digit" }),
        mrr: runningCents / 100,
      };
    });
  if (unknownDateCount)
    mrrTimeline.push({ date: "Date unavailable", mrr: (runningCents + unknownDateCents) / 100 });

  const nonOnboarding = clients.filter((client) => client.status !== "onboarding");
  return {
    ...totals,
    activeCount: active.length,
    avgClientValue: active.length ? Math.round(totals.totalMRR / active.length) : 0,
    // Compatibility field: this is the current non-onboarding share, not a period churn rate.
    churnRate: nonOnboarding.length
      ? Math.round(
          (nonOnboarding.filter((client) => client.status === "churned").length /
            nonOnboarding.length) *
            100,
        )
      : 0,
    industryBreakdown: [...industries.entries()]
      .map(([name, value]) => ({ name, value: value / 100 }))
      .sort((a, b) => b.value - a.value),
    byClient,
    mrrTimeline,
    timelineDates: { creationDateFallbackCount, unknownDateCount },
  };
}

import type { Industry } from "@/lib/types";

const painPointDefaults: Record<Industry, string[]> = {
  home_services: ["missed_calls", "slow_response", "not_enough_leads"],
  law_firm: ["intake_bottleneck", "after_hours_leads", "no_follow_up"],
  professional_services: ["referral_dependent", "manual_processes", "no_tracking"],
  real_estate: ["cold_leads", "low_conversion", "no_follow_up"],
  other: [],
};

const goalDefaults: Record<Industry, string[]> = {
  home_services: ["more_leads", "faster_response", "automate_tasks"],
  law_firm: ["more_leads", "faster_response", "better_follow_up"],
  professional_services: ["more_leads", "automate_tasks", "track_roi"],
  real_estate: ["more_leads", "better_follow_up", "automate_tasks"],
  other: [],
};

export function getSmartDefaults(industry: Industry) {
  return {
    painPoints: painPointDefaults[industry] ?? [],
    topGoals: goalDefaults[industry] ?? [],
  };
}

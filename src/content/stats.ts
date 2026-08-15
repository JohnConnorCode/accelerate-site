import type { Stat } from "@/lib/types";

export const stats: Stat[] = [
  {
    value: "45",
    numericValue: 45,
    suffix: "s",
    label: "Avg. first response time",
    detail: "Down from 8+ minutes",
  },
  {
    value: "38",
    numericValue: 38,
    suffix: "%",
    label: "More jobs booked",
    detail: "What we build against",
  },
  {
    value: "10",
    numericValue: 10,
    suffix: "+",
    label: "Hours reclaimed per week",
    detail: "What we build against",
  },
  {
    // Replaced a "94% client retention, year over year" claim. The company
    // launched in Feb 2026, so there is no year to measure over. This one is a
    // policy anyone can check against the pricing page instead of a metric.
    value: "0",
    numericValue: 0,
    suffix: "",
    label: "Lock-in contracts",
    detail: "Month to month after setup",
  },
];

import type { Stat } from "@/lib/types";

export const stats: Stat[] = [
  {
    value: "10",
    numericValue: 10,
    suffix: "",
    label: "Hours back per person, per week",
    detail: "Typical on the workflows we take on",
  },
  {
    value: "1",
    numericValue: 1,
    suffix: "",
    label: "Role of routine work absorbed",
    detail: "Labor moves to higher-precision work",
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

import { z } from "zod";

export const WORK_VIEW_GROUPS = {
  none: "No grouping",
  priority: "By priority",
  source: "By source",
  related_type: "By record type",
  status: "By status",
  owner: "By owner",
  due_date: "By due date",
} as const;

export const WORK_VIEW_COLUMNS = {
  due_date: "Due date",
  status: "Status",
  priority: "Priority",
  related_name: "Related record",
  source: "Source",
} as const;

export const WORK_VIEW_PRIORITY_FILTERS = {
  all: "Any priority",
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

export const WORK_VIEW_DUE_FILTERS = {
  any: "Any date",
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  unscheduled: "No due date",
} as const;

export const WORK_VIEW_RELATED_TYPES = {
  lead: "Lead",
  contact: "Contact",
  client: "Client",
  conversation: "Conversation",
  opportunity: "Opportunity",
  partner: "Partner",
  proposal: "Proposal",
} as const;

export const WORK_VIEW_SORTS = {
  due_date: "Due date",
  created_at: "Created date",
} as const;

export const WORK_VIEW_SORT_DIRECTIONS = {
  asc: "Oldest / soonest first",
  desc: "Newest / latest first",
} as const;

export const DEFAULT_WORK_VIEW_COLUMNS = [
  "due_date",
  "status",
  "priority",
  "related_name",
  "source",
] as const;

const key = <T extends Record<string, unknown>>(values: T) =>
  z.enum(Object.keys(values) as [keyof T & string, ...(keyof T & string)[]]);

export const workViewConfigSchema = z
  .object({
    owner: z.enum(["team", "me", "unassigned"]),
    status: z.enum(["pending", "snoozed", "completed", "all"]),
    source: z.string().max(100),
    search: z.string().max(100),
    groupBy: key(WORK_VIEW_GROUPS),
    priority: key(WORK_VIEW_PRIORITY_FILTERS).default("all"),
    due: key(WORK_VIEW_DUE_FILTERS).default("any"),
    relatedType: key({ all: "Any record type", ...WORK_VIEW_RELATED_TYPES }).default("all"),
    sortBy: key(WORK_VIEW_SORTS).default("due_date"),
    sortDirection: key(WORK_VIEW_SORT_DIRECTIONS).default("asc"),
    columns: z
      .array(key(WORK_VIEW_COLUMNS))
      .min(1)
      .max(5)
      .default([...DEFAULT_WORK_VIEW_COLUMNS]),
  })
  .strict();

export type WorkViewConfig = z.infer<typeof workViewConfigSchema>;
export type WorkViewColumn = keyof typeof WORK_VIEW_COLUMNS;

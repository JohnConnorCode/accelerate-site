/** Ownership of each value the Activity screen shows: the canonical
 * cross-channel ledger, or a retained audit-log field that remains the source
 * of record for who changed what. Browser-safe, so the read route, its fixtures
 * and the fictional demo runtime report the same dispositions. */
export interface ActivityFieldDisposition {
  field: string;
  owner: "canonical" | "retained";
  note: string;
}

export function activityDispositions(): ActivityFieldDisposition[] {
  return [
    {
      field: "activityType",
      owner: "canonical",
      note: "activities.activity_type from the cross-channel ledger",
    },
    { field: "title", owner: "canonical", note: "activities.title" },
    { field: "summary", owner: "canonical", note: "activities.summary" },
    { field: "occurredAt", owner: "canonical", note: "activities.occurred_at" },
    {
      field: "actorEmail",
      owner: "retained",
      note: "audit_log.actor_email; source evidence for who acted",
    },
    {
      field: "action",
      owner: "retained",
      note: "audit_log.action; source evidence for what changed",
    },
    {
      field: "entityType",
      owner: "retained",
      note: "audit_log.entity_type; source evidence for the affected record",
    },
  ];
}

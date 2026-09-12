/** Pure authoritative action classifications shared by generation and execution. */
export type ReversibilityClass = "reversible" | "compensable" | "irreversible";
export type ActionImpact = "read" | "internal_write" | "external_action";

interface ActionReversibility {
  actionType: string;
  impact: ActionImpact;
  reversibility: ReversibilityClass;
  rationale: string;
}

export const ACTION_REVERSIBILITY: readonly ActionReversibility[] = [
  {
    actionType: "update_opportunity_details",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "A new reviewed detail update restores prior values against current state; no automatic inverse is promised.",
  },
  {
    actionType: "today_view_change",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Restore a previous view with a newly reviewed change against the current revision. Personal layout receipts retain the exact prior request.",
  },
  {
    actionType: "send_radar_outreach",
    impact: "external_action",
    reversibility: "irreversible",
    rationale:
      "An external email cannot be recalled. Every exact message and introduction requires human approval; uncertain acceptance must be reconciled, never automatically retried.",
  },
  {
    actionType: "review_radar_relationship",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Revoke or supersede with a new reviewed assertion. Original citation, canonical endpoint snapshot, receipt and audit history remain immutable.",
  },
  {
    actionType: "review_radar_assessment",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Review a new assessment to replace current estimates. Original judgments and audit history remain immutable; no deletion or automatic inverse.",
  },
  {
    actionType: "update_radar_store",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Correct source reviews or draft records through a new approved revision. Source versions, citation snapshots, receipts and reported outcomes remain historical; no automatic deletion or inverse is promised.",
  },
  {
    actionType: "update_module_configuration",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "A new reviewed configuration proposal restores settings or enablement. Bundled read-policy registration and historical effects are retained; no automatic inverse is promised.",
  },
  {
    actionType: "update_workspace_brand",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Restore prior values with a new reviewed branding proposal against the current revision; no automatic inverse is promised.",
  },
  {
    actionType: "create_task_batch",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Assigned tasks remain individually editable; no automatic deletion of an approved delivery checklist is implied.",
  },
  ...["create_stripe_invoice_draft", "send_stripe_invoice", "publish_invoice_page"].map(
    (actionType) => ({
      actionType,
      impact: "external_action" as const,
      reversibility: "irreversible" as const,
      rationale:
        "Creates or sends an external billing document; no automatic compensator is registered, so explicit human approval is permanent.",
    }),
  ),
  ...["bootstrap_coworker", "store_agent_memory", "record_learned_policy", "approve_learning"].map(
    (actionType) => ({
      actionType,
      impact: "internal_write" as const,
      reversibility: "compensable" as const,
      rationale:
        "A reviewed configuration change or superseding memory entry compensates for this action; no automatic inverse is promised.",
    }),
  ),
  {
    actionType: "send_collection_reminder",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "A customer reminder leaves the system and requires human approval.",
  },
  {
    actionType: "send_email",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Delivery leaves the system; no recall exists.",
  },
  {
    actionType: "send_gmail_reply",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Delivery leaves the system; no recall exists.",
  },
  {
    actionType: "transition_opportunity",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "A reverse transition restores the stage, but terminal-role rules may demand justification, so it runs as its own action rather than silently.",
  },
  {
    actionType: "create_task",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "The created row is removed; creation left no other trace.",
  },
  {
    actionType: "update_task",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "Prior field values are captured at execution and restored.",
  },
  {
    actionType: "delete_task",
    impact: "internal_write",
    reversibility: "reversible",
    rationale:
      "An atomic full-row inverse restores the task identity; dependency or state changes refuse.",
  },
  {
    actionType: "update_next_action",
    impact: "internal_write",
    reversibility: "reversible",
    rationale: "Prior next_action values are captured at execution and restored.",
  },
  {
    actionType: "activate_campaign",
    impact: "external_action",
    reversibility: "irreversible",
    rationale: "Activation starts real sends; traffic already emitted cannot be recalled.",
  },
  {
    actionType: "duplicate_campaign",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "The copy is an unsent draft that can be revised separately; provenance and audit remain. No automatic inverse is promised.",
  },
  {
    actionType: "bulk_tag_contacts",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Tags can be changed by another reviewed operation; removing an already-existing tag is not an automatic inverse.",
  },
  {
    actionType: "bulk_suppress_contacts",
    impact: "internal_write",
    reversibility: "irreversible",
    rationale:
      "Suppression stops pending memberships immediately and no service restores them automatically.",
  },
  {
    actionType: "bulk_enroll_contacts",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Members remain queued until activation. Later delivery and audit history cannot be automatically undone.",
  },
  {
    actionType: "admin_layout_change",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Layout history supports a separately reviewed restore; automatic exact-state undo is not available.",
  },
  {
    actionType: "create_founder_note",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Notes have no delete primitive by design; removal is a deliberate manual act, not an automatic undo.",
  },
  {
    actionType: "identity_review",
    impact: "internal_write",
    reversibility: "irreversible",
    rationale:
      "The executor always refuses this type and points at the review workbench, so no effect ever exists to undo; autonomous runs refuse like all irreversible effects.",
  },
] as const;

export function reversibilityOf(actionType: string): ActionReversibility {
  const entry = ACTION_REVERSIBILITY.find((candidate) => candidate.actionType === actionType);
  if (!entry) throw new Error(`Action type ${actionType} declares no reversibility class`);
  return entry;
}

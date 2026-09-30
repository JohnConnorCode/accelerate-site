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
  },
  {
    actionType: "workspace_configuration_change",
    impact: "internal_write",
    reversibility: "compensable",
    rationale:
      "Restore public preferences through a newly approved change. Provider disconnect requires secure reconnection; completed sync work and history remain. No automatic inverse is promised.",

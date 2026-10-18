import { randomUUID } from "node:crypto";
import { MemorySupabase, type Row } from "./memory-supabase";
export class AuthorizedMemorySupabase extends MemorySupabase {
  constructor(seed: Record<string, Row[]> = {}) {
    super(seed);
    // Happy-path transport fixture only. Atomicity/privileges are proven by
    // test-opportunity-create-postgres.mjs against the actual SQL function.
    this.rpc("create_opportunity_with_receipt", (args) => {
      const input = args.p_input as Row;
      const previous = this.rows("audit_log").find(
        (row) =>
          row.tenant_id === args.p_tenant &&
          (row.metadata as Row)?.creationRequestId === args.p_request_id,
      );
      if (previous) {
        if (
          JSON.stringify((previous.metadata as Row).input) !== JSON.stringify(input) ||
          previous.actor_email !== args.p_actor_email
        )
          return { data: null, error: { code: "40001", message: "Changed intent" } };
        return previous.after_state;
      }
      const row = {
        id: randomUUID(),
        tenant_id: args.p_tenant,
        name:
          input.opportunityName ||
          this.rows("companies").find((row) => row.id === args.p_company)?.name,
        email: input.email,
        contact_id: args.p_contact,
        company_id: args.p_company,
        source: input.source,
        stage: "new",
        estimated_value: input.estimatedValue,
        next_action: input.nextAction,
        next_action_at: input.nextActionAt,
        owner_email: args.p_actor_email,
      };
      (this.tables.opportunities ??= []).push(row);
      (this.tables.stage_events ??= []).push({
        id: randomUUID(),
        tenant_id: args.p_tenant,
        opportunity_id: row.id,
        to_stage: "new",
      });
      (this.tables.activities ??= []).push({
        id: randomUUID(),
        tenant_id: args.p_tenant,
        opportunity_id: row.id,
        contact_id: row.contact_id,
        company_id: row.company_id,
        activity_type: "opportunity_created",
        source: row.source,
        external_id: `opportunity:${row.id}:created`,
      });
      (this.tables.audit_log ??= []).push({
        id: randomUUID(),
        tenant_id: args.p_tenant,
        actor_email: args.p_actor_email,
        action: "opportunity.created",
        entity_type: "opportunity",
        entity_id: row.id,
        after_state: row,
        metadata: { creationRequestId: args.p_request_id, input },
      });
      return row;
    });
    this.rpc("check_autonomy", ({ p_action_key }) => ({
      action_key: p_action_key,
      allowed: false,
      level: "always_ask",
      requires_approval: true,
      policy_id: null,
      hard_floor: false,
      reason: "No standing policy; explicit human approval required",
    }));
  }
}

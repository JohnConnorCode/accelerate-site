import { resolveIdentityFixture } from "./identity-action-fixture";
import type { ResolveIdentityInput } from "../../src/lib/revenue-os/identity";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeepStrictEqual } from "node:util";
import { MemorySupabase, type Row } from "./memory-supabase";
import { loadPipelineStages } from "../../src/lib/revenue-os/pipeline-stage-resolver";
import { requireReopenEligibility } from "../../src/lib/revenue-os/pipeline-transition-policy";

/** Transport fixture only. Native tests prove the actual SQL authority/transaction. */
export function installPipelineActionFixture(mem: MemorySupabase) {
  const db = mem.client as SupabaseClient;
  mem.rpc("resolve_revenue_identity", ({ p_input }) =>
    resolveIdentityFixture(db, p_input as ResolveIdentityInput),
  );
  for (const a of mem.rows("action_queue")) {
    if (!["transition_opportunity", "update_opportunity_details"].includes(String(a.action_type)))
      continue;
    const payload = a.payload as Row;
    const current = mem.rows("opportunities").find((r) => r.id === payload.opportunityId);
    if (current) payload.expectedState ??= structuredClone(current);
  }
  mem.rpc(
    "apply_pipeline_action",
    async ({ p_action_id, p_operation, p_payload, p_actor, p_system_source }) => {
      const payload = p_payload as Row;
      const action = mem.rows("action_queue").find((a) => a.id === p_action_id);
      if (action?.status === "executed")
        return {
          [p_operation === "reorder_opportunities" ? "result" : "opportunity"]: action.result,
          changed: false,
        };
      if (p_operation === "create_opportunity") {
        const record = { ...(payload.record as Row) };
        if (payload.identity) {
          const identity = await resolveIdentityFixture(
            db,
            payload.identity as unknown as ResolveIdentityInput,
          );
          Object.assign(record, {
            contact_id: identity.contact.id,
            company_id: identity.company.id,
            name: record.name || identity.company.name,
          });
        }
        const { data, error } = await db
          .from("opportunities")
          .insert({
            ...record,
            stage: "new",
            pipeline: "sales",
            probability: 10,
            owner_email: p_actor,
          })
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        await db
          .from("stage_events")
          .insert({
            opportunity_id: data.id,
            from_stage: null,
            to_stage: "new",
            actor_email: p_actor,
          });
        if (action) Object.assign(action, { status: "executed", result: data });
        return { opportunity: data, changed: true };
      }
      if (p_operation === "reorder_opportunities") {
        const updates = payload.updates as Row[];
        const rows = mem
          .rows("opportunities")
          .filter((row) => updates.some((item) => item.id === row.id))
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        if (
          new Set(updates.map((item) => item.id)).size !== updates.length ||
          rows.length !== updates.length ||
          !isDeepStrictEqual(rows, payload.expectedState) ||
          updates.some((item) => rows.find((row) => row.id === item.id)?.stage !== item.column_key)
        )
          throw new Error("Opportunities changed or are unavailable; refresh before reordering");
        for (const item of updates)
          Object.assign(
            rows.find((row) => row.id === item.id)!,
            { sort_order: item.sort_order },
          );
        const result = { affected: rows.length, opportunities: structuredClone(rows) };
        if (action) Object.assign(action, { status: "executed", result });
        return { result, changed: true };
      }
      const current = mem.rows("opportunities").find((r) => r.id === payload.opportunityId);
      if (!current) throw new Error("Target opportunity not found");
      if (action?.status === "executed") return { opportunity: action.result, changed: false };
      if (
        action &&
        action.source_context !== "operator_ui" &&
        p_operation === "transition_opportunity" &&
        current.stage === payload.stage
      )
        throw new Error(`Opportunity is already in stage "${payload.stage}"`);
      if (payload.expectedStage && current.stage !== payload.expectedStage)
        throw new Error("Underlying opportunity state changed since proposal");
      if (payload.expectedState && !isDeepStrictEqual(payload.expectedState, current))
        throw new Error(
          "The opportunity changed while you were editing it. Refresh and try again.",
        );
      if (payload.expectedUpdatedAt && payload.expectedUpdatedAt !== current.updated_at)
        throw new Error(
          "The opportunity changed while you were editing it. Refresh and try again.",
        );
      const before = structuredClone(current);
      const happened = new Date().toISOString();
      let toRole;
      let patch: Row = {};
      if (p_operation === "transition_opportunity") {
        const stages = await loadPipelineStages(mem.client, current.tenant_id as string);
        const from = stages.canonicalStage(String(current.stage));
        const to = stages.canonicalStage(String(payload.stage));
        if (!from) throw new Error(`Invalid pipeline stage: ${current.stage}`);
        if (!to) throw new Error(`Cannot move an opportunity to unknown stage ${payload.stage}`);
        const fromMeta = stages.getMeta(from)!;
        const toMeta = stages.getMeta(to)!;
        requireReopenEligibility(
          fromMeta.role,
          toMeta.role,
          from,
          to,
          payload.reason as string | undefined,
          Boolean(payload.allowTerminalReopen),
        );
        if (toMeta.role === "lost" && !String(payload.lossReason ?? "").trim())
          throw new Error("A loss reason is required when closing an opportunity as lost");
        toRole = toMeta.role;
        if (
          current.stage !== to ||
          (typeof payload.sortOrder === "number" && current.sort_order !== payload.sortOrder)
        ) {
          patch = {
            stage: to,
            last_activity_at: happened,
            probability: toMeta.probability,
            closed_at: toRole === "open" ? null : happened,
            loss_reason: toRole === "lost" ? payload.lossReason : null,
          };
          if (toRole === "won" && !current.won_value)
            patch.won_value = current.estimated_value ?? 0;
          if (typeof payload.sortOrder === "number") patch.sort_order = payload.sortOrder;
        }
      } else patch = payload.patch as Row;
      const changed = Object.entries(patch).some(([k, v]) => !isDeepStrictEqual(current[k], v));
      if (changed) {
        Object.assign(current, patch);
        const write = async (table: string, row: Row) => {
          const { error } = await db.from(table).insert(row);
          if (error) throw new Error(error.message);
        };
        const metadata = {
          actionId: p_action_id,
          systemSource: p_system_source,
          loss_reason: payload.lossReason,
        };
        if (p_operation === "transition_opportunity") {
          await write("stage_events", {
            opportunity_id: current.id,
            from_stage: before.stage,
            to_stage: current.stage,
            source: payload.source ?? "admin",
            actor_email: p_actor,
            reason: payload.reason,
            metadata,
          });
          await write("activities", {
            activity_type: "opportunity_stage_changed",
            opportunity_id: current.id,
            source: payload.source ?? "admin",
            actor_email: p_actor,
            metadata,
          });
        }
        await write("audit_log", {
          action:
            p_operation === "transition_opportunity"
              ? "opportunity.stage_changed"
              : "opportunity.updated",
          actor_email: p_actor,
          before_state: before,
          after_state: structuredClone(current),
          metadata,
        });
      }
      if (action)
        Object.assign(action, {
          status: "executed",
          result: structuredClone(current),
          reversibility: "compensable",
        });
      return { opportunity: structuredClone(current), changed, toRole };
    },
  );
}

# AGENTS.md Proposed Addition: Northstar Runtime Primitives Section

Insert this section between "Read in this order" (ending with the
`npm run verify:agent-contract` paragraph) and "One operating path" in
`accelerate-site/AGENTS.md`.

---

## Northstar runtime primitives

These modules implement the agent-native business runtime defined in
`docs/NORTHSTAR.md`. Every coworker, trigger, and operator surface builds on
them — they are not optional helpers.

| Primitive         | Module               | Purpose                                                                                                 |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| WorkItems         | `work-items.ts`      | Durable, lease-based, retryable, schedulable work with `claim_work_item` advisory lock                  |
| Capability Graph  | `capabilities.ts`    | One canonical workspace capability resolution per tenant                                                |
| Evidence & Claims | `claims.ts`          | Evidence-backed facts with human truth hierarchy (human_confirmed → model_inference)                    |
| Autonomy Policy   | `autonomy-policy.ts` | Five-level ladder (Prohibited → Autonomous) with hard safety floors                                     |
| Coworkers         | `coworkers.ts`       | First-class configuration objects over the shared runtime                                               |
| Agent Activity    | `agent-activity.ts`  | Readable timeline (not raw audit dump) on every major record                                            |
| Work Executor     | `work-executor.ts`   | Claims and executes work; consults learned policies, checks budgets, stores agent memory                |
| Work Scheduler    | `work-scheduler.ts`  | Auto-creates daily/weekly recurring work items with date-based deduplication                            |
| Plugins           | `plugins.ts`         | Manifest-driven capability extensions with governance lifecycle                                         |
| MCP Client        | `mcp-client.ts`      | Discovers and calls external MCP tools under governance                                                 |
| MCP Server        | `mcp-server.ts`      | Exposes Accelerate tools/resources via MCP with tenant isolation                                        |
| Memory            | `memory.ts`          | Five distinct categories (canonical, activity, knowledge, agent, learned_policy); unified `queryMemory` |
| Budgets           | `budgets.ts`         | Per-coworker or global resource limits; six budget kinds; exhaustion is a normal state                  |

**Registered coworkers** (each registers capabilities, autonomy policies, and work kinds):

| Coworker       | ID               | Work kinds                                                                                                  |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Sales          | `sales`          | `qualify_lead`, `draft_followup`, `review_stale_proposal`, `gather_lead_context`, `schedule_followup_check` |
| Business Pulse | `business-pulse` | `daily_digest`, `detect_stale_deals`, `detect_stage_bottleneck`, `detect_velocity_change`                   |
| Meeting Intel  | `meeting-intel`  | `pre_call_brief`, `post_meeting_process`, `update_crm_from_meeting`                                         |
| Finance        | `finance`        | `weekly_revenue_reconciliation`, `detect_overdue_payments`, `revenue_stage_audit`                           |
| Operations     | `operations`     | `daily_health_check`, `integration_status_audit`, `data_quality_scan`                                       |

# Meeting commitments

Turn a stored meeting into an assigned, dated delivery checklist. The plugin
creates tasks only after a human approves the exact plan. It starts disabled.

## Complete a checklist

1. In **Plugins**, enable **Meeting commitments**, then open `/admin/meeting-commitments`.
   Use an authorized workspace with a stored meeting and valid task assignees.
2. Select the source and enter one to ten tasks. Each task has a title,
   description, due date and assignee. The selected meeting must exist in the active workspace.
3. Preview the checklist and inspect its source, assignments and dates. Submit
   the exact preview for approval, then approve through the shared action queue.
4. Inspect the execution receipt and the created tasks. A preview or pending
   proposal is not evidence that tasks were created.

Select a fictional discovery meeting and prepare two tasks: send the agreed summary and confirm the next appointment. After approval, expect two assigned tasks linked to that source.
Run `npm run test:business-workflows` for the controlled execution fixture,
including approvals, retries and real AI dispatch through the fixture services.
`npm run qa:demo-business-workflows` exercises the shared admin components using
fictional scenario data; demo records are session-local and never sent externally.

## AI, permissions and data

Use `prepare_meeting_commitments` and then
`propose_meeting_commitments` with the returned digest and stable request UUID.
AI/MCP and UI reuse the same workflow/domain services. Preparation does not write
business tasks. Approval execution rechecks active tenant, module state, source,
input, guest hash and host contract hash. Only the manifest's bounded source
projection enters the isolate. It has no network or raw database access.

The plugin has no additional public settings or provider credentials. Task
creation is deterministic and makes no paid API/model call. Hosting/database
usage and any surrounding AI chat use the workspace's existing configuration.

## Disable and recover

Disable in **Plugins** to block later execution, including pending approvals.
Existing tasks and receipts remain; use normal task controls to edit or complete
them. Do not assume disabling undoes approved work.

If a source or assignee is unavailable, correct the input before preparing a new
plan. If the preview, code or policy changed, prepare and approve a fresh plan.
Use the existing receipt and request identity for retries; do not manufacture a
new request to bypass an uncertain result. The host reuses matching task effects
rather than duplicating them. The test suite exercises this controlled behavior;
production permissions and database health require deployment-specific checks.

## Extend and upgrade

[`workflow.js`](workflow.js) returns a bounded task plan.
The [manifest](../../extensions/meeting-commitments.module.json) derives input, tools and
policy from the trusted host contracts in
[`plugin-workflow-contract.ts`](../../src/lib/revenue-os/plugin-workflow-contract.ts).
Business writes belong in the shared domain service, not the guest. Run
`npm run build:extensions`, `npm run verify:extensions`,
`npm run test:plugin-workflow-contract` and the business fixture after edits.
Host/guest upgrades can invalidate pending previews; prepare them again.
Follow the [documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md).

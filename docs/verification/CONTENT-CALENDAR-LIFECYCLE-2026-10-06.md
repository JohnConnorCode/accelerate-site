# Content calendar lifecycle verification

Bounded implementation for `content-calendar-lifecycle-parity`, prerequisite of
`admin-ai-parity-content`. This closes calendar item commands, not the whole
content domain. Review, migration rollout, merge and deployment remain separate.

## Semantic operation matrix

| Operation                                  | Admin interface                   | AI / workspace MCP                                    | Canonical owner and effect                                                                              |
| ------------------------------------------ | --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Filter/read                                | Content GET                       | `list_content_calendar`                               | `content-calendar.ts`; assistant returns five concise records and total matching count                  |
| Generate brief                             | New/Edit Content                  | `generate_content_brief`                              | Existing `content-brief.ts` provider service; working copy only                                         |
| Edit/clear fields                          | Edit Content, PATCH               | Existing update preview/proposal tools                | Existing validated update writer; expected item revision; nullable fields explicitly clear              |
| Create calendar item                       | New Content, POST                 | New command preview/proposal with `operation=create`  | Shared strict command + host-only atomic calendar/audit function; new UUID and normalized title/details |
| Permanently delete item                    | Edit Content confirmation, DELETE | New command preview/proposal with `operation=delete`  | Same function; exact item snapshot; approvals, audit and website pages retained                         |
| Move/reorder items                         | Content board, PATCH              | New command preview/proposal with `operation=reorder` | Same function; exact IDs, current columns and item revisions; all-or-nothing update                     |
| Column create/rename/delete/reassignment   | Shared Kanban controls            | Not covered by this slice                             | Existing shared Kanban owner; retained parent parity gap                                                |
| Website publication/assets/social delivery | Existing separate surfaces        | Separate existing coverage/gaps                       | No authority added by calendar commands; retained parent scope                                          |

The new tools are `preview_content_calendar_change` (read) and
`propose_content_calendar_change` (staged internal write), owned by Content in
registry v30. They never approve or execute their own proposals. Lifecycle writes
require a current authenticated tenant administrator, including administrator-bound
workspace OAuth MCP callers. Static integration credentials do not impersonate a
human administrator. Existing read and existing-item proposal behavior remains.

## Approval, retry and recovery

The shared schema rejects unknown fields, impossible dates, duplicate reordered
IDs and owner/provider fields. Assistant reorders contain at most ten items;
direct admin commands contain at most 250. Previews bind the normalized command,
stable UUID request key, exact item snapshots and all current column revisions to
a SHA-256 digest. Pending proposals expire after one hour. Revised commands and
changed items/columns require a fresh preview and approval.

The approved executor rechecks current membership, active tenant and Content
module before obtaining the host writer. The database transaction repeats these
checks and locks relevant authority, columns and items. Commands serialize per
tenant; item edits made through other writers are fenced by the reviewed revision.
Writes and the audit receipt commit together. Audit failure saves no calendar
change. Duplicate concurrent requests return one saved outcome; reusing a request
key for different content refuses. Human direct retries reconcile the retained
receipt before requiring the deleted/created record to exist again.

After an uncertain reply, retain the original request key and inspect the saved
receipt/calendar before creating another item. After a stale refusal, reload and
review a new preview. Deletion is permanent; recovery requires a new reviewed
create. Calendar statuses never publish, send, unpublish or delete website content.

## Reproducible evidence

- `npm run test:content-calendar-actions`: registered tool preview, authorized MCP
  proposal, canonical human approval, denial, expiry, changed payload, stale UI,
  database failure receipt/retry and revoked membership. Real shared services and
  client transport with controlled database replies; no claim of hosted execution.
- `npm run test:content-calendar-postgres`: owned native PostgreSQL, idempotent
  migration, real create/delete/reorder, two tenants/RLS, current membership/module,
  concurrent/replayed requests, changed item/column, invalid/foreign targets and
  audit failure rollback. Disposable server cleanup runs in `finally`.
- `npm run qa:content-calendar`: five original fictional businesses at 1440px and
  390px, keyboard editor/review, explicit clearing, approval/refusal/denial/revision,
  create/reorder/delete, retained decisions and reload. Aborts escaped protected
  network writes. Screenshots and JSON: `/tmp/accelerate-content-calendar/`.
  This exercises the real UI and shared validator with session-local effects, not
  live inference or production persistence.
- Final verification uses agent/module/inventory contracts, docs/index/search,
  runtime write ratchet, lint, production build including TypeScript and whitespace.

Public release review covers the delivery overview/content guide, product changelog,
Command Center capability/FAQ, self-hosting migration catalog and generated index.
The existing Content screenshot remains accurate: the board composition is unchanged.
The new review is captured separately by the five-business browser journey.

The migration is included in the ordered install/upgrade catalog. No application
request installs it, and this card excludes production migration and deployment.

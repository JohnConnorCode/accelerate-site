# Private founder command records

Founder commands can contain platform plans and information from multiple
workspaces. Their proposals, audit receipts, model traces and transcripts must
stay private while ordinary tenant business records remain shared.

## Server boundary

`platform-command-context.ts` owns `runWithPlatformCommandContext`. A server
caller supplies its authenticated, tenant-bound database and actor email. The
helper checks a fresh `auth.getUser()` result, the configured `ADMIN_EMAIL`, exact
user/database/workspace identity and current active admin membership. Anonymous
users, service actors, delegated workspace MCP sessions, stale membership and
forged metadata cannot enter the scope. The callback is an internal server
function; model arguments never supply authority or an owner ID.

The existing tenant database adapter adds `platform_owner_user_id` to inserts
and upserts on `action_queue`, `audit_log`, `agent_runs`, `agent_run_events`,
`ai_conversations` and `ai_messages` within that scope. Batch writes use the same
boundary. Explicit owner input without a matching verified scope refuses.
Private commands cannot silently write through another database or workspace.
Tenant-bound service clients and delegated workspace MCP sessions exclude private
rows from reads, exact counts,
updates and deletes outside the scope. Raw platform service clients remain
privileged server infrastructure and must never reach tools or plugins.

## Database boundary

`20261007181105_platform_private_command_context.sql` adds nullable owner columns
and restrictive owner policies alongside the existing tenant membership policies.
It does not replace tenant authorization or mark existing shared records private.
Other members, including admins in the same workspace, cannot read, count, update
or delete another owner's private records. Owner and tenant cannot change after
insertion, including updates made by internal service actors.

Invoker triggers inherit ownership from conversation/run parents atomically.
Hidden or foreign parents refuse. Message conversation and optional run must
share visibility and tenant. A shared parent cannot receive a private child or
be linked to a private trace. Nullable links retain private ownership after a
parent is deleted; existing cascades remain in effect. Queue-targeted audit
receipts inherit the target's private owner, including later recovery receipts.
Older triage audits that use a WorkItem ID retain their existing behavior.

A database claim guard requires the private owner, current active admin
membership and explicit approval fields before a private queue row becomes
`executing`. Service-role workers cannot claim these actions. Database ownership
is a privacy boundary; only the server can verify the current configured founder
email against fresh Auth before executing effects.

## Existing approval path

Private actions use the existing queue, claim, executor, rejection, retry and terminal
receipt owners. Approval authenticates again, checks the exact owner and current
membership, then retains normal expiry, single-shot claim, payload validation,
autonomy checks and execution receipts. An authenticated founder's autonomous
execution request is denied with a private receipt. Direct autonomous claims
refuse before mutation. Approval and rejection never add private command content
to shared agent memory or learned policies.

Revoked authority refuses before claiming or executing. The request returns the
authorization failure and leaves the proposal pending. A revoked session or
membership cannot write a new database audit receipt through RLS; this boundary
does not grant a privileged writer to manufacture one. The existing proposal
remains available for later owner review after access is restored. This differs
from an authorized founder's autonomous request, which records terminal `denied`.

## Verification and release

Run `npm run test:platform-command-context` for server authority, adapter,
executor, rejection, expiry, replay and missing-schema failures. Run
`npm run test:platform-command-context:postgres` with native PostgreSQL binaries
on `PATH`. It uses an isolated loopback cluster, existing ledger definitions and
the existing tenant policy, applies the migration twice to fresh and populated
fixtures, then tests direct authenticated writes and reads. Fixtures contain no
real private content or provider credentials and make no provider calls. CI runs
both checks alongside the existing shared action regressions and full build.

Apply the additive migration before deploying this source revision. The new
service-client privacy filters require the columns; private writes fail closed
when they are missing. Rerunning this migration retains rows and existing tenant
policies. Rolling application code back does not remove the database privacy
policies; preserve the migration and private records during recovery.

This foundation adds no platform conversational tools, admin controls, hosted
migration or deployment. Platform operation inventory, governed proposals,
freshness/replay and UI/AI/MCP parity remain separate work on
`admin-ai-parity-platform`. New platform adapters must use the private context
and shared services before claiming conversational coverage.

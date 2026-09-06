# Collections approved reminders verification

Card: `receivables-approved-reminders`. Base: case lifecycle `05a754d`.
Scope: default-off native Collections module, existing QuickJS decision engine,
canonical Stripe reader, approval executor, tenant email sender, communications
and immutable event/audit history. No production migration, deployment or
customer email was performed. This is not acceptance of the unfinished parent
plugin or shared workspace/demo card.

## Acceptance evidence

- AC01: host test exercises one branded reminder with the verified remaining
  balance, canonical recipient and exact Stripe payment link. Deterministic HTML
  and text render from the current workspace brand. Browser screenshots opened
  and inspected at 390/1280 widths; no overflow, keyboard-reachable payment link,
  reduced-motion setting and no page errors. Local visual artifacts:
  `/tmp/collections-reminder-390.png`, `/tmp/collections-reminder-1280.png`.
- AC02: request accepts only a case ID and expected digest. The host supplies
  invoice facts, recipient, sender/reply identity and branding. No AI amount or
  recipient override exists; language is deterministic in this version.
- AC03: current case revision, recipient, sender/reply identity, invoice set,
  balances, URLs, branding, decision source hash and rendered content are hashed.
  Proposal rereads and checks the reviewed digest; execution rereads it again.
- AC04: host fixtures exercise payment after proposal, new dispute, pause,
  suppression, recipient change and disabled module. The shared executor keeps
  a structured skipped checkpoint and failed action; no email is sent. SQL
  reservation additionally checks current holds, revision, recipient, activation,
  approval, expiry and cooldown. Existing executor policy gates remain in use.
- AC05: native PostgreSQL proves two separately approved concurrent actions
  acquire exactly one case reservation. Duplicate operation replay cannot send.
  Provider timeout retains an uncertain dispatch and blocks further reminders.
  Re-review recovers only an existing canonical confirmed message receipt, without
  a second provider request. The core action API’s receipt-only reconciliation can run after expiry or
  disable; it does not turn a failed action into a fictional successful execution.
  Cooldown uses confirmed send time, never preview/proposal time.
- AC06: host fixtures execute normal accepted send, duplicate approval refusal,
  timeout/retry refusal, and late verified receipt recovery. Native SQL proves
  tenant isolation, direct-write refusal, recipient/hold/disable gates, durable
  uncertainty, cooldown and receipt-preserving migration replay.

## Checks

- `npm run test:collections-reminders`
- `COLLECTIONS_POSTGRES_PROOF=1 COLLECTIONS_REMINDER_POSTGRES_PROOF=1 npm run test:migration-ledger`
- `npm run test:action-execution` and `npm run test:action-reversibility`
- Agent/module/API guard/runtime boundary contracts; strict types and lint;
  public source statistics, documentation checks, production build and diff check.

The migration harness uses native PostgreSQL, no Docker. It proves the real
business SQL with minimal Auth interfaces and excludes the Supabase-specific
scheduler extension migration as documented in the installation proof. Provider
calls are controlled fixtures, not hosted Stripe/Resend acceptance evidence.

## Operational limits

External payment and email acceptance cannot share a transaction. Billing is
reread immediately before reservation; an external change after that read cannot
recall email already accepted by a provider. Cases are bounded to 25 explicitly
tracked platform invoices. Incomplete reads fail closed. Unknown acceptance is
not aged out automatically: an operator must reconcile the original provider
message. The UI/demo journey and SDK installation/conformance remain separate
live backlog work.

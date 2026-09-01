# From Revenue OS to a second brain

## What we actually have

A reliable system of record. Inbound lands in canonical contacts, companies, and
opportunities; a pipeline moves through one transition service; one sender owns
outbound and writes receipts; an approval queue turns a founder decision into a
real side effect; a copilot reads six tools and proposes; one response policy
exists and is switched off.

Everything above is **reactive and request-scoped**. Something arrives, the
system records it and waits. That is a good CRM with an assistant bolted to it.
It is not a second brain, and the gap is not incremental.

## What a second brain would have to be true

Six things are missing. They are not features to sprinkle on; each is a
prerequisite for the ones after it, which is why the order below matters more
than the contents.

### 1. It is nearly blind

It sees only what arrives through its own forms. Gmail and Calendar sync exist in
code and are not yet switched on. There are no call transcripts, no documents, no
meeting notes, none of what the founder actually knows. A brain whose only sensory
input is a contact form cannot be a second one.

### 2. It has no memory, only records

It knows rows. It does not know _things_. Ask it what was agreed with a client
last month, what their constraint is, why a deal stalled in March, and it has
nowhere to look. `get_today_snapshot` reads tables and returns counts. There is
no unstructured store, no retrieval, no notion of "what I know about X."

This is the single largest gap, and it is the one that makes the phrase "second
brain" mean anything.

### 3. Nothing thinks between events

Every code path runs because a request arrived or a daily cron fired. Nothing
notices that a deal has gone quiet, that a promise was made and not kept, that
three inquiries this week are the same company, that a client who always pays
early has not.

Noticing without being asked is the whole point. Vercel Hobby still provides
only daily cron cadence, but the Command Center now has a free-first scheduling
path: Supabase Cron wakes one authenticated application adapter and all actual
work still claims and executes through Revenue OS services. The first 15-minute
workload is a read-only health snapshot; proactive policies remain separately
approval- and evidence-gated.

### 4. Initiative is one bespoke policy

The inbound responder proved the pattern: a versioned, founder-signed policy with
an envelope, guardrails, a kill switch, and a recorded decision either way. But
it is one module written by hand. A harness means adding the second policy is
declaring config and an eval set, not writing another module and another test
suite from scratch.

### 5. It cannot tell whether it helped

`agent_learning` records one bit per run, misattributed across every tool that
run touched. Nothing links an action to an outcome: did the reply produce a
booking, did the proposed task get done, did the stage move stick or get
reverted. Without that link the system accumulates history and never improves,
and any claim that it is "learning" is decoration.

### 6. Trust has no surface

Audit rows exist for everything. There is no place that says, in sentences,
_here is what I did today, here is why, and here is what I decided not to do._

Trust is the actual bottleneck on autonomy, not capability. Nobody hands more
scope to a system whose reasoning they cannot inspect, and they are right not to.

---

## The path

Six phases, in dependency order. Each is worth shipping on its own; none of the
later ones work without the earlier ones.

### Phase A: See

Connect Google Workspace and unblock the two `blocked` cards. Gmail threads and
calendar events become canonical activity against existing contacts, using the
resolver that already exists. Add a plain capture surface for your own notes, so
what you know can enter the system at all.

**Done when:** a meeting shows up against the right opportunity with nothing typed,
and a note written today is retrievable later.

This is the cheapest phase and everything after it depends on it.

### Phase B: Remember

A knowledge substrate: chunked, embedded, retrievable, with provenance on every
chunk so an answer can say where it came from. Supabase already has `pgvector`
available. One `knowledge` table, one retrieval service, one new copilot tool.

The hard part is not embeddings, it is **provenance and recency**. An answer
grounded in a stale note is worse than no answer, so every chunk carries its
source, its date, and its confidence, and retrieval prefers the canonical record
over prose when they disagree.

**Done when:** asking "what do I know about Northside" returns a grounded answer
with citations to real records and notes, and refuses when it has nothing.

### Phase C: Notice

A background loop that runs on a real cadence and produces a written synthesis:
what changed, what it means, what is at risk, what needs you. Not a digest of
row counts. A short piece of prose you would actually read, with the three things
that matter and why.

This is where the new sub-daily scheduling path becomes useful. Brief generation
will use the same authenticated adapter, claim, receipt, failure, and recovery
contract as the read-only health proof before it.

**Done when:** you open the morning brief before you open the pipeline, because
it tells you something you did not already know.

### Phase D: Act

Generalise the responder into a policy registry. A policy is a record: trigger,
envelope, guardrails, template, model, eval set, kill switch, approved version.
Adding one is config plus fixtures, not a module.

Second and third policies to prove it: **stalled-deal nudge** (a deal quiet for N
days with no scheduled next action) and **commitment keeper** (something you said
you would do, extracted from Phase A's inputs, coming due).

**Done when:** a new policy ships without touching `auto-responder.ts`, and every
policy shares one approval surface, one kill switch, and one eval harness.

### Phase E: Learn

Link action to outcome. Every autonomous or approved action gets an outcome
window and a measured result: reply, booking, stage change, revenue, or nothing.
Widen `agent_learning` from one bit per run to per-tool attribution.

Then eval sets per policy, so a prompt or model change is measured against a
golden set instead of argued about.

The contract's rule stands and should stand: learning is **governed telemetry,
never autonomous prompt mutation**. Outputs do not become instructions. What
changes is that you get evidence for a decision you make.

**Done when:** you can see that policy X produced N bookings from M sends, and a
model change can be accepted or rejected on measurement.

### Phase F: Trust

One accountable surface. Today, in sentences: what ran, what it decided, what it
declined and why, what it is waiting on, what it got wrong. Built on the audit
ledger and `agent_runs`, both of which already record enough.

This is last because it needs the other five to have anything to say, and it is
the phase that lets you widen the envelope on everything before it.

**Done when:** you can answer "what has this thing been doing" without opening a
table.

---

## Scheduling decision

The selected substrate is **Supabase Cron plus `pg_net` as a wake-up adapter**.
This is free-first and does not split business logic: Postgres owns only cadence
and the encrypted destination, while the authenticated Vercel route calls the
same domain services and `withJobRun` ledger as UI, cron, webhook, and AI
entrypoints. Missing Vault configuration produces no outbound request, repeated
wakes share a deterministic 15-minute claim key, and Setup requires a fresh
application receipt rather than treating a successful database cron as proof of
completed work.

Vercel Pro remains the scale-up option when function duration, throughput, or
contractual reliability—not product fashion—requires it. An external worker is
not part of the current architecture.

---

## Where this lives on the board

Every phase is a card, and each one's dependencies are the concrete cards that
deliver it, so `verify:agent-contract` fails if the roadmap and the board drift
apart again. Phase A and B implementation work is now on the circuit rather than
shelved: Google OAuth and first sync, Gmail incremental import, threading and
idempotency, thread association, Calendar association, Drive folder boundaries,
Drive indexing, Drive provenance retrieval, bounded AI context, founder note
capture, and the scheduling substrate decision.

## Sequencing against everything else

This roadmap does not replace the backlog. It orders it. Most Phase A and B work already had cards, shelved behind the `horizon` label.
They were shelved because the system could not be trusted to send an email. That
is no longer the reason, so they are back on the circuit in the order above
rather than by topic. Later-phase work stays shelved until its phase is reached:
Gmail Pub/Sub, meeting intelligence, company research, proposal audits.

Two things stay explicitly out of scope: multi-tenancy, which is not needed until
there is a second installation, and self-improving prompts, which the contract
forbids and should keep forbidding.

## Honest scope

Phase A is days. Phase B is a week or two. Phases C through F are months, and
Phase E is the one most likely to be underestimated, because outcome attribution
is genuinely hard and nobody notices when it is quietly wrong.

The order matters more than the pace. Every phase here is useless without the one
before it, and the temptation is always to jump to Phase D because acting looks
like progress while remembering looks like plumbing.

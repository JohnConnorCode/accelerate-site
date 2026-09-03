# Northstar Build Plan — Accelerate Agent-Native Business Runtime

> Auto-generated from feature-backlog-data.mjs + NORTHSTAR.md gap analysis.
> Last updated: 2026-09-03

## Status Summary

| Phase | Description | Status | Shipped | Remaining |
|-------|-------------|--------|---------|-----------|
| A | Complete Loop One (See + Remember) | ~70% | 24/35 circuit cards | 11 cards (6 blocked, 2 in-progress, 3 planned) |
| B | Agent Runtime (Notice + Act primitives) | **100%** | 6/6 primitives | 0 — all six B1-B6 shipped |
| C | Reference Coworker (Sales end-to-end) | ~60% | Sales coworker + AI bridge | Confirmation system, autonomous responder, full loop demo |
| D | Plugin SDK + MCP | ~30% | plugins.ts, mcp-server, mcp-client | 20+ backlog cards (manifest, lifecycle, isolation, exemplars) |
| E | Additional Coworkers | ~80% | 4/6 coworkers shipped | Marketing + Customer Support coworkers not started |

---

## Phase A: Complete Loop One — Remaining

### Blocked (6) — need external unblocking
- `communication-sender-service`
- `google-oauth-first-sync` ← **NOW card**
- `gmail-incremental-sync`
- `gmail-thread-idmpotency`
- `gmail-record-association`
- `calendar-sync-association`

### In Progress (2)
- `conversations-operator-inbox` — operator-facing inbox surface
- `ai-bounded-context` — bounded model context for AI quality

### Planned — Loop One circuit
- `founder-note-capture` — knowledge input for REMEMBER layer
- `drive-folder-boundary` — Drive scope enforcement
- `drive-content-indexing` — Drive content search
- `drive-provenance-retrieval` — Drive source tracking
- `second-brain-see` — SEE layer completion (depends on Gmail/Calendar sync)
- `second-brain-remember` — REMEMBER layer (depends on SEE)
- `ai-confirmation-system` — **CRITICAL** — human approval for AI-proposed actions
- `autonomous-inbound-responder` — **CRITICAL** — closes the lead→response loop
- `playwright-inbound-pipeline` — QA coverage

---

## Phase B: Agent Runtime — COMPLETE ✅

All six primitives shipped:
1. ✅ B1: Durable Work Engine (`work-items.ts`, `work-executor.ts`, `work-scheduler.ts`)
2. ✅ B2: Capability Graph (`capabilities.ts`)
3. ✅ B3: Evidence & Claim Ledger (`claims.ts`)
4. ✅ B4: Autonomy Policy Engine (`autonomy-policy.ts`)
5. ✅ B5: Coworker Model (`coworkers.ts` + 5 registered coworkers)
6. ✅ B6: Agent Activity UI (`agent-activity.ts`)

**Also shipped this session:**
- AI agent bridge (`coworker-agent.ts`) — headless AI execution for coworker work items
- AI-first-with-deterministic-fallback pattern wired into 5 handlers
- Cross-coworker trigger map (inbound, pipeline, calendly, google calendar → coworker work)
- Memory architecture (`memory.ts`) — 5 categories, learned policies
- Budgets (`budgets.ts`) — per-coworker or global resource limits
- Finance + Operations coworkers (Phase E early delivery)

---

## Phase C: Reference Coworker — Gaps

The Sales Coworker exists and has AI-first handlers, but the **§33 success demo loop** is incomplete:

```
Lead arrives ✅ (inbound.ts)
→ identity resolved ✅ (identity.ts)
→ business context gathered ✅ (gather_lead_context handler)
→ lead qualified ✅ (qualify_lead handler + AI bridge)
→ reply drafted ✅ (draft_followup handler + AI bridge)
→ human approves ❌ (ai-confirmation-system missing)
→ email sent ❌ (needs confirmation flow to action executor)
→ meeting booked ✅ (calendly webhook)
→ pre-call brief generated ✅ (pre_call_brief handler + AI bridge)
→ meeting processed ✅ (post_meeting_process handler + AI bridge)
→ CRM updated ✅ (update_crm_from_meeting handler)
→ follow-up sent ❌ (needs confirmation flow)
→ future work scheduled ✅ (schedule_followup_check)
```

**Blocking gap: AI Confirmation System** — the bridge between "coworker proposes an action" and "human approves it". Without this, the AI-first handlers can produce proposals but they vanish.

### Phase C build priorities:
1. **AI Confirmation System** — action proposals from coworkers surface in operator inbox for approval
2. **Autonomous Inbound Responder** — close the lead→auto-reply loop
3. **End-to-end integration test** — prove the §33 loop works top to bottom

---

## Phase D: Plugin SDK — Backlog

20+ backlog cards. Not highest-value yet — the substrate must prove itself first.
Key cards if/when Phase D activates:
- `plugin-manifest-generator`
- `plugin-install-lifecycle`
- `plugin-connection-broker`
- `plugin-usage-and-budget-metering`
- `plugin-exemplar-tier0-chart` through `tier3-enrichment`
- `plugin-developer-documentation`

---

## Phase E: Additional Coworkers — Nearly Complete

Shipped (4/6):
- ✅ Business Pulse (4 work kinds)
- ✅ Meeting Intel (3 work kinds)
- ✅ Finance (3 work kinds)
- ✅ Operations (3 work kinds)

Not started:
- ❌ Marketing Coworker
- ❌ Customer Support Coworker

---

## Second Brain Layers — Planned

| Layer | Card | Depends On | Status |
|-------|------|------------|--------|
| SEE | `second-brain-see` | Gmail/Calendar sync | planned |
| REMEMBER | `second-brain-remember` | SEE + Drive + notes | planned |
| NOTICE | `second-brain-notice` | Work engine + BP coworker | planned |
| ACT | `second-brain-act` | Confirmation system + action executor | planned |
| LEARN | `second-brain-learn` | Agent learning + memory | planned |
| TRUST | `second-brain-trust` | Audit + provenance + traces | planned |

---

## BUILD ORDER — Highest Value Next

### Immediate (unblock the end-to-end demo):

1. **AI Confirmation System** — the single highest-value build
   - When coworkers propose actions (via `propose_*` AI tools), surface them in operator inbox
   - Approval → action executor dispatches; rejection → audit + learned policy
   - Builds on: action_queue, autonomy_policy, audit, agent-activity
   - Unblocks: §33 success demo, ACT layer, all 5 coworkers' write paths

2. **Autonomous Inbound Responder** — close the lead→response loop
   - When inbound arrives + lead is qualified, auto-draft reply under standing_permission
   - Uses: autonomy policy (ask_until_trusted → standing_permission after trust graduation)
   - Builds on: inbound.ts, auto-responder.ts, sales-coworker, confirmation system

3. **Founder Note Capture** — knowledge input for REMEMBER layer
   - notes.ts already exists but needs the capture → adoption → activity surface
   - Unblocks: Second Brain SEE/REMEMBER layers

### Next (deepen existing primitives):

4. **Second Brain: SEE** — complete observation layer
   - Gmail incremental sync (blocked), Calendar association (blocked)
   - Drive folder boundary + content indexing + provenance

5. **Conversations Operator Inbox** — complete the human-facing work surface
   - Already in-progress; needs to surface coworker work items + action proposals

6. **End-to-end integration test** — prove the §33 loop works

### Later (expand breadth):

7. Marketing Coworker (Phase E)
8. Customer Support Coworker (Phase E)
9. Plugin SDK (Phase D)
10. Second Brain NOTICE → ACT → LEARN → TRUST layers

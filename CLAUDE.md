# Claude and coding-agent entrypoint

Read `AGENTS.md` before changing this repository. It is the canonical engineering and ticket handoff contract for every coding agent.

Important references:

- `docs/REVENUE-OS-ENGINEERING-CONTRACT.md` — data, automation, AI, security, and failure invariants.
- `docs/AGENT-TICKET-RUNBOOK.md` — pickup, evidence, recovery, and handoff.
- `docs/MULTI-TENANCY-CONTRACT.md` — shared-database authorization and isolation.
- `docs/NAVIGATION-RUNTIME-CONTRACT.md` — navigation, loading, focus, and motion.
- `docs/ADMIN-DEMO-CONTRACT.md` — fictional workspace boundary and browser QA.
- `docs/MARKETING-POSITIONING-CONTRACT.md` — public copy and positioning.
- `src/lib/revenue-os/README.md` — authoritative domain modules and callers.

Never use real customer data, production credentials, or unapproved production mutations for development or verification. Public contributors must use fictional fixtures and infrastructure they control.

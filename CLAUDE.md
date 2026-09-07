# Claude and coding-agent entrypoint

Read `AGENTS.md` before changing this repository. It is the canonical engineering and ticket handoff contract for every coding agent.

## Natural-language backlog command

When the user says to pick up backlog work, take the next task, continue the
board, finish and commit, or follow protocol, treat that wording as an
execution command. Do not ask for a ticket key or stop at repository
orientation. After reading `AGENTS.md`, run the internal `npm run agent:go`
runner and continue until the exact commit and evidence are submitted for
review, or a precise operator-required block is reached. The user does not
need to know this command; it is the repository implementation of the
natural-language request. Read [the full trigger contract](docs/contributing/NATURAL-LANGUAGE-AGENT.md).
Never ask the user to paste credentials or choose an unclaimed-work path. The
runner resolves the private remote or explicitly authorized local-operator
profile from the Git common directory. If no private transport is available,
return the runner's non-interactive `SETUP_REQUIRED` state and do not claim or
edit shared work.

## Repository-specific workflow

The resource, verification and authorization rules in `AGENTS.md` govern this
repository. They intentionally replace generic global instructions to typecheck,
lint and build before **every commit**. Commits use fast offline staged checks;
run the appropriate scoped verification and verify the final application tree
once through the required CI/build path. Never overlap heavy local jobs or bypass
the resource gate. Follow existing user authorization for commits and pushes;
production deployment still requires an explicit production instruction.

Use published `main` for the control checkout, preserve active tickets' approved
bases, and run the existing doctor mode for the operation being attempted.
See `AGENTS.md` for accumulated operating lessons and the canonical references.
Do not maintain a competing checklist here or copy transient account failures,
branch names or verification results into permanent policy.

**Start with the northstar.** Read `docs/NORTHSTAR.md` to understand what
Accelerate is building: an agent-native business runtime, not a CRM, chatbot,
dashboard, or fixed SaaS app. The five product layers (See → Remember → Notice
→ Act → Learn), ten architectural principles, and implementation phases (A–E)
govern every implementation decision.

Important references:

- `docs/NORTHSTAR.md` — the platform vision: Coworkers, WorkItems, capability graph, autonomy ladder, evidence ledger, and implementation phases.
- `docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md` — data, automation, AI, security, and failure invariants.
- `docs/contributing/AGENT-TICKET-RUNBOOK.md` — pickup, evidence, recovery, and handoff.
- `docs/contracts/MULTI-TENANCY-CONTRACT.md` — shared-database authorization and isolation.
- `docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md` — navigation, loading, focus, and motion.
- `docs/contracts/ADMIN-DEMO-CONTRACT.md` — fictional workspace boundary and browser QA.
- `docs/contracts/MARKETING-POSITIONING-CONTRACT.md` — public copy and positioning.
- `src/lib/revenue-os/README.md` — authoritative domain modules and callers.

Never use real customer data, production credentials, or unapproved production mutations for development or verification. Public contributors must use fictional fixtures and infrastructure they control.

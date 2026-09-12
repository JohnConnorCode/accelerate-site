# Public proposal decision recovery

The recovery preserves the original public proposal card's three outcomes: one
private view receipt, repeated decisions returning the recorded terminal outcome,
and expired or superseded links refusing new decisions. Customer decline reasons
are optional bounded plain text. Missing or blank explanations remain null;
pipeline loss context identifies the declined proposal without inventing customer
feedback. Admin decision reasons retain their existing requirement.

The original five-path implementation was recovered from retained commit
055f8f7734e08cbe9cfdfb7b2bab20fd981d6609 onto published main a87c79bf.
Retained source and other proposal workers remain intact. The new additive
20260912204004 migration replaces only the existing lifecycle function, preserving
its tenant authorization, role grants, row/advisory locks, immutable receipts,
terminal guards and atomic event/audit transaction. Historical SQL is unchanged.
Retries use the stored customer reason for follow-up work. The public response
panel displays the server's recorded decision, including an opposing race winner.

## Verification boundaries

- `test:proposal-public-decisions` runs actual routes and domain owners over a
  controlled transport fixture. Its simulated concurrency is not native SQL proof.
- `test:proposal-lifecycle` verifies domain RPC adaptation and existing contracts.
- `test-proposal-lifecycle-postgres.mjs`, executed by the existing migration
  business upgrade CI suite, verifies actual PostgreSQL locks, receipts, rollback,
  tenant/role isolation, optional public reasons and required admin reasons.
- `qa-proposal-public-decisions.mjs` renders the actual response component with
  production CSS at 1440 and 390 pixels. Controlled HTTP responses verify blank
  decline, keyboard access, authoritative terminal replay, expiry errors, overflow
  and browser exceptions. It does not claim a connected customer transaction.
- Production build/typecheck, lint, complete core tests and migration catalog run
  on the exact remote candidate. CI artifacts hold screenshots and result JSON.

## Public release content review

Reviewed `src/content/docs/proposals/send.mdx` against the route, component and
`proposals.ts`; updated optional reason and preserved retry/expiry guidance.
Updated the existing changelog and regenerated `public/docs-llms.txt`.
Reviewed `src/content/command-center.ts` and `src/content/command-center-faq.ts`:
their existing proposal version, receipt and recovery descriptions remain accurate
and make no required customer explanation claim, so no copy change is needed.
Reviewed admin callers of proposals/tasks: admin reasons remain required and task
replay resolves the existing dedupe winner. Refreshed only those two source
fingerprints; route ownership and authorization declarations are unchanged.
The existing source-stat verifier records 94 migrations and 239 named checks.

Application deployment and live migration delivery remain separate from source
verification. Exact CI evidence and any environment delivery receipt accompany
handoff; synthetic evidence does not establish production readiness.

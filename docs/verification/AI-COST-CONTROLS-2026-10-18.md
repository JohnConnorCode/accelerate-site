# Workspace AI cost controls

Model requests previously had no shared workspace dollar admission. Missing legacy budgets allowed work, and automatic model/provider fallback could escape the first price estimate. The workspace administrator now controls model admission, recurring work, individual coworkers, daily/monthly/per-request dollar limits and daily request count in AI Workspace > Cost controls. No policy means AI and recurring work are off.

The shared OpenRouter adapter reserves each attempt before dispatch, pins verified prices and refuses unpriced fallback. SQL serializes admission and policy changes per tenant. Final provider charges release unused reservations; interrupted or unconfirmed outcomes retain the full reservation for the current budget period. Usage starts with this migration and does not represent historical account spend, purchases, fees or hosting charges. No credits are purchased by these controls.

Only a freshly authenticated workspace administrator can change controls. SQL validates active membership, tenant context and revision, then writes policy and immutable audit together. AI/MCP can read limits and follow a human handoff; it cannot enable spending, increase budgets or purchase credits.

## Evidence before integration

- Shared adapter tests pass for defaults off, unavailable controls, denied admission without inference, all three completion/stream adapters, pinned prices, attributed charges, aborted and truncated streams, and no repeated paid request after a receipt failure.
- Isolated native PostgreSQL passes migration replay, tenant and administrator denial, finite bounds, revision conflict, concurrent budget admission, daily and monthly caps, recurring pause, duplicate/replayed settlement refusal, audit rollback and revoked access.
- Browser checks pass at 1440, 390 and 320 pixels: keyboard save, reload persistence, recurring controls, coworker pause, stale revision refusal after refresh, pause all, containment and form accessibility. No protected or provider requests escape the fictional adapter.
- TypeScript, ESLint, agent contract, guardrails, public docs coverage/index, route guards and extension fingerprint checks pass. Existing AI transport/workflow fixtures opt in explicitly and retain their functional assertions.
- Public guide and screenshots show the actual fictional interface. No model call, top-up, real coworker activation or customer mutation was used for qualification.

These are local implementation receipts. Final combined-source CI, production artifact, migration and hosted acceptance remain separate release gates recorded in the release receipt.

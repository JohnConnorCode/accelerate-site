# Approved admin AI: cross-domain tool discovery

Date: 2026-09-05. Live child: `admin-ai-cross-domain-tool-discovery`
(`bc175274-b41e-413e-b71b-45bbbeed644f`). Parent:
`tool-bundles-progressive-disclosure`; the broader parent remains open.

Application commit: `6de049f9bf3c285d0205d5b1e7ad9b2fe3ee4284`.
Verified build tree: `3ad1114830423964deab118eda251c8fe0128238`, including the
corrected MCP test and stronger success assertions. This receipt is documentation
only and does not change the verified application.

## Acceptance evidence

- **AC1 — ownership and reachability:** bundles derive from the existing module
  `aiToolNames` declarations. All 58 registered tools across 30 modules are
  reachable. The shared test rejects unowned, unknown and multiply owned tools.
  Large modules are split rather than silently truncated.
- **AC2 — bounded discovery and authority:** strict read-only discovery and
  activation tools expose paginated module/tool metadata. Real registry and MCP
  tests verify successful activation with an explicit pipeline restriction,
  inclusion of allowed tools and exclusion/refusal of the founder-note tool.
  Unknown, disabled and injected-approval inputs refuse. No configuration save
  occurs. Shared demo metadata uses the same versioned tool declarations.
- **AC3 — command interface:** the real command agent and OpenRouter gateway run
  against controlled fetch/database fixtures. From an opportunity page it
  discovers the note bundle, activates it, and inserts exactly one proposal into
  the existing action queue (which has a pending database default). An earlier
  unadvertised attempt refuses without a queue insert. Every model request stays
  at or below 40 tools. No founder-note business write or approval executes.
- **AC4 — failures and growth:** a plugin disabled after activation refuses at
  dispatch and disappears from the next model request. Failed proposal attempts
  are no longer reported as staged. Fifty simulated plugins, including a
  90-tool plugin, preserve every tool and stay within 40 active schemas. Exact
  module-ID lookup is 50/50, matching each isolated-plugin baseline; this is a
  deterministic lookup fixture, not a real-model natural-language benchmark.
- **AC5 — verification and documentation:** full core suite and AI operations
  passed; after two lint-only local-variable renames, affected discovery/agent
  tests and full strict lint passed. Agent, module, runtime-boundary, guardrail,
  documentation, public-stat, LLM-index and admin-route inventory checks passed.
  Source inventory remains 86 routes / 76 mutation handlers, without asserting
  semantic parity. Runtime boundary inventory retains 71 legacy write sites.
  Production build, TypeScript and generation of all 367 pages passed on the
  exact build tree above. No rendered UI behavior was changed; shared demo
  capability/disablement fixtures run in the core suite.

Local logs: `/tmp/ai-tool-discovery-core.log`,
`/tmp/ai-tool-discovery-lint-fixed.log`,
`/tmp/ai-tool-discovery-build-fixed.log`. The first combined run ended on two
lint naming errors after its tests passed. The first build log,
`/tmp/ai-tool-discovery-build.log`, records an incorrectly ordered MCP test call;
that test was corrected and strengthened before the successful build. Those
failed runs are not passing evidence.

## Limits and cleanup

Activation is local to a command run and is traced, but is not restored across
runs or conversation reloads. Rich live trust/recipe descriptions, durable
activation and SDK integration remain on the parent. Discovery does not implement
missing domain writes, confer record permissions, approve actions or create a raw
SQL/HTTP interface. The universal admin initiative remains open.

No database migration, real provider request, recipient send, production deployment
or Docker was used. Heavy checks ran serially through the unchanged resource gate.
Only this worktree's disposable build output is removed after verification.

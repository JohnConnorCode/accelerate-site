# Demo navigation origin correction, October 1, 2026

Hosted verification of the ongoing all-agent release found the Invoices link
leaving `www.acceleratewith.us` for the bare public domain. That domain redirects
back to `www`, but the extra document navigation bypasses the mounted workspace
navigation runtime. The strict browser fixture refused the cross-origin request.
Its first failure and screenshot are retained in the private release review.

The shared `AdminLink` owner converted every demo destination into the configured
public origin whenever a separate app origin existed. Demo links already have a
validated public scenario path; they now retain their active origin. Private
workspaces still use the existing public-origin adapter for guides and demos.
Programmatic demo navigation already used relative scenario paths.

## Navigation and verification

| Before                                                                                                                                      | After                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo sidebar links become absolute public URLs when the separate app domain is configured, adding a document redirect on this installation. | Demo links retain the current public origin and use the existing Next.js navigation runtime.                                                       |
| Invoice navigation checks the destination and visible content.                                                                              | It also checks the link origin and a per-document identity, rejecting document reloads. API and external-provider request blocking remains intact. |
| The public changelog has no entry for this correction.                                                                                      | A dated entry explains continuous demo navigation and retained public links from private workspaces.                                               |

| The reviewed route inventory still fingerprints the former shared link adapter. | The inventory records the reviewed adapter's new fingerprint; route actions, service adapters and authorization boundaries remain unchanged. |

## Verification plan and boundaries

The first candidate passed application builds, native motion, fork installations
and the combined browser suite. The protected gate failed because the reviewed
route inventory still held the previous `AdminLink` fingerprint. That omission
is corrected after reviewing the shared link boundary; the inventory changes one
source hash. The inventory verification and its regression tests pass. The first
CI failure is retained. Fresh required CI covers the complete final tree.

Run the command-center PWA contract, scoped lint, the agent contract and diff
checks. Required protected CI covers the complete revised source before merge.
The final immutable branded production build must also run the invoice journey
locally with the actual configured app origin before upload. That configuration
reproduced the original problem and exercises the new origin/document assertions.
After publication, repeat the hosted invoice, hero, desktop/mobile admin and
Settings/Setup journeys, canonical release checks and read-only installation
health. Preserve source/CI/main tree parity and the previous immutable release.

Reviewed public surfaces: `src/content/docs/workspace/overview.mdx`,
`src/content/command-center.ts` and `src/content/command-center-faq.ts`. Their
existing selected-workspace, fictional-effects, installation and approval
instructions remain accurate: this changes navigation continuity, with no new
control, task, saved result, provider permission or supported business action.
Routes, manifest titles, plugin guides and the generated docs index are unchanged.
The product changelog describes the visible correction. No schema, API operation,
authentication boundary, module default or MCP tool is changed.

Private evidence:
`/Users/johnconnor/.local/share/accelerate/reviews/20261001-all-agent-release/`.
The homepage correction at `8a07f50d7550` remains live while this final integration
correction is verified under the ongoing all-agent release authorization.

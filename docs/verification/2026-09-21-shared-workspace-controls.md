# Shared workspace controls and theme polish

This change applies the existing component system to the next audited consumers.
It does not install MUI or claim that all routes have completed a Material migration.
The Tasks/Pipeline/Contact intake work remains in the separate PR125 handoff.

| Before                                                                                                  | After                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clients, Analytics, Campaigns, Integrations and Proposals restated field appearance locally.            | Existing `admin-field` recipes own appearance; page-specific layout and meaningful monospace fields remain. The token verifier prevents those consumers from restoring visual overrides.                    |
| Placeholder and disabled field presentation depended on local styling.                                  | Shared themed placeholder and disabled colors, native disabled behavior and a coarse-pointer target floor apply to all `admin-field` consumers.                                                             |
| Compact portable themes emitted 38px controls.                                                          | They emit 40px controls; coarse-pointer fields and buttons use at least 44px. Theme tests cover the minimum.                                                                                                |
| Setup readiness forced white and neon text onto sidebar-colored surfaces.                               | Text and icons inherit the paired sidebar foreground; the shared ink surface owns its heading color. The decorative glow is removed.                                                                        |
| Setup added a second entrance animation and an animated, unlabeled progress decoration.                 | The shared route stage owns entrance motion. The progress indicator exposes its label and percentage without a separate width animation.                                                                    |
| Contact relationship requests swallowed network failures and accepted HTTP failures as empty data.      | The existing query/read-body owners handle cancellation, caching, HTTP failure, visible error and retry. Query identity includes the person and never uses the previous person's result as a placeholder.   |
| Shared read errors lacked an alert role and the first-load retry could remain enabled while refreshing. | Errors announce themselves, and retry reflects the refreshing state.                                                                                                                                        |
| Contributors lacked an explicit shared Material interaction versus appearance boundary.                 | The existing UI contract and plugin guide describe component ownership, themed pairs, density, motion and read-state behavior. The contact guide and both changelogs describe recovery and styling changes. |

## Verification

- Theme unit checks cover all eight presets, token completeness, contrast validation,
  portable round trips, invalid definitions and the compact control floor.
- `QA_FOCUS=controls QA_PRODUCTION=1 npm run qa:admin-polish` runs against a local
  production build. Its matrix covers Setup and Clients in all eight appearances
  at 1440px and 390px; the other four migrated consumers at both widths; and a
  failed contact-history read followed by a successful keyboard retry.
- The browser script checks rendered contrast, field geometry, keyboard focus,
  mobile overflow and reduced-motion sessions. Screenshots and a machine-readable
  receipt are written to `/tmp/shared-workspace-controls`.
- Required local checks and production browser results are recorded in the final
  card evidence and PR description. This file alone is not a passing receipt.

## Boundaries

No schema, provider, authorization, business mutation or readiness calculation
changes. Feature and FAQ copy were reviewed: existing capabilities remain the
same, so no new feature claims were added. Remaining table/detail composition,
other route-local motion and component showcase coverage are follow-up work.
Production deployment is separate from this source handoff.

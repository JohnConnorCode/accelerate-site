# Homepage and core workspace polish

## Scope and ownership

Implemented the approved warm editorial evolution in `feat/editorial-home-admin-polish-20260930`, isolated from published main `21654557a82c261e0639964ef7133fa27153272c`. The primary checkout and other workers were preserved. No database, provider, authentication, approval policy or saved-document schema changed. Deployment remains separate.

## Visual changes

| Principle                | Before                                                                                                                             | After                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography               | Today overrode the shared title family; Paper headings used body type.                                                             | Today follows the theme, Paper uses the installed editorial family, and Studio retains its expression. Demo workspace names wrap in the sidebar and the desktop toolbar shows the actual fictional business.                                                            |
| Controls and hierarchy   | Search and Ask AI scrolled with route content; Customize crowded Today’s header.                                                   | Persistent desktop tools sit outside the route entrance. More groups Today customization, duplication and recovery; the mobile selector and More share a row.                                                                                                           |
| Surfaces and space       | Feature Board filters used fixed corners and heavy dialog shadows; generic empty states reserved large gaps.                       | Filters use shared dialog, field and button recipes. Empty states use content-sized token spacing. Today uses density spacing instead of a fixed override.                                                                                                              |
| Homepage composition     | Four equally prominent projects followed services and process.                                                                     | One featured project and three supporting links lead the bundled page. Services use a desktop two-column composition. Intro, process and sample-plan spacing and heading scale vary by purpose. New Site Studio seeds match; saved website order remains authoritative. |
| Motion and readability   | Shared group/item entrances blurred copy; the sample plan blurred, floated and waited on a long reveal; its CTA had a 620ms delay. | Shorter opacity/translation entrances reveal homepage content earlier. The plan stays still and readable, its CTA delay is 180ms, and reduced motion remains immediate. Hero behavior is preserved.                                                                     |
| Booking clearance        | The floating call bar could compete with an in-view booking button.                                                                | An observer hides the bar while a marked primary booking action is visible, clears the chat offset, and restores the bar after scrolling away. Default-state presence does not animate on first render.                                                                 |
| Useful copy and receipts | Demo approvals repeated technical simulation language; saved Feature Board views had no pending label.                             | Demo rows show their actual scenario descriptions while retaining demo identification and exact approval review. View saving disables duplicate submission and reports Saving view until the operation finishes; failed saves preserve the name for retry.              |
| Product evidence         | Gallery and Today guide showed older chrome and stale Revenue wording.                                                             | Seven genuine screenshots across five fictional businesses and five appearances replace the existing assets. The Today guide uses a fresh capture. Revenue alt text reflects active contract values.                                                                    |

## Verification

- Theme/token contracts pass for all nine presets, including contrast, custom version-1 round trips and legacy compatibility.
- Local homepage browser QA passes eight light/dark viewport cases at 320, 390, 768 and 1440 pixels. It verifies order, one featured case, three supporting projects, keyboard activation, back navigation, overflow, reduced motion and booking-bar clearance. Desktop and mobile screenshots were opened.
- The initial Today run passes 28 cases at 1440, 1100, 820 and 390 pixels, including sparse, empty, unequal, partial-failure and reported states, keyboard grouping, sticky tools, saved arrangements and duplication. After the final mobile spacing refinement, the combined local rerun completed homepage QA but the resource gate stopped before Today when available disk fell below 2 GiB. Final-tree Today verification therefore belongs to CI, not that interrupted run.
- Seven gallery images and the Today docs image were captured from this source through the resource-gated local owner with external and authenticated API requests blocked. Paper Today, Night Revenue and Studio Analytics captures were opened and checked against their descriptions.
- Agent contract, admin demo contract, source statistics, docs coverage/index, house style, fabricated-claims guards, native renderer parity, scoped lint and whitespace checks pass locally. Full production build, full lint, browser release journeys and the final appearance matrix are tracked by the PR’s exact-candidate CI receipts.

## Reproduce

Run the focused local jobs through the existing owner:

```sh
NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded QA_FOCUS=home,today npm run qa:admin-polish
NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded QA_FOCUS=product npm run qa:admin-polish
```

`capture-product-screenshots.ts` imports the shared gallery registry, validates the loopback origin and exact appearance, and writes the existing gallery filenames plus the Today guide image. The final build’s browser job runs homepage and Today checks. The manual `admin_design_only=true` path retains all nine identities, density, contrast, focus, custom-theme restoration and Feature Board filter save/failure evidence.

## Release-content review

Updated Today and Appearance guides, the public changelog, Command Center web-workspace description and Today/Work FAQ. Regenerated the docs index. Plugin services and their documentation remain accurate because no plugin workflow, access requirement or provider action changed. Reviewed the Today, Feature Board and Site Studio route dispositions and refreshed source hashes in the route inventory; registered operations and human-authored authorization boundaries are unchanged. The source-statistics check verifies the existing published counts.

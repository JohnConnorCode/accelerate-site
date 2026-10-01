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
| Motion and readability   | Shared group/item entrances blurred copy; the sample plan blurred, floated and waited on a long reveal; its CTA had a 620ms delay. | Shorter opacity/translation entrances reveal homepage content earlier. The plan stays still and readable, its CTA delay is 180ms, and reduced motion remains immediate. Hero refinements are recorded below.                                                            |
| Booking clearance        | The floating call bar could compete with an in-view booking button.                                                                | An observer hides the bar while a marked primary booking action is visible, clears the chat offset, and restores the bar after scrolling away. Default-state presence does not animate on first render.                                                                 |
| Useful copy and receipts | Demo approvals repeated technical simulation language; saved Feature Board views had no pending label.                             | Demo rows show their actual scenario descriptions while retaining demo identification and exact approval review. View saving disables duplicate submission and reports Saving view until the operation finishes; failed saves preserve the name for retry.              |
| Product evidence         | Gallery and Today guide showed older chrome and stale Revenue wording.                                                             | Seven genuine screenshots across five fictional businesses and five appearances replace the existing assets. The Today guide uses a fresh capture. Revenue alt text reflects active contract values.                                                                    |

## Hero follow-up

The founder requested a direct statement of the money-and-time outcome and more intentional hero motion. The existing hero owns this refinement; saved Site Studio documents and the native content schema stay authoritative.

| Before                                               | After                                                                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home.ts`: “The right AI starts with your business.” | “We use AI to help your business make more money while you save more time.” Support explains finding useful AI, building around existing tools, and helping the team use it.           |
| Heading and emphasis shared a single scale.          | `.home-hero-lead` supplies the smaller setup; balanced large serif emphasis carries the result.                                                                                        |
| Container entrance and a flat background.            | `Hero.tsx` supplies a short transform-only word entrance, atmosphere, 18 contours and six flowing highlights. The full sentence remains readable during the reveal.                    |
| Static decoration.                                   | An interruptible field transform follows fine-pointer movement. Pointer presses and touch taps produce a bounded 850ms pulse. Decorative layers do not intercept clicks.               |
| No hero activity lifecycle.                          | Decorative loops pause offscreen, on hidden tabs and behind the mobile menu. Reduced motion and disabled JavaScript remain static. Coarse pointers run no continuous decorative loops. |
| Phone spacing inherited the desktop composition.     | Mobile lead type, background framing, top padding, eyebrow spacing and bottom spacing keep the result and booking action visible.                                                      |

The prior hero candidate `3e025b38c7e7dfdfa864cb7feabd9a974561fdf7` passed CI build and typecheck. Its original eight-case verification is recorded here as historical evidence; the sequential-entrance refinement below changes application source and has separate production-build and browser evidence.

The resource-gated local hero suite passes eight cases: desktop light/dark, phone light/dark, short and narrow phones, reduced motion and JavaScript disabled. It checks complete text, booking above the fold, no overflow, settled words, pointer/touch responses, offscreen pause, keyboard activation, Back and console errors. Desktop light/dark, mobile light/dark, narrow phone, short phone and no-script screenshots were opened. Native Chrome also verifies desktop themes, the short phone view, booking and Back.

The initial CI no-script check read the background before CSS loaded. Delaying CSS reproduces the ordering issue while the final rendered hero stays paused. The fixture now delays CSS by 300ms and polls from the test process for the hero stylesheet before checking computed styles. Its assertions remain intact; no application behavior changed to repair this QA race. Screenshot and JSON receipts are retained under `test-results/editorial-home-admin-polish/hero-final-local/`.

## Sequential homepage entrances

The founder requested perceptible, intentional entrances across the homepage,
especially the hero. The complete money-and-time message and booking action
remain readable throughout the hero sequence.

| Before                                                                                                  | After                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero animations started when the root bootstrap armed motion, before the hero's client owner was ready. | `Hero.tsx` uses the existing shared reveal lifecycle. The entrance starts on committed content and stays static with unavailable JavaScript or reduced motion.                                                |
| Hero elements overlapped, and the animation shorthand overrode several phase delays.                    | CSS consumes `--hero-entry-delay` in the shorthand itself. Eyebrow, setup words, outcome words, explanation, booking action and three service labels start in distinct phases, finishing within 1.52 seconds. |
| Section eyebrows, headings and descriptions had independent observers and 60ms offsets.                 | `Reveal sequence` gives each compact group one clock. Semantic children enter 110ms apart with a 640ms translation-and-opacity entrance.                                                                      |
| Homepage reveals began at 92% of the viewport, often mostly offscreen.                                  | The existing shared lifecycle uses the contract's 78% entry line. Long lists keep independent row owners, including on a slow scroll.                                                                         |
| The statement's detail and navigation, service note and marquee had no entrance owner.                  | They now enter with the same homepage rhythm. Project links, service rows, industry cards, plan items and FAQ rows have distinct, bounded offsets.                                                            |
| Process rows entered as a single block, with an additional nested tag animation.                        | Each row sequences its number, title with tag, and explanation. The title owns the tag's entrance; the extra animation is removed.                                                                            |
| About copy entered as a single block; the closing headline and CTA had separate clocks.                 | About paragraphs and link enter in order. One closing sequence owns the eyebrow, two clipped headline lines, description and booking action. The about link supports its translation with `inline-flex`.      |

Application candidate: `f3d367916bef98372d5e574972364d7f2375ed00`.
The browser suites measure real `animationstart` events, traverse the homepage's
entrance owners, and retain intermediate screenshots. They also cover the direct
load, keyboard navigation, Back, delayed hydration, complete no-script content,
reduced motion, dark mode, short phones and horizontal overflow.

The resource-gated production build and TypeScript validation pass for that
application candidate. Full lint, the agent contract, Work ownership contract and
native website rendering pass. Local browser verification passes eight homepage
viewport/theme cases plus ten hero cases: six normal viewports, two delayed
hydration cases, reduced motion and disabled JavaScript. The desktop and phone
traversals check 47 entrance owners each. Actual hero phase starts are separated
by approximately 100–183ms; all words, copy and actions settle. The suites report
no console or runtime errors. Intermediate hero screenshots, desktop services
and phone process screenshots were opened and inspected.

The production preview at `http://localhost:3045` uses deployment ID
`f3d367916bef`. Screenshots, JSON and the source-tree receipt are retained under
`test-results/editorial-home-admin-polish/home-sequence-final/`. An additional
timing audit was refused by the machine's disk gate; the passing production and
browser receipts precede that refusal. Only owned disposable compiler-cache and
old downloaded CI artifact copies were removed. Other worktrees are untouched.

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

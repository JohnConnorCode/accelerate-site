# Homepage rendering correction · October 2, 2026

## Requested outcome

Investigate the published homepage's uneven background and hover motion, polish
its composition and mobile presentation, and publish the verified correction.
Use the existing shared Hero owner and reveal lifecycle. Do not change copy,
booking routes, business operations, authentication, provider effects or schema.

## Rendering and interaction

| Before                                                                                                                            | After                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six looping dashed SVG strokes and moving SVG masks repaint continuously on desktop.                                              | Static SVG strokes and a static tonal gradient; continuous motion belongs to HTML transform layers.                                                                       |
| Eighteen contours plus six moving currents and eighteen duplicate masked focus paths crowd the composition.                       | Twelve contours, no current fragments and no duplicated masked paths. The existing three broad ribbons remain.                                                            |
| Pointer frames measure geometry, relocate a radial SVG gradient and change inherited variables used by several nested transforms. | Geometry is cached at pointer entry and resize. One scheduled frame moves the artwork and one prepared local light layer.                                                 |
| Touch updates two separate effects and positioned pulse geometry.                                                                 | One interruptible light fades over a finite duration and moves through a transform. Repeated taps begin from the current opacity.                                         |
| Desktop contours use rotating/scaling SVG transforms.                                                                             | The HTML flow layer drifts through a small translation on desktop and mobile. Artwork pauses offscreen, hidden and behind the mobile menu.                                |
| Several masks and overlapping subpixel strokes add raster work.                                                                   | Bounded paint containment, no artwork masks and slightly stronger static contour strokes.                                                                                 |
| No regression measures settled background repaints and hover layout.                                                              | The existing hero journey checks actual layer paint events and layout duration, while retaining rendered entrances, navigation, keyboard, fallback and responsive checks. |

## Baseline evidence

A live Chromium probe with four-times CPU throttling measured 335 paint events
in a 3.5-second desktop idle sample and 274 while interacting. Desktop p95 frame
gaps were approximately 33.4 ms. The mobile Chromium idle sample had zero
paints and about 16.7 ms p95 gaps; six taps caused 14 paint events and about
18 ms of layout work. This isolates rendering costs, not physical-device speed.
Private traces and natural recordings retain the original result.

## Verification and release evidence

Record final source, CI/main parity, immutable package identity, hosted behavior,
opened screenshots and before/after metrics in the private review. Local checks
and publication are separate facts. Required gates are retained.

## Public release-content review

The product changelog explains the observable correction. Organized workspace
guides, Command Center descriptions and FAQ remain accurate: this change adds
no business capability, controls, plugin, route, provider claim or saved result.
No generated documentation metadata changes are required. The Work motion
contract is updated in the existing owner to describe the compositor boundary.

## Limits

Browser emulation and native macOS WebKit do not establish physical iPhone
performance. A functional pass does not establish aesthetic quality; open the
screenshots and inspect the natural recordings before publication.

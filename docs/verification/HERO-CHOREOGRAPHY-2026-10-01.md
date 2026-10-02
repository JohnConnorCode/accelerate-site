# Homepage motion correction, October 1, 2026

The founder rejected the published hero's rushed word cascade and disconnected
motion. Publication of the remaining all-agent release is held while this
correction is verified. Invoice integration PR 199 passed full protected CI and
merged at `fe9cc49aa1af006e3aca4f7bd214246428b3f1f7`; its source, CI and main trees
are identical. This correction retains that completed integration.

## Headline and composition

| Before                                                                                           | After                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each word starts 40 ms after the previous word, with a 680 ms entrance and a steep easing curve. | Words sharing a rendered line share one clock. Lines start 200 ms apart and enter over 1500 ms with `cubic-bezier(0.25, 0.5, 0.25, 1)`.             |
| Timing follows token count and a separate lead/outcome offset.                                   | The existing Hero owner reads the responsive layout once before paint. Timing follows actual line positions, including editable and legacy content. |
| Supporting copy, the booking action and the index use fixed, unrelated start times.              | Their start times follow the last headline line. Supporting copy, action and index use the same easing and 900 ms duration.                         |
| The booking entrance scales; supporting copy travels 16 px.                                      | The booking action travels 8 px and supporting copy 10 px, retaining the stable type hierarchy and keyboard override.                               |

## Artwork and interaction

| Before                                                                                            | After                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ribbon entrance travels 35% horizontally, 20% vertically and rotates 12 degrees over 1800 ms. | It travels 10% horizontally, 8% vertically and rotates 4 degrees over 2600 ms, using the headline's easing.                                                                                   |
| Ribbons cycle in 14/17/20 seconds with a larger rotation and translation range.                   | Independently composited ribbons cycle in 28/35/42 seconds with a smaller, gentler movement range.                                                                                            |
| Contours trace in 1800 ms and drift over 24 seconds; short currents use 9–17.5-second cycles.     | Contours trace over 2600 ms and drift over 44 seconds with reduced travel; currents use 24–49-second cycles. Touch devices retain composited ribbon motion without continuous SVG repainting. |
| Pointer displacement has a 44/32-pixel range; touch displacement has a 60/44-pixel range.         | Pointer range is 20/14 pixels and touch range is 28/20 pixels. Artwork transitions share the same 900 ms easing.                                                                              |
| Touch emits two expanding, rotating rings and a sharp 850 ms illumination.                        | Touch produces a soft radial light field and local contour illumination over 1800 ms. The field expands gently and returns to rest.                                                           |
| Pointer illumination changes over 450 ms.                                                         | It fades over 750 ms using the same easing as the composition.                                                                                                                                |
| A mouse press or repeated touch restarts the light at zero, causing a visible flash.              | Mouse presses retain hover lighting. Repeated touches continue the existing opacity and transform, then fade smoothly to rest.                                                                |

## Verification and boundaries

The production build, scoped lint and agent contract passed for the revised Hero
and CSS inputs. The rendered-frame browser check passed its first revision. It
now measures complete visible line groups at controlled times, and records
natural desktop and phone playback, rather than requiring the former rapid
lead/outcome token sequence.

The first native run found no layout shift or performance-limit failures. Its
only failures were both engines checking the booking opacity at a fixed 2200 ms,
when the revised button was at approximately 0.992 and still finishing. Geometry,
font hierarchy and overflow checks were healthy. The corrected test waits for
finite entrance animations to finish, with a strict four-second deadline, then
applies the existing complete-content and layout assertions. Warm navigation,
menu pauses, history restoration, reduced motion, missing JavaScript and delayed
hydration retain their checks. The corrected Chromium and native WebKit rerun passed, including cached visits,
menu pauses, restored history and reduced motion. Both engines recorded zero
layout shift. The worst warm-visit p95 was 16.8 ms in Chromium with 4× CPU throttling
and 23 ms in WebKit. Both the first failure receipt and rerun evidence are
retained in the private review folder.

Additional interaction review reproduced a mouse light falling from opacity 1
to 0 on press and repeated-touch illumination falling from approximately 0.44
to 0. The source now retains hover lighting and blends repeated touches from
the current animated state. The hero journey includes regressions for both
cases; a separate native WebKit probe checks the same interruption behavior.
The original failing probe is retained. The corrected hero journey passed,
and native WebKit measured mouse illumination staying at 1 and repeated-touch
illumination staying near 0.41. The preceding full CI passed; a fresh full CI
run is required for this final interaction fix before publication.

No new dependency, animation library, frame loop, API, module default, customer
message, provider configuration or database schema is introduced. Required full
CI on the final candidate, source-to-main tree parity, immutable packaging and
hosted proof remain separate release gates. Physical iPhone verification and a
persisted BFCache restoration have not been established by desktop WebKit.

Private recordings, before/after frames and release receipts:
`/Users/johnconnor/.local/share/accelerate/reviews/20261001-hero-choreography/`.

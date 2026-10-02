# Expressive homepage motion

## Requested outcome

The published hero's movement and interaction were barely perceptible. The
correction must have a recognizable entrance, continuous expressive artwork and
an obvious response to pointer movement and touch. It must keep balanced type,
the full-height phone composition, readable content and smooth rendering.

## Artwork and interaction review

| Before                                                                                 | After                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three narrow line ribbons were hard to distinguish from the twelve-line contour field. | Three broad shaded ink sheets have four fine contour edges each. The secondary field has four lines, reducing competing detail. All SVG geometry and gradients remain static.                                                               |
| The artwork occupied a smaller right-hand area with a faint 0.22 opacity.              | A wider composition uses tonal surfaces, a 0.34 desktop ink envelope and a 0.30 phone envelope. Responsive overscan keeps the surfaces across the full section.                                                                             |
| The artwork faded into place from a small offset.                                      | The sheets sweep into place from a 26% horizontal offset and an eight-degree turn over 2.8 seconds. The existing concealed, line-based headline sequence stays readable.                                                                    |
| Ribbon clocks lasted 28/35/42 seconds with little displacement.                        | Independent 14/19/24-second clocks move the sheets across a larger range. Different phases prevent synchronized movement.                                                                                                                   |
| The contour field moved twelve pixels over 44 seconds.                                 | Its prepared HTML layer moves 44 pixels over 22 seconds, behind the stronger sheet movement.                                                                                                                                                |
| Pointer depth moved one field by at most six horizontal pixels.                        | Two prepared HTML depths move in opposite directions, with 56/88-pixel horizontal ranges and 36/56-pixel vertical ranges. The headline does not move. Geometry stays cached outside pointer frames.                                         |
| The local light was a faint radial gradient.                                           | A larger local contour response adds fine curved ink detail and a tonal surface. Retargetable transitions follow the pointer without continuously redrawing SVG.                                                                            |
| Touch faded a light without a visible material response.                               | Touch moves both artwork depths and briefly expands the local surface. Repeated taps continue from the current transform and opacity. Native scrolling remains available; pointer cancellation restores the field.                          |
| Automated verification proved only that an animation transform changed.                | The hero journey now requires perceptible natural movement over three seconds and distinct pointer/touch depth displacement, alongside existing paint, layout, entrance, cache, keyboard and fallback checks.                               |
| The public release entry and shared motion contract described the quieter composition. | A new product changelog entry describes the expressive artwork. The shared contract includes perceptibility and native touch cancellation. Public platform guides, Command Center descriptions and FAQ need no business capability changes. |
| When JavaScript arrived after the safety watchdog, ambient artwork never resumed.      | Ambient motion follows the hero’s hydrated owner. Late hydration resumes artwork while the already readable foreground remains visible. Unavailable JavaScript and reduced motion keep a static composition.                                |

## Observable acceptance

- At least two sheets naturally travel 18 pixels on desktop or 12 pixels on a
  phone during a three-second visit. Screenshots and recordings must also show
  coherent, perceptible artwork; numeric movement alone does not establish quality.
- Pointer and touch move the two artwork depths in opposite directions. The
  complete headline, support copy, booking action and service index remain clear.
- Idle decoration uses only HTML transform/opacity animation. No SVG paths,
  masks, stroke dashes or gradients animate continuously.
- The existing settled desktop regression retains its layer-paint and layout
  budgets. The native mobile journey retains its frame and stall budgets.
- Fresh, cached, reload and history visits remain correct. Reduced motion,
  unavailable JavaScript, failed hydration, keyboard access, offscreen state and
  the mobile menu retain their supported behavior.
- Opened desktop, phone, dark-theme and narrow/short viewport screenshots must
  show no clipped artwork edge, hidden content, horizontal overflow or unreadable
  foreground. Actual entrance and interaction recordings are required.

## Required checks

Use the repository resource gate for one heavy job at a time. Run the full lint,
agent contract, production build, hero timing and native Chromium/WebKit mobile
journeys on the final relevant tree. Keep the final build immutable for release.
Record the exact source, CI and merged-main tree identity. Hosted checks and
physical-device measurements are separate evidence; a development preview is
not production proof.

This change is confined to homepage rendering and interaction. It does not add
dependencies, business tools, provider effects, schema changes or navigation
owners. Review and publication remain separate release actions.

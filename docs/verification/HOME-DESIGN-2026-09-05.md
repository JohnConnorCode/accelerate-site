# Homepage design refinement

The founder requested a more custom, distinctive homepage and coherent site
polish. The existing typographic hero, choreography, business positioning,
photography, and shared theme remain the foundation.

| Before                                                     | After                                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Four similar service cards with unrelated colored symbols. | A continuous numbered editorial index with authored SVG diagrams for finding constraints, connecting systems, execution, and improvement.   |
| Service headings were spans inside cards.                  | Semantic headings, readable descriptions, clear deliverables, and one full-row service link per engagement.                                 |
| The opening explanation was one long large-type paragraph. | A concise display statement and readable supporting copy, with a separate orientation column linking to services, work, and Command Center. |
| Industry photos had no consistent opening affordance.      | Quiet numbered image details, visible destination arrows, and an image edge treatment.                                                      |
| Editorial heading and paragraph wrapping varied.           | Balanced shared headings and deliberate paragraph wrapping on existing editorial primitives.                                                |

No new image downloads, animation libraries, continuous loops, or third-party
scripts were added. The diagrams are static inline SVG; existing shared reveal
behavior owns their row entrances. On narrow screens, the text index takes
priority over the diagrams. Hover feedback has a reduced-motion counterpart.

Acceptance: services remain readable in both themes and widths; four distinct
engagements have valid service links; section links resolve; photography loads;
keyboard focus remains visible; the page has no horizontal overflow; content and
links remain usable without JavaScript. `qa:docs` now retains desktop/mobile
homepage screenshots in light and dark themes, normal and reduced motion, in the
existing CI evidence artifact. Screenshots must be opened before handoff.

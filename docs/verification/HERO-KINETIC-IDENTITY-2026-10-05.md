# Homepage kinetic identity: October 5, 2026

## Requested result and selected reference

The founder rejected the homepage's rigid metallic arrows and earlier cursor-led
abstract waves. The requested replacement needed a specific, researched motion
reference, an identifiable Accelerate subject, dimensional layering and continuous
motion that works without hovering.

The selected reference is Dominik Fojcik's **Tower** study from
[Kinetic Images](https://tympanus.net/Tutorials/KineticImages/), explained in the
[July 9, 2025 Codrops article](https://tympanus.net/codrops/2025/07/09/how-to-create-kinetic-image-animations-with-react-three-fiber/).
Its public exported demo was inspected locally from
[the author's repository](https://github.com/DGFX/codrops-kinetic-images) at
`965dda362a8f9e5d522ed675493897200d273e49`. The reference uses broad cylindrical
image strips, interleaved slim typographic banners, a fixed oblique camera and
opposing print movement. The implementation adapts that composition rather than
introducing another cursor effect. Lusion and Unseen were also researched, but
their browser entry/loading screens are not evidence of an inspected hero loop.

## Adaptation to Accelerate

Three broad printed cylinders and two narrow counter-running ribbons occupy the
existing right-hand stage. Their staggered print phases expose the wordmark and
three-chevron identity at different points. The narrow strips use separate,
legible typography rather than compressing the broad wordmark into a thin line.
The camera and silhouette stay composed while the printing travels around the
surfaces. Ink backs, soft side shading and edge falloff expose the layers.

The native WebGL owner remains in `HeroArtwork.tsx`. It uses one prepared mesh,
two locally generated print textures and five draws per frame. Trilinear
minification and high-precision texture coordinates prevent the rough type edges
found in the first browser capture. No new graphics dependency, third-party
photographs, models, textures or implementation code are imported.

The static PNG is generated from the same renderer's reduced-motion pose. It is
630 by 700 pixels, includes transparency and is loaded eagerly. It replaces the
old SVG arrows for server HTML, failed JavaScript and unavailable/lost graphics.
The poster and renderer both invert for dark mode through the actual
`data-theme` setting. Review caught the inherited renderer watching a `dark`
class that the theme provider does not use; both rendering and the induced
context-loss test now follow the shared theme attribute. Desktop controls sit below
the sculpture. Phone artwork is smaller and raised clear of the chapter index;
the Pause/Play control sits at the left gutter, clear of the booking note and
artwork. Tablet controls sit at the lower edge of their stage.

| Before                                           | After                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Three rigid metallic chevrons                    | Five layered cylindrical bands derived from the Tower reference              |
| Rotation and separation of arrow meshes          | Continuous wordmark and counter-running ribbon printing                      |
| One material without printed typography          | Two original brand textures with depth shading and smooth filtering          |
| SVG arrow fallback                               | Matching, eagerly loaded PNG with dark-mode inversion                        |
| Caption and control overlaying the new sculpture | Separate desktop, tablet and phone control positions                         |
| SVG-specific no-JavaScript assertion             | Decoded, non-placeholder image checks for no JavaScript and graphics failure |

| Renderer observing an unused `dark` class | Renderer, poster and graphics-loss test follow the shared `data-theme` attribute |
| Navigation observer armed after a click | Existing observer armed before navigation, with unchanged timing thresholds |

## Verification and release boundaries

The existing 30fps drawing cap, 1.5 DPR ceiling, hidden/offscreen/menu pause,
manual Pause/Play, reduced motion, entrance coordination and cleanup remain in
the same owner. The artwork never consumes pointer or touch movement. Headline,
supporting copy, booking flow and navigation primitives are unchanged.

The hero journey retains actual frame comparisons for movement, pause and
resume, keyboard booking order, line entrances, cached navigation, history,
delayed hydration, failed runtime, no JavaScript and induced graphics failure.
The previous navigation-observation fix is carried as a separate commit: it
arms the existing timing observer before the click, preserving its thresholds.
The fallback checks now require a decoded image larger than a placeholder.

Desktop/mobile captures, dark mode, native WebKit and reduced-motion screenshots
must be opened alongside the automated results. Private evidence lives outside
the repository under `20261005-home-hero-reference`; exact revision and completed
check receipts belong in the PR. A passing implementation or CI run is separate
from visual acceptance, merge and production publication.

## Public release-content review

`src/content/changelog.ts` describes the reference, resulting motion and static
fallback, and explicitly separates this source release from production.
`src/content/docs/`, `src/content/command-center.ts` and
`src/content/command-center-faq.ts` were reviewed. They describe workspace tasks,
capabilities and controls; none changes in this homepage artwork replacement.
Their existing wording remains accurate. The generated docs index is unchanged.

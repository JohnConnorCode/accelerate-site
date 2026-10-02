# Homepage art direction, October 2, 2026

The founder rejected the published homepage's abstract waves and mouse response
and requested research and a more artful, modern replacement. This correction
starts from published main `2877fc1a9280318237ea752e0f62d3bee6ce3c20` in the isolated
`design/hero-art-direction-20261002` checkout. The existing source checkouts,
unrelated unfinished work and board claims remain intact.

## Research and direction

Primary references were the current [Instrument homepage](https://www.instrument.com/),
[COLLINS homepage](https://wearecollins.com/) and
[ManvsMachine's iMac Pro case](https://mvsm.com/project/imac-pro).
Instrument presents a moving-image reel alongside its brand-led typography.
COLLINS uses a large moving-image stage. ManvsMachine describes an architectural
motion sequence with photographic material textures and monolithic forms.
COLLINS' [San Francisco Symphony case](https://wearecollins.com/case-studies/san-francisco-symphony/)
also demonstrates motion developed from the identity's typography and musical
subject. The COLLINS homepage and Symphony frames were visually inspected;
ManvsMachine's project description was read. Reference assets are not included
in the application.

The design inference is to give the animation an identifiable subject, material
and composed movement. Accelerate's existing three-chevron mark supplies that
subject. Its three dimensional forms turn and separate on one continuous loop;
their bevels and changing metallic reflections provide depth. The headline has
its own space and stays steady. The implementation uses a small native WebGL
mesh and a server-rendered SVG poster, without another graphics dependency.

| Before                                         | After                                                   |
| ---------------------------------------------- | ------------------------------------------------------- |
| Abstract waves across the headline             | Dimensional identity beside the headline                |
| Cursor-following depths and local illumination | A controlled rotation and changing reflections          |
| No direct motion control                       | Visible Pause/Play, after booking in the keyboard order |
| Artwork crowded a short phone's booking area   | Short phones extend the hero to preserve separate space |

## Review and regression coverage

Desktop light/dark, a smaller desktop, tablet, full-height phone, short phone and
320px phone screenshots were opened. Actual canvas screenshots change during
motion, remain identical when paused, and change again on Play. Pointer movement
and touches do not steer the object. The motion control's focus overrides its
concealed entrance so keyboard users can always see the focused control.

The hero journey retains rendered word-mask frames, line timing, concealed
booking hit targets, keyboard booking, warm forward navigation and history
restoration. It checks reduced motion, delayed hydration, watchdog recovery,
failed JavaScript and no-JavaScript HTML. New tests induce unavailable WebGL and
real context loss, then change theme to verify that the static poster remains.
Both Chromium and WebKit render the WebGL composition. Disposable Linux CI
browsers use Chromium's [documented SwiftShader GL driver](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md)
to exercise WebGL on runners without a GPU; unavailable WebGL remains a separate
explicit fallback test. Safari initially exposed
minute floating-point differences in poster attributes; bounded decimal output
fixes the hydration mismatch instead of suppressing it.

The mobile journey covers repeated cached navigation, Back/Forward, reloads,
chapter traversal, layout stability and reduced motion. Measured idle p95 frame
gaps were 16.7ms in 4x-throttled Chromium and 20ms in native Mac WebKit. These are
browser measurements, not claims about physical phone performance. Drawing is
capped at 30fps and 1.5 device-pixel ratio and stops offscreen, in a hidden tab,
behind mobile navigation, for reduced motion or manual pause.

The source-stat detail is updated for the new component. Copy guardrails, Work
ownership, architecture, lint and source statistics are checked separately from
production build, protected CI, merge and hosted outcomes. The PR and private
release receipt record the immutable candidate and those subsequent results.

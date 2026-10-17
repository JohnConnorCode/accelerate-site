# Work motion contract

The public site has one observer lifecycle in
`src/components/motion/useReveal.ts`. The Work index and every `/work/[slug]`
case study configure that lifecycle through `src/components/work/WorkMotion.tsx`
and own one Work visual recipe in `globals.css`.

## Ownership

- `WorkReveal` owns editorial groups, cards, proof, and CTA entrances.
- `WorkMediaReveal` owns standalone case-study media entrances.
- `RevealHeading` owns only the hero word-mask entrance. Initially visible
  headings must animate; `initialViewport: "immediate"` is not a valid default
  for heading entrances. Pending state is present in server markup before paint.
- Public section/intro wrappers share the observer and CSS recipe. A nested
  heading or entrance defers to its owning group, rather than animating twice.
- Framer Motion inside `CaseGallery` owns only interactive lightbox enter and
  exit behavior. It does not own page-scroll entrances.

Work components must not import the homepage `Reveal` or `useRv` wrappers, use
`whileInView`, or introduce another IntersectionObserver. Trigger behavior is
configured explicitly through the shared lifecycle rather than inherited from
homepage defaults.

## One owner per element

A Work card animates as one semantic unit. Its nested cover media must not add a
second entrance. Standalone case-study galleries animate each media item because
they have no animated card ancestor. Nested entrance wrappers are prohibited.

## Timing and accessibility

- Server-rendered content is visible by default when JavaScript is unavailable.
- Generic public reveals hide only while `data-reveal-state="pending"` after
  the motion-ready gate. Work reveals keep a delayed-hydration pending frame
  via `.motion-ready .work-reveal:not(.in)`.
- The homepage hero uses the shared lifecycle with its own visual sequence.
  The pre-paint gate conceals complete words behind baseline-preserving masks,
  rather than moving already visible text. The eyebrow wipes in, responsive
  headline lines reveal as readable groups, then the explanation, booking
  action and service index enter. The artwork is an SVG automation system built from the existing three-chevron
  identity. Customer inquiries, meetings and invoices connect through the core
  to distinct example actions. One imperative controller owns SVG geometry,
  signals, pointer steering, drag and keyboard controls. The grip stays fixed
  while the sculpture moves so pointer steering keeps a stable hit area. Static server geometry
  remains readable without JavaScript. Drawing pauses offscreen, in hidden tabs,
  behind mobile navigation, for reduced motion and through the shared motion
  control. Coarse pointers receive bounded responses rather than continuous idle
  animation. Selecting a workflow updates its pressed state and announces its
  example result. Reduced motion applies interactions immediately without
  ongoing frame work. Cleanup releases animation frames and observers.
  The finite headline sequence retains one pre-paint entrance owner.
  Pending content must not flash.
  Reduced motion, unavailable JavaScript and the hydration watchdog show the
  complete static composition. Concealed booking actions do not accept pointer
  clicks. Keyboard focus immediately exposes the booking action and leaves it
  available after focus moves away. Only a fresh entrance resets this override;
  restoring an already visited history entry keeps the hero readable.
- Public booking docks and the Command Center utility bar share immediate
  visibility, inertness and focus withdrawal. The native scroll handler updates
  these before React starts an animated exit, including rapid scroll reversals.
  While a dock is visible, one bounded timer also detects position changes when
  Safari defers scroll events or paint callbacks. It reads only the scroll offset,
  updates on a changed position, and stops when hidden, in a background tab or on
  route unmount. Chat hit testing follows the shared visibility mutation
  immediately; its visual transition continues on its existing animation clock.
- One inline root bootstrap arms every public reveal before first paint when
  JavaScript is available. A hydration watchdog removes that gate if the
  application runtime fails to start.
- Each below-fold group remains pending until it reaches the explicit 76–78%
  viewport entry line.
- The shared lifecycle re-arms retained DOM before paint on fresh cached visits.
  History restoration completes owners already in view without replaying them;
  below-fold owners still enter when reached. Persisted `pageshow` completes
  visible entrances. Animation recipes honor `reveal-immediate`, including
  generic UI and legacy stagger groups. A document history hint must not control
  an already committed owner's animation, or later navigation can restart it.
- Pending owners share one frame-coalesced fallback scroll listener. Geometry
  reads precede state writes. Coarse-pointer scrolling avoids large entrance
  blur and continuous media spring subscriptions. The homepage's full-height
  touch composition keeps a dedicated artwork area and an accessible motion control.
- Group children use a restrained semantic stagger. Cards stagger five semantic
  children from one owning wrapper; proof, CTA, and standalone media use one
  entrance on their owning wrapper.
- Scroll-linked media depth may run inside an entrance owner because it is a
  continuous compositor-only transform, not a second entrance. It must preserve
  overscan, reduced-motion, static HTML visibility, and intrinsic layout.
- Reduced motion and unavailable JavaScript show all content immediately.
  Delayed hydration preserves a stable pending frame instead of painting
  content visible and then pulling it backward into an entrance.
- Homepage count animations retain the complete figure on history restoration.
  Unmounting or enabling reduced motion cancels their pending animation frame.

## Required verification

`npm run test:work-portfolio` enforces the ownership boundary statically.
`npm run qa:home-hero-timing` additionally checks concealed pending words and
actions, rendered entrance frames, semantic timing, complete fallback states,
keyboard activation, history restoration, perceptible SVG signal travel, distinct
workflow actions, paused geometry and decoded pixels, and desktop/mobile composition.
`npm run qa:mobile-motion` checks full-height mobile composition, repeated warm
client visits, reloads, Back/Forward, document history restoration, complete
chapter traversal, layout stability and reduced motion. Pass `-- --webkit` for
the same Safari engine journey alongside Chromium. Chromium uses 4× CPU
throttling; these checks establish browser emulation, not physical-device speed.
The 50ms p95 frame budget applies to throttled Chromium and native Mac WebKit.
Timing QA retains the browser animation start clock separately from event-handler
delivery time. Fresh-navigation evidence is captured inside the browser before
automation returns, with the existing running-clock and concealment requirements.
Warm mobile frame samples begin at that captured entrance, even when the caller
returns after the animation has settled.
`node scripts/test-hero-motion-observer.mjs` covers late reads, bunched event
delivery, and missing, collapsed, misordered, immediate and stale entrances.
Linux headless WebKit retains its pacing measurements and the shared 200ms
stall ceiling. Expected same-origin RSC prefetch discards are diagnostics only
while an explicit document navigation is in progress; other errors fail.
`npm run test:work-portfolio-qa` must prove at desktop and mobile widths that:

- every Work route has an armed below-fold entrance;
- the entrance changes from pending to visible at viewport entry;
- every Work group and media block completes with a Work-owned animation;
- no element remains hidden after traversal;
- reduced motion has no nonessential animation;
- delayed hydration remains visually stable and unavailable JavaScript remains
  fail-open;
- screenshots are opened and visually inspected.

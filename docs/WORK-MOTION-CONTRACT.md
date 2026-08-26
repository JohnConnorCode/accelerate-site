# Work motion contract

The public site has one observer lifecycle in
`src/components/motion/useReveal.ts`. The Work index and every `/work/[slug]`
case study configure that lifecycle through `src/components/work/WorkMotion.tsx`
and own one Work visual recipe in `globals.css`.

## Ownership

- `WorkReveal` owns editorial groups, cards, proof, and CTA entrances.
- `WorkMediaReveal` owns standalone case-study media entrances.
- `RevealHeading` owns only the hero word-mask entrance.
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
- One inline root bootstrap arms every public reveal before first paint when
  JavaScript is available. A hydration watchdog removes that gate if the
  application runtime fails to start.
- Each below-fold group remains pending until it reaches the explicit 76–78%
  viewport entry line.
- Group children use a restrained semantic stagger. Cards stagger five semantic
  children from one owning wrapper; proof, CTA, and standalone media use one
  entrance on their owning wrapper.
- Scroll-linked media depth may run inside an entrance owner because it is a
  continuous compositor-only transform, not a second entrance. It must preserve
  overscan, reduced-motion, static HTML visibility, and intrinsic layout.
- Reduced motion and unavailable JavaScript show all content immediately.
  Delayed hydration preserves a stable pending frame instead of painting
  content visible and then pulling it backward into an entrance.

## Required verification

`npm run test:work-portfolio` enforces the ownership boundary statically.
`npm run test:work-portfolio-qa` must prove at desktop and mobile widths that:

- every Work route has an armed below-fold entrance;
- the entrance changes from pending to visible at viewport entry;
- every Work group and media block completes with a Work-owned animation;
- no element remains hidden after traversal;
- reduced motion has no nonessential animation;
- delayed hydration remains visually stable and unavailable JavaScript remains
  fail-open;
- screenshots are opened and visually inspected.

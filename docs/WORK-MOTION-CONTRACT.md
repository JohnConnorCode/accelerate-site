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

- Server-rendered content is visible by default.
- JavaScript arms a start state only after hydration.
- Each below-fold group remains pending until it enters 90% of the viewport.
- Group children use a restrained semantic stagger. Cards, proof, CTA, and
  media use one animation on their owning wrapper.
- Reduced motion, delayed JavaScript, unavailable JavaScript, and back-forward
  restoration must show all content without waiting for animation.

## Required verification

`npm run test:work-portfolio` enforces the ownership boundary statically.
`npm run test:work-portfolio-qa` must prove at desktop and mobile widths that:

- every Work route has an armed below-fold entrance;
- the entrance changes from pending to visible at viewport entry;
- every Work group and media block completes with a Work-owned animation;
- no element remains hidden after traversal;
- reduced motion has no nonessential animation;
- delayed and unavailable JavaScript remain fail-open;
- screenshots are opened and visually inspected.

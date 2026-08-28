# Admin visual contract

## Capability icons

- Icons identify the object or action in front of the operator. Replies use
  communication icons, approvals use review or shield icons, records use their
  domain icon, and status uses status iconography.
- `Bot`, sparkle, or wand marks are reserved for an explicit AI entry point or
  an action that directly starts model work. They are not decoration and must
  not repeat across queue rows, approvals, notifications, or prompt chips.
- A surface that is already titled AI Workspace needs at most one AI identity
  mark. Child navigation and evidence cards describe their own function.
- In a homogeneous list, a leading icon is omitted unless its variation conveys
  a decision-critical category that is not already clear from the row title,
  status, or badge. Repeating the same icon on every row is visual noise, not
  hierarchy. Use typography, spacing, dividers, and restrained state accents to
  structure repeated work.

## Motion and loading

- Next.js owns route prefetching and Suspense. The shared admin fallback owns
  loading geometry. The committed route tree owns the single entrance sequence.
- The first committed admin destination and every later committed destination
  run one perceptible semantic stagger. The page heading, primary context, and
  work surfaces resolve in sequence through opacity, blur, and rise. The sequence
  must be visible in browser timing evidence, not merely present in source.
- Fast prefetched navigation should not manufacture a loading state. Slow
  navigation must never leave an empty application frame. A fallback never
  consumes or replaces the committed-content entrance.
- Navigation acknowledges touch or pointer intent immediately. The destination
  selection may move before its data commits, but committed-route accessibility
  state remains truthful. The target page header appears with the destination;
  unresolved data uses a regional skeleton below it instead of blanking or
  replacing the page.
- Initial reads, revisits, and background revalidation share one cancellable,
  deduplicated cache. Revalidation keeps useful content visible. Whole-page
  client fetch skeletons, mount-only duplicate requests, and arbitrary loading
  delays are prohibited.
- Route and regional entrance motion uses opacity, a small blur, and a small
  translate on composited properties. It starts from the first rendered frame,
  completes quickly enough for native-feeling navigation, and never blocks
  interaction. Content groups stagger semantically rather than every descendant
  receiving a bespoke delay.
- Reduced motion removes blur, translation, and breathing without changing
  route, focus, or loading semantics.
- Server-rendered demos expose their layout immediately but remain inert until
  session state has hydrated; automated journeys wait on the same explicit
  readiness marker a control relies on, never an arbitrary timeout.

## Composers and message fields

- AI commands, conversation replies, and other short message composers use the
  shared `admin-composer`, `admin-composer-field`, and `admin-composer-action`
  primitives. Do not rebuild nested gray trays with separately floating inputs.
- The composer is one surface with one focus treatment. It has a minimum 44px
  control height, transparent field interior, explicit placeholder contrast,
  concentric radii, and a single optically aligned action.
- An icon inside a composer appears only when it is the action itself. A repeated
  decorative icon beside an already-labelled input is prohibited.

## Mobile navigation

- The bottom dock is an expressive glass control, not a second page surface. It
  has no visible outline, preserves content visibility, uses a clear active
  treatment, and respects the safe area without unnecessary height. Attention
  counts live in the destination; a floating red dot does not decorate Today.
- The active dock surface is one shared layout element that travels between
  destinations. It does not disappear from one tab and pop into another. The
  incoming page and the moving dock state are verified together on a real
  client-side mobile navigation.
- A bottom sheet owns the bottom interaction edge while it is open. The dock
  transitions out before a notification sheet can overlap it, becomes inert,
  and returns only after the sheet closes and focus is restored.
- Overlay ownership is exclusive at each interaction edge. A drawer, bottom
  sheet, dialog, or AI panel must make displaced navigation inert, lock only the
  intended scroll viewport, trap focus where modal, and restore focus on close.
  Arbitrary route-local z-index patches are not an acceptable collision fix.
- Viewport-edge overlays portal outside transformed, filtered, and
  backdrop-filtered shell ancestors. They retain the active appearance through
  the shared overlay token scope and use unique control/panel IDs when desktop
  and mobile triggers coexist.
- `More` opens a right-side navigation drawer that is visually distinct from the
  page header and dock. It never becomes an accidental bottom sheet or an
  edge-to-edge panel that reads as broken page chrome.
- While `More` owns navigation, the dock transitions fully out instead of
  leaving a redundant or clipped sliver beneath the drawer.
- The sheet carries one title, one close action, and working native disclosure
  controls. It does not repeat the business identity already visible in the
  mobile header. Every disclosure exposes and hides its links in the accessibility
  tree as well as visually.

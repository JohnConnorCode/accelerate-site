# Navigation runtime contract

Accelerate has one client navigation runtime in
`src/components/navigation/NavigationRuntime.tsx`. It coordinates public pages,
the founder admin, and the full fictional admin demo without replacing Next.js
routing or creating surface-specific history systems.

## One owner for navigation state

- Next.js owns route resolution and rendering. The runtime records intent,
  history-entry identity, scroll state, route focus, and progress feedback.
- `useAppNavigation` is the shared programmatic navigation API.
  `useAdminNavigation` adds scenario-aware demo URL resolution and then delegates
  to that API.
- Internal anchors remain real links. The runtime may observe eligible clicks to
  record intent, but it must not cancel them or simulate routing itself.
- A navigation intent is observable immediately as `pendingHref`. Primary admin
  navigation may acknowledge that destination optimistically while
  `aria-current` continues to describe only the committed route. The receipt is
  cleared when the pathname commits; route-specific components do not invent a
  second pending-navigation state.
- Demo navigation must not use document-level click hijacking,
  `window.location.assign`, or a copied demo route tree.

## Scroll and history

- Browser scroll restoration is manual while the runtime is mounted.
- A new route starts at the top unless the caller explicitly requests preserved
  scroll. Browser Back and Forward restore the recorded position for that exact
  history entry.
- Public pages scroll the document. Admin and full-demo pages scroll the shared
  `.admin-main` application viewport registered by `AdminShell`.
- Query and hash changes preserve the caller's explicit scroll policy. Layout
  growth after a history traversal must not permanently displace the restored
  position.
- The runtime must merge its entry key into the existing Next.js history state,
  never overwrite framework-owned fields.

## Motion, loading, and focus

- Public hydration is not a route transition. Initial public server content
  remains visible and must not animate out before animating in. The admin is an
  application workspace: its first committed destination and every later route
  commit run the same single semantic entrance sequence.
- Public and admin routes each have one entrance owner. Route motion is a short
  opacity, blur, and rise on the incoming tree only; local dialogs, lists, and
  state changes may retain their own motion.
- Reduced motion removes nonessential movement and blur while preserving all
  route, loading, and focus behavior.
- Dynamic admin segments use Next.js `loading.tsx` and React Suspense so their
  shells can be partially prefetched, streamed, and interrupted. The shared
  route-aware fallback reserves destination-like geometry and appears without a
  blank intermediate frame once Next commits the loading boundary. While a
  navigation request is still pending, the current destination may remain usable
  instead of being prematurely replaced. Prefetched navigation skips the fallback entirely.
  Suspense belongs as close as practical to genuinely slow data; background
  refreshes preserve usable content instead of replacing it with a fallback.
- Route loading and client-data loading have different jobs. The shared route
  fallback may reserve the whole destination during an actual streamed route
  handoff. Once a page has committed, its real `PageHeader` and page identity
  remain mounted; only the unresolved data region may show semantic skeleton
  geometry. Revalidation retains the prior useful result whenever possible.
- Admin reads use the shared query provider for cancellation, request deduping,
  bounded cache reuse, and retained results. A client page must not add its own
  mount-only fetch lifecycle when the shared read primitive covers the request.
- The route stage distinguishes the fallback tree from the committed tree. The
  fallback has restrained loading motion; the actual destination always receives
  the incoming blur, opacity, rise, and bounded semantic stagger. The admin's
  initial committed tree runs this entrance once; fallback geometry does not.
- After forward navigation, focus moves without additional scrolling to the
  destination heading or main region and the route title is announced politely.
  History traversal restores reading position without stealing focus.

## Required verification

`npm run test:navigation-runtime` must cover public and admin forward navigation,
Back restoration, demo scenario switching without reload, mobile and desktop,
normal and reduced motion, overflow, console errors, and a single route-motion
owner. It must require the shared route-aware loading boundary, immediate useful
fallback visibility, committed-content motion, and event-derived focus handoff. Title QA
must prove live and demo routes receive contextual titles from
the mounted admin shell.

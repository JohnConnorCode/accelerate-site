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

- A valid admin navigation intent must produce visible feedback in the same
  frame as activation. The destination may show a pending state, but
  `aria-current` continues to describe only the committed route.
- The committed admin page remains visible until the destination route is
  ready. A root admin loading boundary must not replace the workspace with a
  full-page skeleton.
- Route entry and data entry are separate lifecycles. The shell owns the route
  transition; the shared async-region primitive owns delayed loading, retained
  data, error, and ready transitions close to the data that changes.
- Fresh async content enters with opacity, a small vertical offset, and
  restrained blur. A placeholder may appear only after a short delay and only
  in the region whose geometry it preserves. Cached data remains visible during
  refetch.

- Public hydration is not a route transition. Initial public server content
  remains visible and must not animate out before animating in. The admin is an
  application workspace: its first committed destination and every later route
  commit run the same single semantic entrance sequence.
- Public and admin routes each have one entrance owner. Route motion is a short
  opacity, blur, and rise on the incoming tree only; local dialogs, lists, and
  state changes may retain their own motion.
- Reduced motion removes nonessential movement and blur while preserving all
  route, loading, and focus behavior.
- Nested admin segments may use React Suspense close to genuinely slow data so
  those regions can be streamed and interrupted. The root admin layout must not
  define a `loading.tsx`: navigation keeps the committed destination usable until
  the next destination is ready. A nested fallback reserves only its region's
  geometry, appears only after the shared delay threshold, and is skipped by
  fast or prefetched reads. Background refreshes preserve usable content instead
  of replacing it with a fallback.
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
owner. It must reject a root admin loading boundary, require delayed regional
loading, retained-data refreshes, committed-content motion, and event-derived
focus handoff. Title QA must prove live and demo routes receive contextual titles
from the mounted admin shell.

Mobile verification must also measure same-frame activation feedback, committed
route identity, and ready-content entry. A pathname assertion alone is not
sufficient evidence of a polished transition.

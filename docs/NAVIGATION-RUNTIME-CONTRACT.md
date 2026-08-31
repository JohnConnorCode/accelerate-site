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
- Scroll receipts are a bounded 64-entry LRU held in memory during navigation.
  Scroll events update that map without parsing or rewriting storage; the small
  snapshot persists during browser idle time and flushes on page hide. A legacy
  unbounded receipt is trimmed on hydration so a restored mobile tab cannot make
  synchronous storage work block every navigation frame.

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
  remains visible and must not animate out before animating in. The homepage
  hero is the exception: it owns a mount-time `.loaded` gate. PROFIT and the
  booking button enter with delayed CSS transitions off that gate, so the hero
  must start unloaded and generic first-paint visibility rules must not force
  those two beats visible. The admin is an application workspace: its first
  committed destination and every later route commit run the same single
  semantic entrance sequence.
- Public and admin routes each have one entrance owner. Admin route motion is a
  short opacity and rise on the incoming tree only; it must not blur the full
  route or every large child surface. Local dialogs, lists, and state changes
  may retain their own motion.
- Route entrance state must be present in committed markup and stylesheet rules
  before first paint. Do not start route motion from `useEffect`, a mutation
  observer, or an imperative Web Animations call: those can expose the final
  frame first on fast devices and cached visits. The route key restarts the one
  declarative CSS sequence when Next commits a destination.
- Pending navigation gives the retained route subtle, immediate visual feedback
  without hiding usable content. It must not wait for route data, authentication,
  or an effect before acknowledging the destination.
- A shared overlay remains mounted outside its open-state conditional while its
  presence owner runs the exit sequence. Dialog callers keep the selected record
  through close and clear it only after the overlay lifecycle completes. A route
  must not conditionally mount the presence owner or use `initial={false}` to
  suppress an overlay's only entrance.
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
  the incoming opacity, rise, and bounded semantic stagger. The complete route
  entrance, including its capped stagger, finishes within 252ms. The admin's
  initial committed tree runs this entrance once; fallback geometry does not.
- The mobile dock owns one persistent selection indicator. Pending destination
  state changes its compositor-only transform immediately; it must not remount a
  shared-layout projection while the route DOM is committing. Cached navigation
  therefore cannot couple dock movement to route layout replacement.
- After forward navigation, focus moves without additional scrolling to the
  destination heading or main region and the route title is announced politely.
  History traversal restores reading position without stealing focus.

## Release and cache continuity

- Every production build has a stable `deploymentId`. Native Vercel builds use
  the Git deployment value; the checked-in prebuilt deploy command derives the
  same kind of immutable value from the committed Git revision.
- The checked-in production start and prebuilt build commands use the same
  release runner. The custom ID is a build-time fact serialized into Next's
  required server config and emitted route documents. The uploader verifies both
  before it can deploy the prebuilt output.
- Next 16's `experimental.runtimeServerDeploymentId` remains explicitly false
  for this prebuilt workflow. Vercel supplies a reserved `dpl_` value to the
  runtime; allowing it to override the custom build-time ID produces two
  bootstrap identities and can prevent hydration. The uploader must not inject
  `NEXT_DEPLOYMENT_ID` as a runtime environment override.
- Do not fall back to Vercel's reserved `dpl_` identifier inside `next.config`.
  The custom prebuilt ID is the version-locking key documented for prebuilt
  Next.js deployments.
- Do not add custom cache-clearing scripts, local-storage version flags, or hard
  reloads to route components. Next.js owns deployment-skew detection and turns
  a mismatched App Router response into the necessary document navigation.
- Returning-profile QA uses a persistent browser data directory across repeated
  runs. Incognito-only success is not release evidence.
- Command Center document and RSC responses are private application state. They
  must remain `private, no-cache, no-store, max-age=0, must-revalidate`, preserve
  RSC-aware `Vary` separation, and never be served from Chrome disk cache or a
  service worker. Hashed `/_next/static/*` assets retain their normal immutable
  caching; this policy is not a global cache disable.
- A persistent-profile investigation records CDP request provenance, response
  headers, click, route commit, and settled timestamps. Healthy Next router
  memory/prefetch reuse may commit without a new request; it is not equivalent
  to `Network.requestServedFromCache`, `fromDiskCache`, or
  `fromServiceWorker`.
- Do not tune transition durations, add cache-busting query strings, force hard
  reloads, or clear browser storage to conceal a navigation incident. Capture
  the failing persistent profile before mutation and identify the responsible
  request/cache layer first.

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

Overlay verification must sample intermediate entry and exit frames and prove
the overlay is still mounted during exit. Persistent-profile verification must
exercise at least 30 real Command Center navigations with cache enabled,
disabled, and re-enabled in the same browser data directory, followed by a fresh
profile control. It must fail on stale disk-cached RSC responses, service-worker
control, repeated document navigation, mixed deployment identities, URL/route
disagreement, runtime errors, or a material persistent-versus-fresh regression.
Physical Android Chrome evidence follows `docs/ANDROID-CHROME-CACHE-INCIDENT.md`.

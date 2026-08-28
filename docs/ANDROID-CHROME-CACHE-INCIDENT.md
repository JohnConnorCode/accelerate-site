# Android Chrome navigation/cache incident runbook

Use this runbook when a long-lived Android Chrome profile degrades while an
Incognito profile remains fast. Preserve the broken profile until both binary
tests and request traces are captured.

## Automated persistent-profile gate

Run the checked-in CDP harness against the exact release under investigation:

```sh
PLAYWRIGHT_BASE_URL=https://www.acceleratewith.us \
  node scripts/qa-persistent-profile.mjs \
  --iterations=30 \
  --phase=production-<release> \
  --profile=/tmp/accelerate-production-profile \
  --output=/tmp/accelerate-navigation-trace
```

The matrix reuses one Chromium data directory with HTTP cache enabled, disabled,
and re-enabled, then runs a fresh-profile control. JSON artifacts include every
Command Center RSC/document request, CDP cache provenance, relevant headers,
service-worker/Cache Storage state, deployment identity, and click-to-commit
timing. Do not replace this with fresh contexts.

## Physical Android binary tests

Connect the already-broken normal Chrome profile to desktop Chrome remote
debugging. Before clearing data, capture a navigation with Network recording on
and note `_rsc` or `text/x-component` requests. Repeat the same route sequence
with DevTools **Disable cache** enabled.

For each navigation preserve:

- click time, URL, RSC request start/finish, pathname commit, and settled time;
- status, content type, `Cache-Control`, `Age`, `Vary`, `ETag`,
  `x-vercel-cache`, request `x-deployment-id`, and response
  `x-nextjs-deployment-id`;
- whether DevTools/CDP reports memory cache, disk cache, service worker, or
  network; and
- whether a document request replaced client routing.

Then inspect persistent origin state before changing it:

```js
const registrations = await navigator.serviceWorker.getRegistrations();
console.table(registrations.map((registration) => ({
  scope: registration.scope,
  active: registration.active?.scriptURL,
  waiting: registration.waiting?.scriptURL,
  installing: registration.installing?.scriptURL,
})));
console.log("controller", navigator.serviceWorker.controller?.scriptURL);
console.log("caches", await caches.keys());
```

Only after recording the results may the diagnostic profile unregister an
obsolete worker and delete its identified legacy cache. Do not ship permanent,
indiscriminate same-origin cache deletion. If an old worker is proven, migrate
it at its original script URL and scope.

## Decision rules

- If disabling Chrome HTTP cache alone repairs the profile and CDP identifies a
  disk-cached Command Center RSC response, repair that response's cache/Vary
  policy and verify the on-wire headers. Do not disable static-asset caching.
- If removing a recorded obsolete worker/cache repairs it, ship a narrowly
  scoped worker migration.
- If a deployment ID mismatch causes one recovery document navigation, confirm
  the new document and subsequent RSC requests share one identity. Repeated hard
  navigations are a release failure.
- If neither binary test changes the behavior, preserve the trace and investigate
  the measured delay between RSC completion, route commit, and main-thread work;
  do not lengthen animations to hide it.

The incident is closed only when the same long-lived device profile survives
repeated navigation, a browser restart, and a new deployment with fresh-profile
equivalent route commits.

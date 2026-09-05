# Admin demo contract

The Accelerate site has two demos with different jobs. They must never be
described, linked, tested, or implemented as though they are the same surface.

## Canonical demo names

- **Interactive product preview** is the embedded preview on the public homepage
  and Command Center page. It is a short, purpose-built marketing explanation,
  not a standalone destination. The legacy `/command-center/demo` URL permanently
  redirects to the full admin demo launcher.
- **Full admin demo workspace** begins at `/demo/command-center`. It renders the
  actual admin route tree and shared components against fictional scenario data.

Every standalone public demo CTA and the admin sidebar's Demo workspace action
opens the full admin demo launcher. A test for the embedded product preview is
not evidence that the admin demo works.

## One admin, multiple fictional businesses

The live admin and full demo use the same pages, shell, navigation registry,
appearance system, dialogs, responsive behavior, and client operation surface.
Never create a parallel demo dashboard or copy an admin page into a demo folder.

Each fictional business is a versioned scenario pack containing tenant-facing
configuration, enabled capabilities, normalized records, exploration highlights,
and validation assertions. Guided tours are optional product behavior and are
currently disabled; opening a workspace must always allow immediate free
exploration. Each pack also has a distinct animated mark rendered by
the shared scenario-logo primitive in the launcher, shell, and safety controls.
The shared demo engine owns reads and simulated writes.
A scenario pack must not implement its own UI, fetch handlers, pipeline rules,
analytics formulas, AI runtime, or email sender.

The current sales suite contains five complete packs: home services, law firms,
professional services, real estate, and nonprofits. Each pack declares an
intentional default appearance, while the shared Appearance control still
offers Paper, Night, Signal, Studio, and Frost. A browser-session appearance
choice belongs to that scenario, survives switching away and back, and returns
to the declared default when that scenario is reset.

The launcher has its own light/dark preference. It must adapt its canvas, cards,
previews, controls, and focus states without overwriting any scenario's admin
appearance.

Adding a scenario is data plus one registry entry. Adding an enabled admin route
or operation requires demo coverage or an explicit capability exclusion with a
business reason.

## Navigation parity

Live admin and the full demo share the navigation runtime described in
`docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md`. Shared admin components link to canonical
`/admin/*` destinations; the demo link adapter resolves those destinations to
the active fictional scenario before the browser navigates. Do not intercept
document clicks, hard-reload the workspace, or maintain a second demo-only
history implementation.

The admin content panel is the application scroll viewport on desktop and
mobile. Forward navigation starts the destination at its top, browser Back and
Forward restore the prior panel position, and scenario changes replace the
current fictional workspace without mixing its history or session state.

## Isolation and truthfulness

- Demo records are invented and use `.example` addresses. Never copy production
  records, provider payloads, credentials, prompts, or customer content.
- Demo state remains in versioned browser session storage. It never writes to
  Supabase or another backend.
- Admin APIs, analytics ingestion, chat, cron, webhooks, email, calendar, AI
  providers, and other external actions are blocked from the demo runtime.
- Every simulated mutation says it is simulated and records a local receipt.
- Live `/admin` authorization remains founder-only and fail-closed. Demo routing
  is not an authentication exception for live data.
- A validated internal demo rewrite may re-enter middleware, but it must retain
  the fictional runtime marker and no-index headers instead of falling through
  to the live login path. That marker selects checked-in demo data only and
  never authorizes a live admin API.
- Every demo URL is no-index and excluded from the sitemap.

## Scenario completeness

Demo scenario reads use the same retained query cache and async-region lifecycle
as live reads. Scenario data must not manufacture a full-page loading state
between primary routes or on revisit. Cached and repeatedly visited mobile
routes must preserve immediate dock feedback and the same bounded route entrance
as a fresh profile; persistent scroll receipts may not grow work on the
interaction frame. The default sales demo represents a
configured, healthy operating system and does not show setup warnings unless a
scenario explicitly demonstrates setup or recovery.

On mobile, Today begins with a compact two-by-two operating summary followed by
the priority queue. Duplicate desktop rails and the full operational ledger are
not part of the primary mobile reading order. Search is one responsive command
surface: centered on desktop and a safe-area-aware full-height sheet on mobile.
Local destinations and commands are immediate; remote people results enhance
rather than block the surface.

Every enabled route must load populated, internally consistent data and expose
its primary safe interactions. Today, Pipeline, Conversations, record timelines,
notifications, revenue, analytics, activity, email, and AI answers must derive
from the same scenario graph and reconcile after simulated changes.

Loaded admin page regions preserve one shared content-stack rhythm across direct,
cached, refreshing, and demo reads. Async wrappers must carry that layout contract
instead of relying on route-level sibling selectors that stop at the wrapper.
Adjacent top-level surfaces may not touch or overlap at any viewport or appearance.
Tenant-neutral routes also keep neutral copy; scenario-specific language belongs
in scenario data, never hard-coded into a shared page.

Scenario QA covers desktop and mobile, all admin appearances, keyboard and focus,
reduced motion, overflow, console errors, refresh persistence, exact reset,
cross-scenario isolation, and a founder-authenticated run proving zero protected
or provider requests.

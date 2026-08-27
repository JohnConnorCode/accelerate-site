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

Adding a scenario is data plus one registry entry. Adding an enabled admin route
or operation requires demo coverage or an explicit capability exclusion with a
business reason.

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

Every enabled route must load populated, internally consistent data and expose
its primary safe interactions. Today, Pipeline, Conversations, record timelines,
notifications, revenue, analytics, activity, email, and AI answers must derive
from the same scenario graph and reconcile after simulated changes.

Scenario QA covers desktop and mobile, all admin appearances, keyboard and focus,
reduced motion, overflow, console errors, refresh persistence, exact reset,
cross-scenario isolation, and a founder-authenticated run proving zero protected
or provider requests.

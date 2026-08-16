# Accelerate Agency - Project Instructions

## Project Structure
- Next.js 14+ app in `accelerate-site/`
- TypeScript, Tailwind CSS, Framer Motion, GSAP, Three.js
- Content data: `src/content/` | Components: `src/components/sections/` | Types: `src/lib/types.ts`

## Positioning & Voice

**Core identity:** Accelerate is your embedded AI operations team. Not an agency. Not a SaaS platform. We build custom systems AND run them alongside you.

**Voice pillars:**
1. Revenue, not leads — "Book more jobs" / "Sign more clients" / "Close more deals"
2. The team you never had to hire — AI framed as team members, not software
3. Full lifecycle: Find > Win > Keep > Grow — not just top-of-funnel
4. Time as currency — specific hours reclaimed
5. Peace of mind — "Every inquiry answered. Every follow-up sent." (NEVER call-centric: "every call answered", "missed calls", "answer every call" are banned in positioning copy — Accelerate is channel-agnostic, phone answering is one feature of one service, not the identity)
6. Built and run for you — the differentiator vs software/agencies

**Vocabulary rules:**
- Avoid "leads" — use: jobs, clients, consultations, appointments, inquiries, revenue
- Avoid "all-in-one" — overused by every competitor
- Always mention AI prominently in hero/headline copy
- Be specific (dollar amounts, percentages, timeframes) not vague

## Top 5 Competitor References (Copy & Strategy)

Always refer to these when writing or reviewing site copy:

1. **Podium** (podium.com) — Revenue-forward AI copy. "AI that converts leads and makes you money." AI Employee metaphor.
2. **Smith.ai** (smith.ai) — AI + human hybrid. "Your AI workforce for the front office. Fully staffed, 24/7." Action-verb stacking.
3. **Broadly** (broadly.com) — Named AI roles. "Get chosen locally." Tangible AI team members.
4. **Scorpion** (scorpion.co) — Agency model. "Revenue, not just leads." Managed service positioning.
5. **ServiceTitan** (servicetitan.com) — Category-defining. "The operating system for the trades." Specificity + ambition.

See detailed analysis: `.claude/projects/.../memory/competitor-references.md`

## Visual QA Rule
After making visual/layout changes to components, always take a screenshot and review it before considering the work done. Check for empty space, broken layouts, alignment issues, and overall visual balance. Iterate until it looks right — don't ship blind.

Use Playwright for local visual and interaction QA. If the in-app browser is unavailable, disconnected, or unauthenticated, that is not a blocker and is not worth reporting as one: immediately use the repository's Playwright installation instead. Capture desktop and mobile screenshots for substantial admin UI changes and exercise the primary interaction when practical.

## Infrastructure

### Supabase
- **Project:** Accelerate Agency (`skjypuwkceoiunyhhqlm`)
- **URL:** `https://skjypuwkceoiunyhhqlm.supabase.co`
- **Region:** East US (North Virginia) / `us-east-1`

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, secret) |
| `ADMIN_EMAIL` | Admin notification recipient |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `RESEND_FROM_EMAIL` | Outbound email sender |
| `RESEND_API_KEY` | Resend API key (secret) |
| `ANTHROPIC_API_KEY` | Claude API key for proposal generation (secret) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible analytics domain |
| `PLAUSIBLE_API_KEY` | Plausible Stats API key (server-only, secret) |
| `NEXT_PUBLIC_GTAG_ID` | Google Analytics 4 measurement ID (public) |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta/Facebook Pixel ID (public) |
| `NEXT_PUBLIC_GSC_VERIFICATION` | Google Search Console verification code (public) |

Local values: `.env.local` (gitignored). Production values: Vercel dashboard.

## Deploying — READ THIS BEFORE TOUCHING DEPLOYS

**Full guide: `DEPLOY.md` (project root).**

**The deploy is one command:**
```bash
npm run deploy        # runs: vercel pull → vercel build --prod → vercel deploy --prebuilt --prod
```

**Verify the account is right BEFORE deploying:**
```bash
npm run deploy:check  # must print "farrellroofingco-4693" and "robert-farrells-projects"
```

If you're on the wrong Vercel account, `vercel logout && vercel login` and pick the right one. **Never deploy via `git push`** — the project has Commit-Author Verification on Robert Farrell's team, so non-Robert commits get auto-blocked (`readyState: BLOCKED`, hidden behind `UNKNOWN` in CLI). CLI `--prebuilt` deploys bypass this entirely (no source, no `.git` read).

**Never run `vercel link`** — the project is already linked via `.vercel/project.json` (`prj_JDk6HGWB7lcgeJlusvWZmYxIIrfj` / `team_qHBO9P2V9uF31MH4k6s4mz8F`). Running `link` without `--project` while authed against the wrong team creates a phantom project on that team.

**Rollback:** `npm run deploy:rollback` (interactive picker, re-aliases prod to a previous Ready deploy).

**Verify after deploy:** `curl -sI https://www.acceleratewith.us | head -3` should return `HTTP/2 200`. (Note: `acceleratewith.us` 307-redirects to `www.acceleratewith.us` — always check the `www` URL.)

### Database Migrations (run order)
1. `supabase/migration.sql` — Base schema (solution_requests, plan_views)
2. `supabase/migration-prompt2.sql` — Lead management, content_calendar, chat_leads
3. `supabase/migration-prompt2b.sql` — Case studies, website_grades, resource_downloads, email_sequences, partner_applications
4. `supabase/migration-prompt3.sql` — Admin settings table + seed data
5. `supabase/migration-prompt4.sql` — Contact submissions, subscribers, constraint fixes
6. `supabase/migration-prompt5.sql` — Admin notifications table
7. `migrations/business-operating-system.sql` — Tasks, clients, sent_emails, proposals, notification priority column
8. `migrations/utm-tracking.sql` — UTM attribution columns on all lead capture tables
9. `migrations/roofing-booking-machine.sql` — Legacy roofing qualifier and Calendly attribution compatibility
10. `migrations/20260816-revenue-os.sql` — Canonical Revenue OS, conversations, campaigns, Google, approvals, health, and audit ledger
11. `migrations/20260816-feature-board.sql` — Internal roadmap, durable drag ordering, labels, priorities, delivery details, and seeded Revenue OS follow-up work

Revenue OS setup and verification: `docs/REVENUE-OS-SETUP.md`. Secret settings are environment-only; do not store API keys in `admin_settings`.

All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

### Auth Flow
- Supabase Auth (email/password) → middleware (`src/middleware.ts`) checks session → `requireAdmin()` (`src/lib/admin/auth.ts`) verifies authenticated user
- Admin email: `john@acceleratewith.us`
- Any authenticated Supabase user can access `/admin` (no role-based check)

## Pre-Commit Requirements
1. `npx tsc --noEmit` — zero errors
2. `npm run build` — production build succeeds
3. No console errors at runtime

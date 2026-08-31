# Accelerate Agency - Project Instructions

## Mandatory agent contract

Read `AGENTS.md` first. The universal data, automation, and intelligence contract
is `docs/REVENUE-OS-ENGINEERING-CONTRACT.md`; the exact ticket procedure is
`docs/AGENT-TICKET-RUNBOOK.md`; authoritative domain ownership is indexed in
`src/lib/revenue-os/README.md`. Run `npm run verify:agent-contract` before work.

## Project Structure
- Next.js 16 app in `accelerate-site/`
- TypeScript, Tailwind CSS, Framer Motion, GSAP, Three.js
- Content data: `src/content/` | Components: `src/components/sections/` | Types: `src/lib/types.ts`

## Positioning & Voice

The canonical copy contract is `docs/MARKETING-POSITIONING-CONTRACT.md`. Read it
before changing public copy. The summary below cannot override it.

**Core identity:** Accelerate learns how a business works, identifies where AI
and automation can free time or increase revenue, then advises, builds,
integrates, executes, trains, and improves the right custom solution.

**Permanent product rule:** The Command Center is one integrated solution, not
the company, the default deliverable, or the organizing idea for the homepage.
Other valid answers include a focused workflow, AI agent, integration, internal
tool, training, or managed execution.

**Voice pillars:**
1. Revenue, not leads — "Book more jobs" / "Sign more clients" / "Close more deals"
2. Custom by default: start with the business and recommend the right-sized answer
3. Full engagement: advise, build, integrate, execute, train, and improve
4. Time as currency: name the work and hours returned when the claim is grounded
5. Revenue as an outcome: explain the mechanism instead of inventing a return
6. Built and run for you: implementation and execution remain part of the offer

**Vocabulary rules:**
- Avoid "leads" — use: jobs, clients, consultations, appointments, inquiries, revenue
- Avoid "all-in-one" — overused by every competitor
- Always mention AI prominently in hero/headline copy
- Be specific, but never invent dollar amounts, percentages, clients, or history
- Never use `Same machine. Different Tuesday.` or any `Same X. Different Y.` variant
- Avoid punchline fragments, formulaic contrast copy, and consultant filler

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

**Completion rule:** Never tell the user a design, layout, animation, or interaction is complete based on source code, computed values, or assumptions alone. Only say it is complete after reviewing a fresh screenshot of the running local app at the requested viewport and exercising the relevant interaction when applicable. If that verification is interrupted or unavailable, say it is unverified—never imply completion.

Use Playwright for local visual and interaction QA. This repository rule is operational, not optional:

- Run the repository Playwright scripts directly (`node scripts/shot.mjs ...`, `node scripts/film.mjs ...`, or a scoped `scripts/qa-*.mjs` journey).
- If an in-app or connected browser is unavailable, disconnected, or unauthenticated, do not stop, ask about it, or report it as a blocker. Immediately run the repository Playwright installation from the shell.
- For responsive work, capture the exact reported viewport plus representative short, standard, and tall mobile viewports. Review the PNGs with the image viewer; DOM measurements alone are not visual verification.
- For animation or interaction work, capture timed frames or exercise the interaction in Playwright in addition to the final-state screenshot.
- Do not hand off visual work until the screenshots have been opened and inspected and any visible regression has been corrected.

## Revenue OS Backlog Contract

- `/admin/features` is the execution source of truth. The authoritative managed-card manifest is `scripts/feature-backlog-data.mjs`.
- Run `npm run seed:features` to validate it, `npm run seed:features -- --verify` to check live drift without writing, and `npm run seed:features -- --apply` only when intentionally reconciling the live board.
- Before implementation, claim the relevant card by setting Owner and read its dependencies, starting points, guardrails, and acceptance criteria.
- Keep work Planned until it actually starts, In progress only while the scoped outcome is incomplete, and Shipped only after all acceptance criteria have evidence.
- Record commands, test results, production evidence, important decisions, and discovered follow-up work in the card’s Internal notes.
- Do not maintain a competing roadmap. Add newly discovered Revenue OS work to the manifest with a stable key and agent-ready detail, then reconcile the board.

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
| `OPENROUTER_API_KEY` | Single server-only AI gateway key for every AI workflow (secret) |
| `OPENROUTER_MODEL` | Optional default OpenRouter model override |
| `OPENROUTER_FALLBACK_MODEL` | Optional OpenRouter-routed fallback model; no cross-provider SDK fallback is used |
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
npm run deploy:check  # must print "johnconnorcode" and "john-connors-projects-d9df1dfe"
```

If you're on the wrong Vercel account, `vercel logout && vercel login` and pick the right one. Deploy with CLI `--prebuilt` (what `npm run deploy` does) regardless — no Git repository is connected to this project, so there's nothing for `git push` to trigger anyway.

**Never run `vercel link`** — the project is already linked via `.vercel/project.json` (`prj_w46n3AgV4L4IGEJZ0WzCBCZhDTot` / `team_aoXdtupaCmY2LDwBtCd4d7If`). Running `link` without `--project` while authed against the wrong team creates a phantom project on that team.

**Migrated 2026-08-24** off Robert Farrell's team to John Connor's personal account — see `DEPLOY.md` reference card for the full account/project IDs and what moved.

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
12. `migrations/20260816-first-party-analytics.sql` — Turn-key privacy-minimised site events
13. `migrations/20260816-money-first-outreach.sql` — Idempotent sends and unsubscribe suppression
14. `migrations/20260816-email-studio.sql` — Versioned draft/live email editing and publishing
15. `migrations/20260816-contact-importer.sql` — Approval-gated AI contact import batches and receipts

Revenue OS setup and verification: `docs/REVENUE-OS-SETUP.md`. Secret settings are environment-only; do not store API keys in `admin_settings`.

All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

Run new migrations yourself with `npm run db:migrate -- <migration.sql>`. The
command reads the Accelerate database password from macOS Keychain service
`accelerate-supabase-db-password`, validates the fixed project target, and stops
on the first SQL error. Never hand migration execution back to the founder.

### Auth Flow
- Supabase Auth (email/password) → middleware (`src/middleware.ts`) checks session → `requireAdmin()` (`src/lib/admin/auth.ts`) verifies authenticated user
- Admin email: `john@acceleratewith.us`
- Admin pages and APIs fail closed unless the authenticated email matches the
  configured `ADMIN_EMAIL`; middleware and `requireAdmin()` enforce the same rule.

## Pre-Commit Requirements
1. `npm run verify:agent-contract` — architecture and managed-card handoff pass
2. `npx tsc --noEmit` — zero errors
3. `npm run lint` — zero errors
4. The scoped service/API/Playwright journey passes
5. `npm run build` — production build succeeds
6. `git diff --check` — no whitespace errors
7. No console errors at runtime

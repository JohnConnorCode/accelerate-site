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
5. Peace of mind — "Every call answered. Every follow-up sent."
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

## Pre-Commit Requirements
1. `npx tsc --noEmit` — zero errors
2. `npm run build` — production build succeeds
3. No console errors at runtime

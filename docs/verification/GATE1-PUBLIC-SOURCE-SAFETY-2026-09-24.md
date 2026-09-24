# Gate 1 — Public-source safety disposition (2026-09-24)

Branch: `gate-launch-evidence-20260924` (based on origin/main 02e68f37) (clean tree, no switch/reset).
Commit: `02e68f37 (origin/main; initial measurements taken on 8b39fd17, re-validated here)`.
Scope: Gate 1 only. No history rewrite. No merge. No deploy.

## 1. Automated checks (pass, not sufficient alone)

- `npm run verify:oss`: passed. 1950 tracked files, 15 community files, 7 secret patterns.
- No tracked `.env.local`, `.env`, `*.pem`, `*.p12`, `*.key` in index.
- History search: no commit adding `BEGIN PRIVATE KEY` or `sk-live`. `ISOLATION_PROOF` hits are fixture/test constants, not credentials.
- `.env.example`: neutral placeholders only (`you@yourbusiness.example`). No JWT/secrets.
- Neutral export (`scripts/export-neutral-starter.mjs` to `/tmp/neutral-gate1-check`): 1697 files, source clean, receipt written. `public/` fully omitted. `src/content/team.ts` replaced with empty array. No `John Connor` string in neutral `src/content`. Only placeholder `john@company.com` in form components.

## 2. Tracked-asset dispositions (branded profile retains, neutral excludes)

Per `ASSETS.md`: code is MIT; name/marks, customer/partner material, photography, marketing copy, likenesses are not.

| Asset | Location | Disposition |
|---|---|---|
| Owner portrait + team photos (john.jpg, team/ x4) | `public/images/john.jpg`, `public/images/team/` | REMAIN in branded original deployment (owner's own deployment). EXCLUDED from neutral starter (verified absent). Forks must replace. Founder to confirm depicted persons consented. |
| Industry photography (home-services, law-firms, nonprofits, etc.) | `public/images/*` (120 files total) | REMAIN in branded. EXCLUDED from neutral (verified `public/images/` absent). Founder to confirm owned/licensed. Open item below. |
| Provider logos (calendly, google, hubspot, mailchimp, etc.) | `public/images/logos/` | REMAIN as integration descriptors per ASSETS.md trademark clause. Not endorsement. Neutral excludes. |
| Guide screenshots | `public/images/docs/` | REMAIN in branded. Neutral omits via figure component. |
| Team content, articles by John Connor, work/portfolio, marketing copy | `src/content/team.ts`, `articles/*`, `work.ts`, `verticals.ts`, etc. (155 files) | REMAIN in branded. Neutral replaces with empty/placeholder equivalents (verified). Forks must supply own content. |
| Tenant bootstrap identity | `BOOTSTRAP_*` in `.env.example` | Neutral placeholders only. No production identity in repo. |

## 3. GitHub settings (recorded)

- Visibility: PUBLIC. Default branch: main.
- Protection on main: strict=true, required context `verify`, enforce_admins=true, dismiss_stale_reviews=true, allow_force_pushes=false, allow_deletions=false.
- Required approving reviews: 0. CODEOWNER review: false.
- Disposition: protected main passes for launch baseline. Flag for founder: consider requiring 1 approval before announcement (currently self-merge possible with `verify` green). No change made.

## 4. Open items requiring founder authority

### Item 1 — likeness permission (exact list)
`src/content/team.ts` names 4 living persons with photos in `public/images/team/` and LinkedIn links:
- John Connor (owner) — `john.jpg`
- Matthew Rolnick — `matthew-rolnick.jpg`
- Martin Dabrowski — `martin-dabrowski.jpg`
- Theresa VanderMeer — `theresa-vandermeer.jpg`
Founder to confirm each person's consent to public display, or remove before announcement. Owner's own likeness is assumed consented; the 3 others need explicit confirmation.

### Item 2 — customer/partner/third-party references (exact list)
Work portfolio `src/content/work.ts` names: WORK+SHELTER, Healthcare Real Estate Platform (unnamed client), SuperDebate (own), Sparkblox (own), Thrive Protocol, Green Goods, Northern Trust. Team bios additionally reference employers/clients: Real American Beer, Yaymaker, Groupon, Google, Salesforce, LinkedIn, Meta, Procter & Gamble, Forbes, Northern Trust, Melon/DEPT, Legrand, Thrivent Charitable, Comrade Digital, Greenpill Dev Guild, Uplandme, Thrive Protocol, WORK+SHELTER. Provider logo files in `public/images/logos/` (calendly, google, hubspot, mailchimp, make, openai, quickbooks, slack, stripe, twilio, zapier) are integration descriptors per ASSETS.md, not endorsements.
Founder to confirm: (a) portfolio metric claims (e.g. WORK+SHELTER 80% reduction) are approved for public display; (b) named third parties with case-study-style entries (WORK+SHELTER, Thrive Protocol, Green Goods, Northern Trust, unnamed healthcare client) have permission; (c) industry photography in `public/images/` is owned/licensed. Remove or anonymize anything unconfirmed.

### Item 3 — branch approval policy
Decide 0 vs 1 required reviewers at launch. No change made.

4. No history rewrite performed. If review finds a historical secret, report separately; do not rewrite without explicit founder approval.

## 5. Gate 1 verdict — FULL PASS (2026-09-24, founder sign-off recorded)

Founder decisions (same session):
1. Team likenesses: APPROVED, keep all four.
2. Portfolio claims and named third parties: APPROVED as written.
3. Branch policy: keep 0 required reviewers; `verify` context stays required with strict status + enforce_admins + no force pushes/deletions.

No unresolved credentials or private env in current tree. Neutral fork is credential-free and identity-free.

Next: Gate 2 local prep only (install runbook + neutral QA). Live Supabase/hosting proof deferred per founder instruction.

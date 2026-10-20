# Design roadmap: next passes after the brand system

Owner: design lead (Claude session `accelerate-cc-design-audit`). Date: 2026-10-20.
Branch: `design/brand-system-20261020` (integration candidate; a Codex
integrator commits from this worktree).

This file lists the design work that is **planned and not started**. Each pass
is self-contained: an agent can pick any one up, finish it, verify it and hand
it off without the others. Work them in the listed order unless a ticket says
otherwise.

## Read first

1. `docs/contracts/BRAND-SYSTEM.md` is the design authority. Every pass below
   extends its tokens and primitives. If a pass needs a new color, typeface,
   heading size, appearance or motif, change that contract in the same change.
2. `docs/contracts/MARKETING-POSITIONING-CONTRACT.md` for any public copy.
   Services lead; the Command Center is the proof.
3. `AGENTS.md`, "Outcome acceptance for visual work". Open every screenshot you
   take. Source presence is not visual evidence.

## Standing rules (apply to every pass)

- Signal orange (`--signal`, `--admin-accent`) means only "the system acted".
  Never decorative, never a category color.
- The activity stream (`src/components/ui/ActivityStream.tsx`) is the proof
  device: a hollow mark for people, a filled signal mark for system actions.
- Heading sizes come from `--type-display`, `--type-section`, `--type-title`.
  Nothing exceeds the 68px cap.
- Copy: no "leads", no em dashes, no "not X, Y" constructions, no speed-race
  or "X weeks" claims, no founder personal metrics, no brake language
  ("waits for your yes"); describe graduated autonomy instead.
- Admin code uses `--admin-*` tokens only. Table headers are styled only by
  `.admin-table th`.
- `npm run verify:brand` (inside `verify:guardrails`) enforces the mechanical
  rules. It must pass.

## Verification for every pass

Use a production build, never the dev server, and never rebuild while a server
from the same checkout is running.

```sh
npm run build                        # gated; do not wrap in resources:run
npm run start -- -p 3015             # not `npx next start`
npx tsc --noEmit -p . && npm run lint
npm run verify:guardrails            # includes verify:brand
npm run verify:admin-tokens          # lower a budget when a file reaches zero
node scripts/admin-ai-inventory.mjs --check
npm run test:admin-route-inventory   # after admin edits: --refresh, then prettier
QA_BASE=http://localhost:3015 node scripts/qa-marketing-positioning.mjs        # site passes
PLAYWRIGHT_BASE_URL=http://localhost:3015 node scripts/qa-admin-demo.mjs       # admin passes
PLAYWRIGHT_BASE_URL=http://localhost:3015 node scripts/qa-home-hero-timing.mjs # if the hero or home CSS changes
```

Screenshot every touched route at 1440 and 390 wide, light and dark, and in the
Accelerate and Paper admin modes for admin routes. Use the fictional demo
workspace (`/demo/command-center/<scenario>/<route>`), never real data.

---

## Pass 1. Industry pages carry the activity stream

**Why.** Twenty-one `/industries/*` pages share `VerticalPage.tsx` and none of
them show the proof device. The homepage and Services each show one stream;
each trade should show its own.

**Scope.**

- Add `activity` to each vertical in `src/content/verticals.ts` (or a new
  `src/content/industry-activity.ts` keyed by slug): `{ label, context, events }`
  with the `ActivityEvent` shape from `src/content/home-activity.ts`. Six
  events per trade: one inquiry or job followed from arrival to outcome, with
  `system: true` on the steps the system took. Use fictional names and the
  trade's own nouns (a patient, a matter, a booking, a tenant).
- Render `<ActivityStream {...activity} />` in `VerticalPage.tsx` beside or
  under the hero copy, using the same layout as `.hero-statement-main` on the
  homepage (`src/app/globals.css`).
- Copy for `context` reads "Illustrative · <trade>". Never imply a real client.

**Acceptance.** All 21 pages render a stream with at least two system and two
people events. No page shows signal orange outside the stream. Copy passes
the guards. Layout holds at 390px with no horizontal scroll.

## Pass 2. Delete the rainbow palette and the dead effect components

**Why.** A seven-color "channel" palette survives in dead code and in the
content model, and it contradicts the one-signal rule. Several background
effect components are no longer used anywhere.

**Verified unused on 2026-10-20** (`grep -rl "<Name\b" src` finds no consumer
outside the file itself): `OpsConsole`, `OpsFeed`, `ApprovalQueue`,
`PageHero` (and the `StarField`, `BokehField`, `AmbientOrbs` it alone imports),
and `HeroCanvas` (`src/components/three/HeroCanvas.tsx`).

**Scope.**

- Re-run the grep for each one, then delete the files.
- Delete `src/content/industry-feeds.ts` if nothing imports it after the
  deletions. Remove the `rgb` fields from `src/content/command-center.ts` once no
  reader remains (`grep -rn "\.rgb\b" src`).
- Remove the now-unused legacy aliases in `src/app/globals.css` (`--gold-*`,
  aurora, mesh, glow; 73 matching lines today). Migrate any live consumer to
  `--fg`, `--signal` or `--rule` first. Keep the admin bridge block at the top
  of `src/app/admin-components.css` until Pass 6.
- Drop `three` / `@react-three/*` from `package.json` only if no import remains.

**Acceptance.** The build passes, `verify:brand` passes, and the bundle no
longer ships the removed modules. No visual change on the 8 marketing QA
routes (compare before and after screenshots).

## Pass 3. One button system

**Why.** Three systems coexist: `src/components/ui/Button.tsx` (35 importers),
the `.btn` class (14 files), and `MagneticButton` (3 uses). The magnetic hover
is a template move the brand system retired.

**Scope.**

- Make `.btn` / `.btn-ghost` in `globals.css` the single visual recipe and have
  `Button.tsx` render it (keep its props API so the 35 importers don't change).
- Replace `MagneticButton` uses with `Button` and delete it.
- Remove the remaining glass blur from `.btn-ghost` and `.tag`.

**Acceptance.** Primary, secondary and ghost buttons look identical wherever
they appear on the site. Hero, final CTA and dock booking buttons keep their
`data-booking-cta` attributes and analytics calls.

## Pass 4. Rebuild `/style-guide` from live tokens

**Why.** `src/app/(marketing)/style-guide/page.tsx` still says gold is the
primary accent and documents the retired `display-italic` accent.

**Scope.** Render the real tokens and primitives:

- the type scale (`--type-*`) and the Funnel Display, Funnel Sans and JetBrains
  Mono faces;
- the ink, paper and rule colors, and signal used only inside an example
  `ActivityStream`;
- the buttons from Pass 3, `ActivityStream`, and the homepage labeled flow
  (`HeroArtwork`);
- the four admin modes, with a link to the demo.

Keep the page `noindex`.

**Acceptance.** No reference to gold, italic accents or retired themes remains.
Every swatch reads its value from CSS at runtime, so the page cannot drift.

## Pass 5. Command Center product page in the system's language

**Why.** `/command-center` (`src/components/sections/CommandCenterPage.tsx`) is
the proof page. It should show the real instrument: current product
screenshots and the stream, with signal reserved for system actions.

**Scope.**

- Audit each section against `BRAND-SYSTEM.md` (heading scale, one focal point,
  no decorative color).
- Replace any illustration of the product with real captures from
  `src/content/product-screenshots.ts`. Recapture them with
  `scripts/capture-product-screenshots.ts` against the demo if they are stale.
- Add one `ActivityStream` that shows the system acting across modules (an
  inquiry, an invoice and a follow-up), with modules named as they appear in
  the Command Center navigation.

**Acceptance.** The page passes `qa-marketing-positioning`, uses no color
outside ink, paper and signal, and every product image is a real capture.

## Pass 6. Admin cleanup ratchet

**Why.** The table pass moved about 370 legacy classes onto admin tokens, but
large raw-palette budgets remain, and the marketing-to-admin bridge still exists.

**Scope.**

- Work down the largest `COLOR_BUDGET` entries in
  `scripts/verify-admin-tokens.mjs`: `conversations/page.tsx` (33),
  `contact-imports/page.tsx` (29), `campaigns/page.tsx` (19),
  `analytics/page.tsx` (9). Map status colors to
  `--admin-success` / `--admin-warning` / `--admin-danger` and their `-soft`
  variants, and lower each budget as it falls.
- Replace raw `bg-white/N` and `border-white/N` utilities that aren't behind a
  `dark:` prefix with `--admin-surface-subtle` or `--admin-hover-tint`
  (about 60 today; `grep -rnE "(^|[ \"'])(bg|border)-white/[0-9]+" src/app/admin src/components/admin`).
- Extend the `verify:brand` table-header guard to catch a `className` placed on
  the line after `<th` (multi-line JSX).
- When no shared component rendered inside admin still uses `text-white-*`,
  `border-border-glass` or `--gold-*`, delete the bridge block at the top of
  `src/app/admin-components.css`.

**Acceptance.** The budgets drop, `qa-admin-demo` passes, and Accelerate,
Paper, Night and Operator screenshots of the touched pages show no regression.

## Pass 7. Module identity cards

**Why.** "Plug in any business logic" is the platform claim, but plugged-in
modules don't look like a family. Fifteen manifests live in
`extensions/*.module.json`.

**Scope.** One `ModuleCard` primitive for `/admin/plugins` and
`/admin/integrations`. Every card has the same anatomy: glyph, name, status,
last action as a one-line stream entry (filled signal mark if the system
acted), owner, and autonomy level. Render it from the manifest, so a new
module looks native with no page code.

**Acceptance.** All 15 manifests render with the same anatomy in all four
modes. Adding a fixture manifest in a test renders a correct card with no
other change.

## Pass 8. Smaller admin polish (bundle into one change)

- **Contacts.** Replace the per-row "Open history" buttons with a row that is
  itself clickable (`AdminRecordRow` pattern) and keeps a visible focus state.
- **Pipeline tiles.** `src/app/admin/pipeline/page.tsx` hand-builds its four
  metric tiles. Move them to `StatCard` and add a compact density prop to
  `StatCard`, keeping the mobile truncation. Do the same for the three Clients
  tiles.
- **`qa-workspace-layout.mjs`.** This test is stale against the Work page, and
  was already failing on main before this branch. It expects the old empty
  message and a "Reset filters" button that no longer exists. Rewrite its
  search and empty-state steps for the "My work" default.

## Needs John before anyone acts

- **About "The resume" block.** `src/components/sections/AboutPage.tsx` lists
  founder metrics ("products past a hundred thousand users, a venture round"),
  which conflicts with the no-personal-background rule. Do not change it without
  John's decision.

## Owned elsewhere (do not duplicate)

- **Demo launcher screenshots.** The integrator changed
  `src/app/(marketing)/demo/command-center/page.tsx` and
  `src/content/demo-workflows.ts` to `*-20261020-r2.png` files that don't exist
  yet. Until it generates them, `qa-theme-persistence` reports 404s.

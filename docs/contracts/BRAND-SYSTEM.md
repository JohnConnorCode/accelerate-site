# Brand system contract

One identity covers both surfaces. The public site is the storefront and the
Command Center is the instrument. A visitor who books a strategy session and a
client who opens Today should recognise the same hand.

Read this before changing type, color, theme registries, page heroes, the
homepage Command Center section, or Today. Copy rules live in
`MARKETING-POSITIONING-CONTRACT.md`; admin interaction and motion rules live in
`ADMIN-VISUAL-CONTRACT.md`.

## Type

- Jost sets headings and numerals, restoring the established identity at the
  founder's direction. Funnel Sans sets body and interface text; JetBrains Mono
  sets data, timestamps and labels.
- Files are bundled in `public/fonts` and loaded in `src/app/layout.tsx` as
  `--font-display-face`, `--font-body-face` and `--font-mono-face`.
- No serif and no italic accents in Accelerate surfaces. `.it`,
  `.display-italic` and `.font-editorial` render as the surrounding type. A
  title `<em>` is plain emphasis. Newsreader remains loadable only because a
  tenant may choose it for a custom workspace theme.
- Display tracking stays between `-0.02em` and
  `-0.04em`; tighter values make glyphs collide at large sizes.
- Shared page titles retain the 68px scale. The restored homepage composition
  uses its previous Jost headline: 88px maximum, 74px on the desktop split layout.
  These two existing homepage declarations carry explicit verifier exceptions.

## Heading scale

Every heading on the site uses one of three steps, defined once in
`src/app/globals.css` and shared by `.h1`/`.h2`/`.h3`, the `.display-*`
classes, `src/lib/type-recipes.ts` and the product page modules:

| Step    | Token            | Range      | Use                           |
| ------- | ---------------- | ---------- | ----------------------------- |
| Display | `--type-display` | 40 to 68px | The page title, once per page |
| Section | `--type-section` | 30 to 48px | Each section heading          |
| Title   | `--type-title`   | 20 to 26px | Cards, rows and list groups   |

Shared headings are weight 600; the restored homepage headline retains weight 500. A section heading is never larger than its page
title. Use the classes or the tokens (`text-[length:var(--type-section)]`);
never set a heading size by hand. Stat numerals and logo marks may exceed the
cap with a documented exception.

## Color

Ink and paper carry the system. One accent, signal orange, means one thing:
**the system acted**. An automation ran, delegated work finished, a module is
live, or the operator is here (the active navigation tick).

| Token            | Value                           | Use                                                                                |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| `--signal`       | `#ff5a1f`                       | Dots, ticks, rules, fills. Ink text on it is 6.3:1. Not for text on paper (3.0:1). |
| `--signal-ink`   | `#c2410c` light, `#ff7a45` dark | Text in the signal meaning (5.0:1 on paper, 7.6:1 on ink).                         |
| `--signal-soft`  | 12% signal                      | Quiet backgrounds behind signal content.                                           |
| `--admin-accent` | signal per mode                 | The admin equivalent; `--admin-nav-accent` is the raw fill.                        |
| `--admin-action` | ink (or signal in Operator)     | The person's primary button. Kept separate from the accent.                        |

Never use signal for decoration: headings, background washes, hover glows and
marketing emphasis are not actions the system took. A screen with no system
activity shows no orange.

## Signature motif: the activity stream

Work the system takes on is shown as a stream: a hollow mark while it runs or
waits, a filled signal mark when it finishes, a timestamp, and plain-language
outcome. Today's Automation module, the Activity page and the site's product
proof all use this language. On the site, prove the claim with the real
instrument (product screenshots or the demo), never an illustration of one.

### Homepage hero: the resting brand sculpture

Jost headings and the established time-and-revenue headline retain the site's
identity. The native SVG artwork uses the three extruded logo chevrons, visible
face culling, depth order and a grounded base. One shared hero entrance brings
the composition into view; then it rests. There are no ambient animation loops,
spinning layers, branching workflow diagrams, signals or decorative controls.
The mark remains visible on phones and never captures input or keyboard focus.
Reduced motion and unavailable JavaScript show the complete static composition.
`npm run qa:home-hero-timing` checks the actual resting geometry and pixels,
copy, desktop/phone layouts, keyboard actions and reduced motion. The activity
stream remains product proof below the hero.

## Command Center modes

Built-in appearances are modes of work. Each pair must differ in a
structural token (geometry, density or label face) as well as color; the theme
test enforces this.

| Mode                      | Character                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| Paper (`light`)           | Calm light workspace, light navigation, 12px surfaces, sentence-case labels.                   |
| Night (`dark`)            | The same instrument after dark.                                                                |
| Accelerate (`accelerate`) | The brand instrument: ink rail, 6px geometry, mono uppercase labels.                           |
| Operator (`operator`)     | Dense and keyboard-first: 40px controls, 2px geometry, mono data layer, signal primary action. |

Retired ids (`signal`, `studio`, `frost`, `material`, `mac`, `capy`) map to
their closest mode through `RETIRED_APPEARANCES` in
`src/lib/admin/appearances.ts`, so stored preferences keep working. Workspace
themes remain the place for a tenant's own brand.

## Today

The first screen answers three questions in order: what the business is
running on (the pulse of large numerals), what needs a person (rows with an ink
rail), and what the system is handling (the activity stream with signal
marks). Rows that are clear carry no rail. The only accent on the card is the
system's own work.

## Restraint

One focal point per section. No ambient glows, cursor effects, bracketed
eyebrows, scarcity badges or decorative motion. Purposeful entrance motion
only, removed under reduced motion.

## Enforcement

`npm run verify:brand` (part of `verify:guardrails`, so CI and the pre-commit
hook run it) fails on a serif face outside tenant-chosen fonts, display
tracking tighter than `-0.04em`, text below 10.5px, and signal orange
hard-coded outside the token files, and any heading above the 68px display cap. The micro scale is 10.5px for counts and
badges and 11px for labels. A deliberate exception, such as a logo monogram,
carries `/* brand-system: allow (reason) */` on the line before it.

Shared controls keep a 40px desktop minimum and a 44px touch/phone minimum in
both densities. Public light/dark controls resolve built-in and retired modes
through the same appearance registry; Operator uses the public dark palette.

## Planned work

The next design passes, in order, with scope and acceptance for each, are in
`docs/planning/DESIGN-ROADMAP-2026-10-20.md`. Pick one up from there.

# Admin theme and core polish — September 12, 2026

Task: `admin-theme-professional-polish`. This isolated follow-up starts from the
submitted core commit `7c9ab57b715d26850d52371919ab4608584fd151`; its prior review
record remains intact. No merge or production deployment is included.

## Visible changes

| Before                                                        | After                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Paper's large geometry and repeated action shadows            | Warm paper/cobalt reference with tighter 18px surfaces and 10px controls                                                              |
| Night's near-monochrome palette                               | Graphite surfaces, brass actions and restrained flat elevation                                                                        |
| Signal's purple palette overlapped other presets              | Midnight teal, mint accents, 6px surfaces, 4px controls and monospaced labels                                                         |
| Studio shared most of the same sans-serif expression          | Editorial headings, warm canvas, clay actions and squared 10px surfaces                                                               |
| Frost's lavender gradients overlapped Studio and macOS        | Icy blue layers, translucent surfaces and bounded blur                                                                                |
| Material and macOS used similar light cards and blue controls | Material uses matte tonal surfaces and soft 24/16px geometry; macOS uses silver chrome, system typography and tighter 12/7px geometry |
| Theme-specific component selectors overrode shared recipes    | Preset data owns material, typography, geometry, elevation and timing through the same recipes                                        |
| Today cards bypassed surface expression                       | Today card fill/filter and briefing typography consume core expression tokens                                                         |
| Tiny generic appearance swatches and pointer-first selection  | Miniature palette/geometry previews, readable descriptions and roving keyboard radio navigation                                       |
| Inconsistent focus and disabled/press feedback                | Shared action-colored focus, icon sizing, disabled hover handling and reduced-motion behavior                                         |

The owning files are `src/lib/admin/themes.json`, generated `admin-themes.css`,
`admin-components.css`, `admin-foundations.css`, `TodayWorkspace.module.css` and
`AdminAppearancePicker.tsx`. The design remains one core with data-driven skins.
The public website and authored website content retain their own styles.

## Compatibility

The seven preset IDs, comfortable/compact density, saved layouts and portable
version-1 custom-theme schema are preserved. `compileAdminTheme` explicitly resets
all expression tokens so custom themes cannot inherit another preset's glass,
label font or title font. Existing palette validation and serialization boundaries
remain in place. No API, database or business service changed.

The appearance control supports arrows, Home/End and Escape with focus return.
Theme selection applies immediately and keeps existing demo/device persistence.
Reduced motion resolves shared interaction timing to zero and removes control and
navigation movement. Touch/control minimums remain those of the core.

## Verification method

The existing repository Playwright runner captures representative core routes,
the website editor, 56 preview combinations (seven themes, two densities, four
widths), and all seven themes on actual Today desktop/mobile screens. It records
computed identities and requires Material/macOS to differ in font, surface
radius, control radius and elevation. Fourteen focused axe audits check contrast,
labels and button names; these are not a full WCAG conformance claim.

The appearance picker is exercised through its real controls, including keyboard
selection and Escape. Screenshots wait for short transitions to settle. Production
CI independently builds/typechecks and runs the established business journeys.

Local browser startup was refused by the resource gate at 1.2 GiB free disk;
its 5 GiB requirement was retained. The manual `admin_design_only` CI input runs
focused visual evidence remotely. Default CI retains its required checks/build
aggregate; the updated workflow contract exercises all 16 dependency outcomes.

## Findings and recovery

The first focused run, 34704445173, found a borderline Material danger-action
contrast ratio on its tonal background. The semantic danger color was strengthened.
Snapshots now wait for theme transitions to settle before auditing. Inspected
initial Studio, Material and macOS images confirm different typography, shape,
surface treatment and elevation.

A lease expired during sustained work. The narrowly scoped operator recovery and
reopen events record founder delegation, preserve the retained worker and restore
the normal worker claim. No reviewer or deployment rights were granted to the
worker. Verification reports do not assert production delivery.

## Release content

Workspace settings explain the seven identities and keyboard controls. The
contributor guide describes expression-token ownership and portable resets.
Changelog and Command Center descriptions match the implemented appearances.
The documentation index is regenerated where its source metadata changes.

The second focused run, 34707314988, completed all 56 preview captures, 14 focused
contrast audits and 14 actual-workspace captures. It then found an ambiguous test
locator: the appearance dialog contains separate selected theme and density
radios. The keyboard assertion now scopes to the named Admin appearance radio
group. This correction changes QA only, not product behavior.

Run 34707608379 passed the theme/picker portion, then reached the shared 3 GiB
process-group memory ceiling while opening the cross-tab density check. The
focused workflow now runs core-route verification and the identity/keyboard
matrix in separate sequential compiler processes. This releases route compilation
memory between stages without increasing the resource limit or bypassing checks.

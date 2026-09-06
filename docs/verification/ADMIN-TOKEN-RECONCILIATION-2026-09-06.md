# Admin semantic-color reconciliation

CI detected new raw palette utilities beyond the existing color budget. These
changes use the existing light/dark theme tokens; the budget was not raised.
The existing categorical priority colors on the Feature Board are preserved.

## State colors and controls

| Before                                                                                    | After                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `admin/branding/page.tsx`: raw red error border                                           | `--admin-danger` border at the existing opacity               |
| `admin/invoicing/page.tsx`: raw red error border and fill                                 | `--admin-danger` border and `--admin-danger-soft` fill        |
| `admin/plugins/page.tsx`: raw red error border and fill                                   | `--admin-danger` border and `--admin-danger-soft` fill        |
| `TaskWorkflowWorkspace.tsx`: raw red error border                                         | `--admin-danger` border at the existing opacity               |
| `work-board/WorkAgents.tsx`: raw amber warning border                                     | `--admin-warning` border at the existing opacity              |
| `work-board/WorkControls.tsx`: blue focus ring                                            | `--admin-accent` focus ring                                   |
| `work-board/WorkControls.tsx`: separate light/dark amber blocker text                     | Theme-aware `--admin-warning` text                            |
| `work-board/WorkViews.tsx`: blue focus, selected border and fill                          | `--admin-accent` focus/border and `--admin-accent-soft` fill  |
| `admin/features/page.tsx`: raw rose destructive action text and hover fill                | `--admin-danger` text and `--admin-danger-soft` hover fill    |
| `admin/identity-review/page.tsx`: emerald completion icon and selected border             | `--admin-success` icon and border                             |
| `admin/identity-review/page.tsx`: amber warning badge border, fill and light/dark text    | `--admin-warning` border/text and `--admin-warning-soft` fill |
| `admin/identity-review/page.tsx`: blue information badge border, fill and light/dark text | `--admin-accent` border/text and `--admin-accent-soft` fill   |
| `admin/identity-review/page.tsx`: emerald primary action with white text                  | Paired `--admin-action` and `--admin-action-ink` tokens       |

Paths starting with `admin/` are under `src/app/`; component paths are under
`src/components/admin/`. Verification: `npm run verify:admin-tokens` passed with
42 defined tokens and the unchanged color budget. The production-build browser
journeys exercise available fictional demo flows; authenticated identity-review
and live board operation still require their controlled workspace journeys.

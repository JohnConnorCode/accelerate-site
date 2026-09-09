# Installation website editor implementation evidence

Live work: `site-studio-installation-editor`. Base: `f09d5ba79b43fcb35e84880f0e8c5130133c52bf`.

This is an implementation checkpoint, not feature acceptance or release approval.
No production migration or deployment has been performed for this change.

The founder narrowed the immediate work to editing this installation's current
website from admin, with independent fork ownership. Custom-domain automation,
multi-site hosting, broad Architect installation and unrelated executor work are
outside this ticket. Existing design/theme work remains in its owner's checkout.

## Evidence collected

- The checked inventory covers all 45 marketing route files and distinguishes
  content pages, collection entries, and source-owned application routes.
- Portable website validation covers page/collection identity and URL collisions,
  private-field rejection, safe content links, bounded rich text, asset references
  and typed theme values. The focused document test passes.
- Native PostgreSQL migration/upgrade suite passes with the new website tables
  and atomic command function. The website proof exercises concurrent publication
  and save, exact replay, changed-payload request-key refusal, draft/public revision
  separation, previous-publication rollback, unpublish without history loss,
  anonymous/authenticated SQL denial, tenant isolation, immutable receipts and
  revisions, audit-failure rollback, and module disable.
- Migration catalog completeness and transaction-wrapper checks pass.
- Full TypeScript verification initially paused at the disk gate, then passed
  after disk space recovered. The gate was not bypassed.
- Public selection tests prove that private drafts and foreign revisions never
  become public, storage failure is explicit, and unpublish does not resurrect
  bundled branding. Installation-owner and module guards are exercised.
- Six original homepage sections now accept schema-validated editable props:
  hero, introductory statement, marquee, process, firm and FAQ. Their existing
  markup and behavior remain the default. Focused SSR tests pass for literal
  rich text, registered templates, original defaults and unsafe-link rejection.
  Desktop/mobile browser checks also pass for these unchanged default sections,
  including keyboard FAQ controls, reduced motion, overflow and console errors.
  Screenshots were opened and reviewed; complete editor visual acceptance remains
  required after the admin UI is implemented.
- The updated native PostgreSQL suite passes with the publication-history marker.
- Draft PR #67 carries work in progress. Its first CI run found a fixture's
  unchecked array access and generated inventory/stat drift; those were corrected
  in the subsequent checkpoint. Only an exact later passing run can establish
  full CI verification.

## Homepage review

| Before                                                                                              | After                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero, introductory statement, marquee, process, firm and FAQ content lived inside their components. | The same components accept registered, validated content props with the original bundled defaults; normal default SSR matched the published baseline.                                                                            |
| Reduced-motion visitors briefly saw an empty highlighted phrase while the scramble waited.          | CSS exposes the complete static phrase before hydration, and reduced-motion mode skips the scramble timer without changing hydration markup. The browser check now asserts the visible phrase and reduced-motion console errors. |

The final local application build passed using one static-page worker within the
existing resource limits. Full lint, the focused Site Studio suite, native database
upgrade/replay tests and the strengthened browser checks passed. The earlier
symlink, memory-gate and reduced-motion hydration failures were retained in local
logs and resolved; they are not passing evidence. The application-code build was
followed only by release-copy/evidence updates. CI must verify the exact committed
candidate before this draft can advance.

## Work still required for acceptance

The website storage and renderer primitives are not yet connected to the public
site or admin UI. The actual page/content migration, complete visual editor,
assets and collection workflows, secure preview, public revision selection,
AI/MCP approval parity, fictional demo, user/fork guides with worked examples,
visual browser review, complete CI, reviewed handoff, and release evidence remain
required. Existing user documentation correctly describes the published draft-only
Site Studio until those behaviors are implemented and verified together.

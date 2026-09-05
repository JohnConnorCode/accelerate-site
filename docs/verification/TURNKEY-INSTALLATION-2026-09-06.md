# Installation reliability verification

Scope: `release-migration-ledger` and the credential-free exploration path. Base commit: `5965b879e0a4123d9ef3da51f3ae38e40609ecfe`.

## Changes

- Complete ordered catalog: 63 required SQL files, one explicitly excluded historical compatibility shim. Missing and unclassified files fail validation.
- Transactional migration receipts, source checksums, competing-runner exclusion, safe resume, and refusal to replay an existing untracked database.
- Missing `btree_gin` prerequisite and bootstrap workspace display-name correction. Schema verification no longer requires the deliberately removed fixed pipeline-stage constraint.
- Database tools load the documented environment, check common Supabase target mismatches, and require encrypted hosted connections by default.
- Unconfigured roadmap builds and renders without database credentials; configured outages get an explicit unavailable state. Public suggestion writes remain unavailable without configuration.
- Login and password-update pages do not poll authenticated workspace or priority endpoints.
- Hosted Supabase setup instructions replace stale migration counts and unsafe replay advice. No Docker installer or Docker dependency was added. The experimental local installer was removed at the owner's direction.

## Passing checks

- `npm run test:migration-ledger`: native PostgreSQL, disposable databases, populated upgrade, replay, checksum drift, unknown history, transactional rollback and resume, untracked database refusal, ledger privileges, competing runners and retry.
- `npm run test:public-roadmap`: no-credentials reads and write refusal, configured card filtering, configured outage handling.
- `node scripts/qa-turnkey.mjs` against the credential-free production server: desktop and mobile roadmap, keyboard navigation into the shared demo, setup documentation, admin setup boundary, reduced motion, no horizontal overflow or browser errors. Screenshots were opened and inspected.
- Earlier isolated Supabase testing applied the complete schema and verified owner membership. A populated 37-migration database containing two tenants with the same contact email upgraded successfully. The post-upgrade contact/configuration preservation assertions and browser sign-in were not completed before the owner stopped container-based testing. These are not claimed as passing acceptance items.

## Remaining release gates

The broader migration ticket remains incomplete until a controlled hosted Supabase upgrade proves the two-tenant record/configuration preservation assertions, and the hosted first-owner sign-in journey passes. Existing databases without a ledger require reviewed baseline adoption; there is no automatic adoption or destructive reset path. No production schema changes, deployment, or provider sends were performed for this change.

The native PostgreSQL regression tests and credential-free build do not establish WordPress-level installation parity or third-party plugin ecosystem readiness.

# Keep a customized fork through core updates

Use the complete repository fork when you want to receive upstream source
updates. Normal installation and presentation choices use saved configuration;
editing shared runtime implementation is reserved for custom development.

## Where customization belongs

| Your change                                                         | Authoritative location                                                                                                            | What an upstream source merge does                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Public bootstrap name, site origin, neutral/branded choice          | Private deployment environment: `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DISTRIBUTION_PROFILE`           | Retains your environment. Use the same public values at build and runtime. Neutral is the fresh-install default. |
| Workspace identity, invoice branding and admin appearance           | Saved tenant configuration through Branding and appearance controls                                                               | Keeps saved configuration; compare-and-swap and brand validation still govern edits.                             |
| Website identity, theme, navigation, pages, drafts and publications | Site Studio's website documents, revision history and publication pointers                                                        | Keeps saved documents. New bundled seeds do not replace an owner publication.                                    |
| Uploaded asset bytes                                                | Your storage provider; document assets reference those objects                                                                    | Keeps references. Back up the actual objects separately.                                                         |
| Contacts, tasks, receipts and provider bindings                     | Existing tenant-scoped database services                                                                                          | Does not migrate the database. Review ordered migrations separately.                                             |
| Provider credentials and encryption keys                            | Private environment and encrypted tenant connections                                                                              | Does not rotate, reconnect or enable providers. Retain the encryption keyring with recovery configuration.       |
| Enabled modules and plugin settings                                 | Saved workspace configuration                                                                                                     | Keeps your explicit settings. Inspect newly added modules' defaults before adopting a release.                   |
| Fork hosting identity                                               | Ignored `deployment-target.local.json`, hosting environment and `.vercel/project.json`                                            | Keeps the local target. Preflight still verifies exact authenticated ownership and linking.                      |
| Custom module source                                                | Uniquely named `extensions/<id>.module.json`, `plugins/<id>/`, owned page/service files and permitted `public/site-assets/` files | Merges distinct paths. Shared source or generated-output conflicts need review.                                  |

The local hosting file takes precedence over the tracked maintainer target.
Malformed, oversized or symlinked local targets stop preflight. Generate it with
`scripts/generate-fork-hosting.mjs` as shown in [neutral distribution](NEUTRAL-DISTRIBUTION.md).
The generator refuses an existing file rather than overwriting the reviewed
target. To retarget an installation, review and edit your local file, relink the
exact intended project, and rerun `npm run deploy:check`.

## Inspect and verify a full Git fork update

1. Retain the current commit, configuration and a recovery copy of the database,
   uploaded objects and encryption keys. Test recovery using
   [backup and recovery](BACKUP-RECOVERY.md).
2. Choose an upstream revision and fetch it explicitly from the trusted upstream
   repository. Confirm the intended release, commit and release notes. The local
   check below does not discover or fetch releases.
3. Run `npm run fork:check -- --ref <fetched-upstream-commit-or-tag>`. It inspects
   ancestry, working tree status, legacy configuration and a Git merge simulation.
   It does not change HEAD, the index or working files. Git may add temporary
   merge objects to its object database.
4. Resolve the reported state before proceeding. `mergeable` means a clean source
   merge only. `working-tree-changes` requires retaining unfinished work.
   `owner-review` names conflicts or legacy configuration; inspect those in a
   separate branch. Custom Git merge drivers require separate review and are not
   executed by the simulation. `unavailable` requires correcting local Git access
   or using Git 2.38+ with complete history.
5. In your own update branch, perform a normal Git merge of that exact upstream
   revision. Inspect the diff. Resolve generated extension files by retaining the
   reviewed manifests and running `npm run build:extensions`, then verify the
   resulting registrations. Never resolve all conflicts by choosing one side.
6. Review runtime and migration requirements, then run the release's required
   checks and a production build. Exercise sign-in, retained draft/public pages,
   branding, asset access, records, permissions and plugin behavior in an isolated
   installation before a separately authorized deployment.

Registration and a clean source merge do not activate or migrate a plugin.
Use its existing operator guide and the `plugin-install-lifecycle` contract for
that work. The Git check never starts jobs, sends messages or enables modules.
The existing migration ledger and backup/recovery services remain authoritative.

## Adopt older source configuration edits

Keep the original branch and its private configuration until the new installation
has passed verification. Review the changed fields in `src/config/tenant.ts`;
do not execute unreviewed configuration code to extract them.

Set public bootstrap identity and profile in the private deployment environment.
Use the existing installer for owner/workspace setup, then save workspace Branding
and website Identity/Theme through their existing controls. Review AI instructions,
pipeline labels and other advanced tenant settings through the existing tenant
configuration contract; the ordinary branding form does not edit every field.
Preserve stable playbook keys and source tags because they participate in record
identity and replay. Keep existing provider bindings, membership and revocation.

Copy the reviewed public hosting fields from your legacy target into
`deployment-target.local.json`, inspect its exact IDs and domain, then verify the
existing linked project. Do not enable the original-hosting acknowledgement in a
fork. Once saved configuration is verified, reconcile only your legacy source
edits in the update branch against upstream. Retain the original branch as
recovery evidence; no reset or wholesale replacement is required.

Custom changes to core services remain source development. Review their semantics
and conflicts explicitly; moving ordinary settings out of source does not promise
that arbitrary core modifications will merge without conflicts.

## Adopt a reduced export with independent history

The optional neutral exporter copies reviewed source and omits protected media,
private configuration and Git history. An independent `git init` has no common
ancestor with upstream, so `fork:check` returns `manual-adoption` when both histories
are available. If the target revision is not fetched, it returns
`invalid-reference` first.

Keep the export intact and create a new complete repository fork in a different
directory. Configure its own environment and hosting. Import supported website
exports into Site Studio as unpublished drafts, inspect their assets and form
bindings, and publish after owner review. Restore business records and actual
uploaded objects through the existing recovery path into an isolated target;
retain required encryption configuration. Review and copy uniquely named custom
extensions, regenerate registrations and exercise them through their existing
lifecycle. Retire the old installation only after the new one is verified.

Do not force unrelated histories together or copy every old file over the new
runtime. A website export is content, not a database, credential, publication or
permission backup.

## What the automated fixture proves

`npm run test:fork-upgrade-preservation` performs a real Git merge from published
commit `59167a013d6085e8ff94abc30009a085e93a404a` to
`c2b090e51ec74c0433d368adde9c150686686b2f` in disposable customized forks. It checks
retained private fixture bytes, draft/public document parsing, branding, navigation,
asset bytes, linked records, revoked provider bindings, disabled optional modules,
both profile choices, exact local hosting and custom module regeneration. Negative
cases exercise source conflicts, unfinished files, legacy edits, invalid local
hosting and independent history. Receipts contain no private fixture values.

These are local source-preservation fixtures using canonical document and branding
contracts. They do not establish database migration, hosted Auth, Storage-object
restore, real provider behavior or a first-time human installation outcome. Record
those separate results before a stable release.

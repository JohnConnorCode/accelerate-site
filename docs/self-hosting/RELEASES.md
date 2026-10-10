# Core releases and fork upgrades

Use `npm run release:check`, or the installation owner's **Setup → Check stable releases**, before planning an update. These are read-only checks. They do not update source, migrate a database or deploy an application.

## What identifies a release

`release-policy.json` declares the trusted upstream, minimum npm/PostgreSQL versions, extension contract version and required CI workflows. Every stable GitHub release carries `accelerate-release.json` with:

- its stable tag, exact source commit and reviewed notes;
- minimum Node, npm and PostgreSQL versions;
- the ordered migration filenames and source checksums, plus their catalog digest;
- the extension host contract version and manifest schema digest;
- an explicit list of supported source release tags.

Discovery reads only this upstream's public GitHub API and release assets. It verifies the asset's SHA-256 digest and resolves lightweight or annotated tags to the exact metadata commit. Redirects are restricted to GitHub's release-asset hosts. No installation records, provider keys or GitHub token are sent. Requests and response sizes are bounded; rate limits, missing metadata, moved tags, malformed payloads and incomplete feeds return a timestamped unavailable result.

Stable is the supported channel. Drafts, prereleases and unknown tag formats are never offered as updates. A supported path requires explicit source-version support, preserved migration order/checksums, the same extension contract and an adequate running Node version. A skipped version is allowed only when the target explicitly supports the installed version. Otherwise discovery searches ascending bridge versions and returns their order, or an incompatible result. npm/PostgreSQL requirements are displayed in metadata and must be verified in the target environment before applying the path. Local plugins and fork changes still need review.

The extension contract number must change for a breaking host contract. Its schema digest records the exact declaration for review; a changed digest alone does not infer a breaking change. Existing migration checksums remain immutable. A release whose declared source cannot satisfy these compatibility checks cannot pass preparation.

## Adopt the first version in an existing fork

Main-branch commits and the package version are not stable release identities. New clones retain `core-release.json` as `null` until an actual published stable tag is adopted. Fetch the exact upstream tag without replacing an existing local tag, inspect your fork's history, then run:

```sh
npm run release:adopt -- --tag v0.1.0
```

Use an actually published tag. Adoption verifies upstream metadata and requires its commit to be an ancestor of your checkout. It writes the public core metadata to `core-release.json`; commit that file with your fork and rebuild. This preserves the core commit separately from the customized fork commit in the build artifact. It does not certify the migration ledger, reset credentials or overwrite a different recorded core baseline.

For later upgrades, preserve the recorded baseline while reviewing and integrating the supported source path. After database/runtime/plugin recovery checks and source integration are complete, update the recorded metadata to the exact verified target through that reviewed upgrade. A guided updater is separate work; this release contract supplies discovery and compatibility, not an automatic upgrade mechanism.

## Prepare a release without publishing

After integration, package.json must contain the intended stable version and its explicit Node minimum. Put reviewed notes under `docs/verification/releases/<name>.md`. Notes should link the exact acceptance and recovery evidence and identify material changes, required migration/runtime steps, supported source versions and limitations.

Run full **CI** and **Connected fork** on the exact main source commit. A PR merge commit, partial workflow, skipped required job or a successful different commit does not qualify. Connected fork may need a manual run because its PR trigger is path-scoped.

Run the **Core release** workflow from main with the exact commit, stable version, supported source tags and notes path. Leave **publish** off. It verifies clean main ancestry, metadata, immutable migration compatibility, each declared source tag, and the exact-source required workflow/job receipts. The artifact contains metadata and CI run IDs. The initial release has an empty source-version list; existing installations adopt it explicitly.

Configure the GitHub `core-release` environment to require the release owner's review before enabling publication. Review the [launch acceptance](../contributing/LAUNCH-ACCEPTANCE.md) receipts, security/license/asset checks and recovery result. Only a separately authorized release uses **publish**. That job repeats CI validation, creates the exact source tag without forcing an existing tag and publishes the validated metadata and notes. It does not deploy production. A failed publication after tag creation leaves an unpublished tag; inspect it before retrying. Never move a published tag or replace its metadata silently.

Implementing this workflow publishes no release. `v0.1.0` remains gated on the actual launch acceptance; a green demo or this contract's fixture tests cannot substitute for hosted or independent installation evidence.

GitHub API contracts: [releases](https://docs.github.com/en/rest/releases/releases), [Git references](https://docs.github.com/en/rest/git/refs), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

# v0.1.0 release candidate

Command Center brings customer history, sales follow-up, client delivery, billing
and marketing into one workspace. Teams can see the customer's history, assign
the next sales action, track delivery work and review outstanding invoices.
Builders can adapt the same records, permissions and business services for their
own reports, workflows and Apps.

These are preparation notes for the first stable release. The repository is
public, but `v0.1.0` has not been published. The release metadata binds the exact
source commit, migration checksums, extension contract and CI receipts. The
package version alone does not establish a supported release.

## What is included

- A product hub and six business-area pages explain the job, saved result,
  working example, setup and extension path. The comparison guide covers ten
  competing products using their official descriptions.
- Documentation has business and builder paths. The customer guide follows
  existing fictional records; the builder exercise changes Pipeline Watch's
  quiet-deal threshold from seven days to three and verifies the result.
- Seven admin navigation groups connect Daily work, Customers & sales,
  Delivery, Billing, Marketing, Apps & AI and Workspace. AI discovery starts
  with editable business requests. Exact-change reviews preserve the reading
  position while the chat resizes.
- The full repository defaults to the neutral product profile. It retains the
  customer workspace, website editor, AI/MCP, Apps and shared business services.
  The optional reduced starter has separate export and browser evidence.
- The integrated dependency patches address the high-severity sharp and
  source-map-js advisories. Existing cleanup and verification improvements are
  retained.
- First-release preparation accepts the empty supported-version list required
  by the workflow. The CLI regression also verifies missing values, empty
  required inputs, invalid source tags and unreviewed source are refused.

[Product acceptance and screenshots](../command-center-overhaul/README.md) and
[positioning research](../../planning/COMMAND-CENTER-POSITIONING-2026-10-10.md)
describe the implemented behavior and its limits.

## Installation and compatibility

Use Node.js 22.16 or later, npm 10 or later and PostgreSQL 15 or later. Follow
[Self-hosting](../../self-hosting/SELF-HOSTING.md) for a new empty Supabase
project, owner setup, Auth configuration, migrations and the first saved result.
The fictional demo runs without provider credentials.

This is the first stable-version candidate, so its supported source-version list
is empty. Existing main-based forks require an explicit, reviewed adoption after
an actual stable tag is published. See
[Core releases and fork upgrades](../../self-hosting/RELEASES.md).

The Command Center communication overhaul introduces no database migrations or
extension-host contract break. The first installation still applies the complete
ordered catalog recorded in the release metadata. Existing installations retain
their migration ledger and need a backed-up, tested upgrade path. Provider
accounts, identity and hosting belong to the installation owner.

## Verification and remaining acceptance

The integration receipt establishes which source was reviewed and merged. Stable
preparation additionally requires complete **CI** and **Connected fork** runs on
the exact main source commit. The existing release verifier rejects a different
commit, a PR merge reference or an incomplete required job.

Automated evidence covers the production build, source and business contracts,
desktop/mobile documentation and admin journeys, reduced motion, keyboard use,
neutral and full-product forks, isolated connected Auth and native recovery.
Business-provider effects use fictional data or controlled adapters. Native
connected proof is distinct from hosted provider acceptance.

Complete [Launch acceptance](../../contributing/LAUNCH-ACCEPTANCE.md) before a
stable production-ready tag. The recorded gates include a fresh hosted
installation, real password recovery, grounded AI and reviewed learning, tenant
denial, plugin execution, bounded load, hosted backup/restore and the installation
trial. A missing receipt remains unverified. For this candidate, John's October
10 instruction authorizes an agent-owned clean installation in a new isolated
folder instead of waiting for Marcin. The trial is in progress. Record its actual
services and results; local test-service proof does not establish hosted
acceptance.

The October 10 security review found no open critical/high Dependabot alerts or
open secret-scanning alerts. Production `npm audit` reports zero critical/high
findings and five moderately affected packages. GitHub retains one unpatched
moderate runtime advisory: `sprintf-js`, `GHSA-hp3w-g68c-fv3c`. Refresh the
dependency and source scans for the final release source and retain their
disposition with the release receipt.

The [upstream advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) concerns
unbounded precision in attacker-controlled format strings. The scoped dependency
review found the affected CLI helpers outside the current application callers;
parsing checked-in MDX and extracting the DOCX fixture did not load them. This
observation does not resolve the advisory or establish hosted exploitability.

## Product and publication boundaries

General-purpose in-app App generation remains planned. The implemented builder
path uses repository changes and an external coding agent. Each provider workflow
requires its own configuration and permissions. The demo's earlier collection
invoice and a newly created sample invoice are separate records.

The portable Site Studio product content is an unpublished review draft. Rebase it
on the current owner's export and preview it before separate publication. Deploy
the reviewed source before publishing links to the new feature routes.

Code and documentation use the MIT license with the existing
[asset boundaries](../../../ASSETS.md). Fork owners replace protected branding,
photography and third-party material or obtain their own permission.

The **Core release** preparation uses `publish=false`. Publication requires the
completed acceptance receipt, release-owner review and separate authorization.
Canonical production deployment and Site Studio publication are separate actions.

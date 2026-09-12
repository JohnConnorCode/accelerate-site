# Neutral fork distribution

This repository can run two profiles. They share the same admin, runtime, plugins and approval services.

| Profile             | When                                 | Identity                                                                                                   |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `branded` (default) | The original Accelerate installation | Marketing site, `deployment-target.json`, and tenant bootstrap stay Accelerate                             |
| `neutral`           | A fork or a new business             | Entry pages, authentication chrome, AI identity, metadata and email footer come from the configured tenant |

Set `NEXT_PUBLIC_DISTRIBUTION_PROFILE=neutral` in the fork environment. Leave it unset to preserve the branded installation.

## Hosting

Copy `deployment-target.example.json` to `deployment-target.json` and fill IDs for a Vercel project you control:

```bash
node scripts/generate-fork-hosting.mjs --project prj_your_id --team team_your_id --name my-revenue-os --url https://your-business.example
```

The generator refuses the original Accelerate project, team and canonical URL. `vercel.json` keeps automatic Git deployments off until you enable them in your project. Cron routes require `CRON_SECRET` and a scheduler you own; remove or configure scheduled triggers explicitly for your hosting account. `npm run deploy:check` in the neutral profile also refuses original IDs.

This does not deploy the original production account.

## Export the starter

From a clean source checkout, run:

```bash
node scripts/export-neutral-starter.mjs --output /absolute/new/harbor-workspace
cd /absolute/new/harbor-workspace
git init
git add .
git commit -m "Start neutral workspace"
npm ci
npm run build
npm run start
```

The output must be a new directory outside the source checkout. Existing files are never overwritten. `neutral-starter-receipt.json` lists every copied path and its content hash, so a reviewer can identify the exact exported source. The exporter copies tracked source selected by `distribution/inclusion-manifest.json` and its explicit replacement files. It refuses path escapes and symlinks and omits private environment, repository metadata and original hosting IDs.

The starter contains a fictional Harbor Operations identity in `src/config/tenant.ts`. Replace that configuration with your business name, domain, contact details and AI instructions before connecting real services. The exported profile defaults to neutral, including after a fresh Git clone. Start your own Git history with your configured author identity; the normal build uses that commit as its release identifier. The original checkout remains branded by default.

All original public assets, article collections, team biographies and work examples are omitted. Business-owned content collections start empty; editable page sections use neutral placeholders. The shared runtime, fictional admin scenarios, extension code and product documentation remain. Supply assets you have rights to publish and update your own page content before public release.

A fresh starter has no hosting target and no enabled scheduler. Generate a target for your own account with the command above when ready to configure hosting. No provider credentials or recipient data are copied.

## Verification and recovery

CI installs and builds the actual exported directory, then runs `scripts/qa-turnkey.mjs --neutral` at desktop and mobile widths. It records configured entry metadata, the disconnected setup boundary, populated fictional pipeline, filtered empty state and a saved demo branding change after reload. Every external browser request is rejected and recorded; no live authentication provider, recipient or deployment is exercised. Separate native checks render the actual AI prompt, email wrapper and plan document with the starter identity.

If export fails, inspect the named manifest path and create a new output directory after correcting the source. If installation or build fails, retain the export receipt and exact error; never copy private environment from the original checkout to make the build pass.

## Stable extensions vs sample screens

Stable interfaces: module manifests in `extensions/`, integration adapters, registered AI tools, the isolate host, the approval queue and the audit ledger. See [Extending](../contributing/EXTENDING.md).

Sample business applications: fictional demo workspaces, marketing case-study pages, and plugin examples under `plugins/` that demonstrate a pattern. Keep those as examples; put your business records in your own workspace.

To take upstream upgrades, keep a fork on published `main`, replace only tenant identity, hosting IDs and excluded media, and avoid editing `src/lib/revenue-os/` unless you are contributing the change back.

# Neutral fork distribution

This is one codebase and one complete product. The profiles switch bundled agency presentation, not product capabilities. They share the same admin, editor, AI/MCP, runtime, plugins and approval services. Our own installation uses this same choice. The business website is an entry point into the shared operating system, not a separate agency-only application.

| Profile             | When                                  | Identity                                                                                                   |
| ------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `branded`           | Bundled agency presentation is wanted | Explicit opt-in to the bundled agency site, subject to asset rights                                        |
| `neutral` (default) | Agency presentation is off            | Entry pages, authentication chrome, AI identity, metadata and email footer come from the configured tenant |

The full repository defaults to neutral. Set `NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded` to enable the bundled agency presentation, or `neutral` to disable it, including on our own installation. Use the same value in build and runtime environments, then rebuild and deploy. This is a deployment configuration switch, not a live admin toggle. No production environment is changed automatically. Profile selection never deletes drafts or publication history, and owner-published pages remain authoritative.

Set `NEXT_PUBLIC_BUSINESS_NAME` and `NEXT_PUBLIC_SITE_URL`, connect your own workspace through the installation guide, and open **Site Studio → Edit installation website**. Identity, Theme, page sections, navigation, preview and publication all use the same website document. **Website tools** contains the setup sequence and links to connection checks and ChatGPT setup.

In neutral mode, bundled agency routes return an owner-published page at that address or 404. The public product homepage starts at `/`; `/command-center` also shows the starter before first publication. Private drafts never replace the public homepage. Unpublishing does not restore agency content. Product docs, demos and form share links remain application routes. The `/site-pages/` prefix is reserved for routing and cannot be assigned to an authored page.

Protected bundled images and downloads under `/images/`, `/work/` and `/resources/` are not delivered in neutral mode, including through the image optimizer. Add permitted images under `public/site-assets/` or your own HTTPS origin. Agency assets remain in Git and retain their existing license restrictions. The optional export below physically omits them; it is no longer required to start a neutral full-product fork.

To connect a form, publish it in Form Builder and use **Connect a form → Load published forms** inside a document page's sections. Only this workspace's published forms can be bound. The website supports eight distinct form bindings. Responses use the existing review and intake workflow; editor previews cannot submit. Archived forms, disabled modules and unavailable connections show an unavailable state without losing the rest of the page. Reconnect or remove an unavailable form before saving or republishing. Imported bindings must be replaced with forms published in the destination workspace.

## Hosting

Copy `deployment-target.example.json` to `deployment-target.json` and fill IDs for a Vercel project you control:

```bash
node scripts/generate-fork-hosting.mjs --project prj_your_id --team team_your_id --name my-revenue-os --url https://your-business.example
```

The generator refuses the original Accelerate project, team and canonical URL. `vercel.json` keeps automatic Git deployments off until you enable them in your project. Cron routes require `CRON_SECRET` and a scheduler you own; remove or configure scheduled triggers explicitly for your hosting account. `npm run deploy:check` refuses original IDs by default in either profile. The original maintainer follows the separate hosting acknowledgement and authenticated target verification in [Deployment](../../DEPLOY.md); turning agency presentation on never grants hosting access.

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

The optional starter contains a fictional Harbor Operations identity in `src/config/tenant.ts`. Replace that configuration with your business name, domain, contact details and AI instructions before connecting real services. Both the full repository and the exported starter default to neutral. Start your own Git history with your configured author identity; the normal build uses that commit as its release identifier.

All original public assets, article collections, team biographies and work examples are omitted. Business-owned content collections start empty; editable page sections use neutral placeholders. The shared runtime, fictional admin scenarios, extension code and product documentation remain. The manifest excludes all `src/content/` by default; its reviewed exceptions are the documentation directory, runtime intake taxonomy and provider integration names. Other content enters only through explicit neutral replacement files, so adding a future marketing module cannot silently include it. Original guide screenshots under `/images/docs/` are omitted by the existing figure component in the neutral profile, so retained text guides do not request missing protected images. Add your own permitted images under a new path when customizing the guides. Supply assets you have rights to publish and update your own page content before public release.

A fresh starter has no hosting target, inherited CI workflow or scheduled hosting triggers. Configure CI and scheduler jobs explicitly in accounts you control. Generate a target for your own account with the command above when ready to configure hosting. No provider credentials or recipient data are copied. The only environment template included is an explicitly reviewed neutral `.env.example`, with empty provider values and fictional business settings for the documented setup flow.

## Verification and recovery

CI installs and builds the actual exported directory, then runs `scripts/qa-turnkey.mjs --neutral` at desktop and mobile widths. It records configured entry metadata, the disconnected setup boundary, populated fictional pipeline, filtered empty state and a saved demo branding change after reload. Every external browser request is rejected and recorded; no live authentication provider, recipient or deployment is exercised. Separate native checks render the actual AI prompt, email wrapper and plan document with the starter identity.

If export fails, inspect the named manifest path and create a new output directory after correcting the source. If installation or build fails, retain the export receipt and exact error; never copy private environment from the original checkout to make the build pass.

## Stable extensions vs sample screens

Stable interfaces: module manifests in `extensions/`, integration adapters, registered AI tools, the isolate host, the approval queue and the audit ledger. See [Extending](../contributing/EXTENDING.md).

Sample business applications: fictional demo workspaces, marketing case-study pages, and plugin examples under `plugins/` that demonstrate a pattern. Keep those as examples; put your business records in your own workspace.

To take upstream upgrades, keep a fork on published `main`, replace only tenant identity, hosting IDs and excluded media, and avoid editing `src/lib/revenue-os/` unless you are contributing the change back.

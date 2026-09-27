# Isolated connected fork trial (2026-09-26)

This is partial local evidence, not a hosted installation or release acceptance. The application source was `bb67b6b8ae1953b7b341ddea5b90b51876be32d8` (PR #152 on main); the install-guide correction in PR #153 was reviewed separately. No original Accelerate database, Auth project, customer data, or hosting project was used.

An isolated Supabase CLI 2.72.7 stack ran PostgreSQL 17, Auth, REST, Storage, Kong and local mail capture. The guided `npm run setup` plan targeted only `127.0.0.1`, listed 117 pending migrations and a fictional owner. `npm run setup -- --apply --project local` passed all eight steps: database preflight, owner lookup and creation, database identity match, migration ledger, workspace read, membership read and membership verification. The resulting workspace was Harbor Workspace with `founder@local.test` as its fictional owner. A real local Supabase email/password API sign-in returned a session, and a Chromium browser sign-in reached `/t/accelerate/admin/today`.

The browser was opened at `localhost:3000`; Next.js development mode blocked hot-reload resources when opened at `127.0.0.1:3000`. The documented `npm run dev` origin worked. The fresh Contacts directory loaded but offered no direct contact creation. List import expected OpenRouter, which was intentionally disconnected. The missing direct action is addressed in the follow-up first-contact fix; contact/task persistence and sign-out were not completed in this trial.

The Supabase images exhausted the shared Mac's disk safety margin; the repository resource gate stopped the development server at 0.9 GiB free. The disposable local containers, volumes, images, build output and test credentials were removed. Disk recovered to about 12 GiB free. Do not count this as hosted Auth/Storage, backup, browser-write, independent-human, or production evidence.

## Separate fictional-demo check

On the first-contact candidate rebased onto PR #153, the credential-free Northline Roofing demo accepted a new fictional contact. The new row remained after reload. Its record hub accepted a related follow-up and showed the task after another reload. The Add contact dialog opened at 1440 px and 390 px; the mobile viewport had no horizontal overflow. The demo runtime now persists the contact in session storage and rejects duplicate email, rather than returning a successful response without a saved row. This checks the fictional demo only; the connected write path was exercised separately below.

## Separate connected CI continuation (2026-09-27)

[PR #156's isolated connected run](https://github.com/JohnConnorCode/accelerate-site/actions/runs/36288584600) passed on head `8a9081c588c9c6226b4f815b588eb4670be0b674` with PR merge commit `cfdf0c8d5677621ce2033e31e6bd711548879dc8`. It used a fresh GitHub runner, Supabase CLI 2.72.7, PostgreSQL 17, local Auth and REST, and no original Accelerate project or customer data. The actual setup applied 117 migrations and passed owner creation, database identity match, workspace read and membership verification for fictional Harbor Workspace.

Chromium then signed the owner in on desktop and mobile, created separate fictional contacts and contact-linked follow-ups, reloaded each record to verify persistence, rejected duplicate email, and confirmed sign-out protected the workspace. The mobile contact dialog had no horizontal overflow. The run retained a commit-specific JSON receipt and desktop/mobile screenshots; those screenshots were opened and reviewed. Credentials and the disposable database were not retained as artifacts.

This closes the earlier connected contact/task browser gap for a local Supabase installation. It is not hosted Supabase evidence, a human installation trial, password-reset proof, backup/restore proof, connected AI proof or open-source launch acceptance.

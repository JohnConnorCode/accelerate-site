# Workspace password recovery verification

This change extends the existing account-recovery routes and the isolated
connected-fork journey. It does not create another identity service, change
production Auth settings or send mail to real recipients.

## Reproduced gaps and corrections

Published main `c2b090e51ec74c0433d368adde9c150686686b2f` hides the expired-link
alert behind the sign-in form. Recovery now opens the reset form immediately.
Password replacement catches thrown requests, restores usable controls and
maps provider failures to safe guidance. An expired session offers a direct link
to request a new email; choosing the existing password has distinct guidance.

The callback validates public configuration before constructing an Auth client,
limits each provider request to ten seconds, preserves verifier-cookie changes
on failure, and marks session redirects private and non-cacheable. PKCE,
token-hash recovery and invitation activation retain provider verification.
Invitations still require a valid tenant identity, verified user and canonical
membership activation. Unsafe redirect destinations remain refused.

The reset-request adapter now treats membership-read failures as unavailable,
rather than claiming that an email was sent. Provider exceptions produce a
non-cacheable 503 and a static diagnostic without tokens or raw provider details.
The existing three-request rate limit, unknown-email response and optional sender
remain in place. Account recovery is a human identity operation, not an AI tool.

## Scoped verification

`npm run test:password-recovery` bundles the actual callback and reset-request
routes with controlled Auth, membership, limiter and sender adapters. It covers
configuration, PKCE, token hashes, unsafe redirects, invitations, cleared cookies,
expired links, rate limits, malformed input, unknown-email privacy, unavailable
membership, provider failures and both email-delivery paths. These fixtures do
not establish native delivery or password replacement.

`node scripts/qa-password-recovery.mjs` uses the built pages at desktop and mobile
widths. It checks visible expired-link guidance, keyboard actions, missing-session
recovery, disabled loading controls, provider-detail redaction, retry, different
password guidance, horizontal overflow and uncaught errors. Provider requests are
intercepted. Its fictional cookie is not an authenticated-session proof.

The Connected fork workflow uses Supabase CLI 2.72.7, PostgreSQL 17, real local
Auth/REST and Mailpit on a disposable GitHub runner. Its existing native
installation, contact/task persistence and sign-out checks remain. The extension
requests a real recovery email through Command Center, reads only the fictional
owner's locally captured email, follows its exact allowlisted callback, replaces
the password, rejects the old password and signs in with the new password. It
rechecks the saved contact/task and refuses reuse of the original email link at
both viewport widths. The script refuses a different project, API origin or
configured external sender. Mail bodies, recovery URLs, session cookies and
passwords are not written to artifacts.

The workflow's commit-specific JSON receipts and screenshots establish the
actual result. A green controlled test or this guide alone does not satisfy
native acceptance. The proof covers a local Supabase service on a runner. Hosted
SMTP delivery, a hosted installation, Marcin's independent installation,
connected AI/learning and database/object restoration remain separate launch
requirements. No release, merge or deployment is implied.

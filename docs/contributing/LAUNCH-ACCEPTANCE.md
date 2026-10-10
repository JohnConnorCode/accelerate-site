# Technical self-hoster launch acceptance

Use the live launch card for status. This procedure records evidence for core CRM/tasks, grounded AI, reviewed learning and the existing plugin system. Retain separate receipts for browser checks, the clean-install trial and hosted acceptance.

## Clean-install instructions

Start from the release candidate's clean clone and README in a new isolated folder. Use fictional records in a test installation and follow the published instructions, recording any help needed.

For the October 10 candidate, John has directed the maintainer to perform an agent-owned clean installation rather than depend on Marcin's trial. Record the actual Auth, REST, Storage and mail services and whether they are local or hosted. This changes who performs the installation trial; it does not establish hosted AI, provider delivery, load or recovery acceptance.

Record the commit, operating system, Node/PostgreSQL versions, hosting/database plan, start time and provider provisioning time. Never record credentials, real customer records or raw provider responses.

1. Start the demo, then follow the installation guide to connect the test workspace.
2. Sign in, sign out, sign back in, and recover access using the actual password-reset path and a tester-controlled address.
3. Create a fictional contact and related task. Reload, complete the task, reload again, and find the activity record.
4. Write down every unclear instruction, unexpected failure and point where help was required. Record elapsed active setup time separately from provider provisioning.

Targets are five minutes to the demo and thirty minutes from available provider resources to a persisted result. A missed target needs a concrete cause and correction, not a fabricated pass. Retain the kit, actual trial results and unresolved fixes. Do not contact testers without authorization.

## Connected AI, knowledge and learning

Use fictional documents and a currently available, tool-capable free model. Disable paid fallback and verify the selected model's current pricing before calling it. Record the model/provider identity, resolved configuration and usage receipt without recording its key.

- Upload a fictional policy document. Ask a question whose answer is in that document and inspect the returned citation/revision.
- Prepare a task change, inspect its exact proposal, approve it, and confirm one persisted action and receipt. Replay the request and confirm no duplicate.
- Submit a correction, inspect its proposal, approve it, and verify a subsequent interaction retrieves the approved guidance. Reject another proposal; verify it never becomes active guidance. Supersede the first rule and verify the old revision is no longer applied.
- Repeat source and guidance reads as another tenant and a revoked member. Both must be denied.
- Simulate provider unavailability and revoked credentials. The interface must retain work and explain recovery without claiming an action succeeded.

A provider quota or unavailable free model is an explicit incomplete result. Do not substitute mocked model responses for a hosted AI pass.

## Plugin and extension task

Enable Meeting Prep, add a fictional confirmed meeting within the next 48 hours, run the report, and inspect its source link and receipt. A cancelled meeting must be excluded. Disable the plugin and verify both UI and AI/MCP execution refuse it.

Meeting Prep's report is a deterministic calendar report, not document-based attendee research. Test document retrieval through the shared knowledge/AI path above. Follow the existing plugin guide to change the report's displayed wording in a temporary fork, rebuild the extension manifest, and verify the report without editing core services. Retain the small diff as extension evidence; do not ship the trial customization.

## Browser, load and recovery

Run the existing desktop/mobile, keyboard, reduced-motion and navigation-performance suites. Review screenshots for setup, saved task, source citation, approval, learning and plugin states. Keep existing timing budgets.

In the isolated connected installation, exercise ten concurrent users for ten minutes with bounded reads and fictional task writes. Provider inference and real sends stay disabled during this load exercise. Record latency, error rate, memory observations and persisted write counts; investigate unhandled errors, duplicate writes or leaked records before acceptance.

Execute [Backup and recovery](../self-hosting/BACKUP-RECOVERY.md), including uploaded-file checks. Record measured recovery time and the recovered data point. Retain separate native and hosted proof labels.

## Release decision

A production-ready release requires all supported-scope acceptance receipts, independent review, required CI, no unresolved critical/high security findings and the recorded installation trial. Otherwise retain a release candidate and list the exact missing proof. Keep unsafe draft PRs and unrelated unfinished work out of the candidate.

The release receipt records the exact commit, included PRs, migration version, dependency/security results, artifact scan, hosted journeys, the installation trial and recovery outcome. Tag `v0.1.0` only after these gates pass. Canonical deployment remains separately authorized and requires a deployment ID, READY state, canonical alias and post-deployment smoke evidence.

## Record the clean-install result

The maintainer supplies the reviewed 40-character source commit and any verified
starter archive. Use that exact source throughout the trial. For a repository
trial, create a separate clean checkout before following the README:

```sh
git clone https://github.com/JohnConnorCode/accelerate-site.git command-center-install-trial
cd command-center-install-trial
git checkout --detach REPLACE_WITH_REVIEWED_COMMIT
git rev-parse HEAD
```

Replace the placeholder with the maintainer's full commit before running the
checkout command. A starter archive additionally needs its filename, SHA-256,
bound source commit and export receipt recorded. An archive or automated pass
does not establish completion of the clean-install trial.

Copy this record into the trial receipt. Replace each `Not recorded` value with
an observation and an evidence location. Use `Passed`, `Failed` or `Not tested`
for outcomes. Record failures and help received even when a later retry succeeds.
Keep credentials, customer information and raw provider responses out of it.

| Field                                                             | Recorded result |
| ----------------------------------------------------------------- | --------------- |
| Installer or agent; trial date                                    | Not recorded    |
| Reviewed source commit; actual `git rev-parse HEAD`               | Not recorded    |
| Archive identity and checksum, if used                            | Not recorded    |
| OS; Node, npm and PostgreSQL versions                             | Not recorded    |
| Isolated hosting/database setup; fictional workspace              | Not recorded    |
| Auth, REST, Storage and mail services; local or hosted            | Not recorded    |
| Demo result and active minutes to first use                       | Not recorded    |
| Provider provisioning time, separate from active setup            | Not recorded    |
| Connected setup result and active minutes to saved result         | Not recorded    |
| Sign in, sign out and sign back in                                | Not recorded    |
| Reset email received; changed password; existing records retained | Not recorded    |
| Fictional contact saved and retained after reload                 | Not recorded    |
| Related task saved, completed, retained and found in Activity     | Not recorded    |
| Unclear steps, failures, retries and help received                | Not recorded    |
| Evidence locations and installer conclusion                       | Not recorded    |
| Maintainer review and unresolved fixes                            | Not recorded    |

This record covers the installation trial. Keep hosted AI, learning,
tenant denial, plugin, load and recovery receipts separate, with their actual
environment and source commit. The release decision above requires the complete
set of supported-scope evidence.

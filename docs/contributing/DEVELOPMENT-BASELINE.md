# Development baseline

Use `agent/developer-baseline` for the control checkout described in
[Start development](DEVELOPER-START.md). Before assigning work, the maintainer
records the exact verified commit with the handoff. A branch name alone is not
an immutable approval.

This branch combines these committed inputs:

| Input                  | Commit                                     | Purpose                                                               |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Developer handoff      | `79f14747e719bca8f8973ab30e3145c637a9abfa` | Work packets, scoped CLI, doctor, backlog quality and execution tests |
| Documentation          | `626c86cb94946a4d8646a641d4eff3ff28375157` | 55-page docs set, rewritten task guides and browser verification      |
| Accepted runtime fixes | `8485caa77c2ef5c8b1be8c9c36e95e9a8276758e` | Reviewed plugin isolation, host contracts and cold-start headroom     |

Newer plugin approval/grant work after the last listed runtime commit was not
included: it had not completed its acceptance workflow at integration time.
Existing worktrees and live claims were preserved.

The combined CI retains all input checks: developer lifecycle, migrations,
PostgreSQL, plugin security and cold starts, work-board journeys, Collections,
docs and public navigation. Source statistics are recalculated for the combined
files and scripts. Verification must pass for this combined tree before the
maintainer hands its commit to another developer.

## First assignment

A ticket still starts at its own approved base. Do not rewrite every ticket to
the newest branch: older in-progress implementations and dependency receipts may
require an earlier base. Run board controls from this control checkout and make
the code change in the ticket's isolated worktree.

Provide the worker's board URL and individual scoped access, an isolated test
workspace and a named reviewer before expecting shared pickup. The developer
checks these with `npm run dev:doctor -- --board`. Keep missing prerequisites on
the live card; do not silently substitute production credentials or a local mock.

Submission is review work. A maintainer accepts the evidence independently and
records integration separately. The combined code's passing CI does not mark
feature cards shipped or prove that team access has been configured.

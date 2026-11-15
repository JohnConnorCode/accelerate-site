# Command Board

Command Board shows each business in a workspace as a desk: a circle for the
business, its phases below it, and stations that summarize live work. Opening a
phase unspools its segments and stations on the shared canvas, the same way the
MLIVM prototype desk does. A station counts the open records that match it,
names the next one, and lights up when something needs a person.

## Business outcome

An owner sees where every part of the business stands without opening five
screens. A property operator sees acquisitions, renovation milestones, rent and
repairs; a service business sees new inquiries, quotes, visits, invoices and
reviews. Selecting a station opens its matching records in their own workspace,
where the existing permissions and approvals apply.

## How it works

- **Boards are configuration.** Each business is one board document stored in
  `command_board_definitions`, scoped to the workspace by `tenant_id` and
  readable only by its members. A document holds the business name, its mode,
  up to six phases, segments, stations and side nodes such as Conversations.
- **Modes are data.** Service Mode and Real Estate Mode are templates in
  `src/lib/revenue-os/command-board-modes.ts`. Installing a mode copies its
  template into the workspace's own board, which can then change. A new mode is
  a new template, not new board code.
- **Station status is never stored.** Each request reads the record sources the
  stations name (tasks, opportunities, conversations, approvals, collections
  and people) through their owning services and summarizes them with
  `summarizeStation` in `command-board-summary.ts`. A station matches records
  whose title contains its keywords; with no keywords it shows every open
  record from its source.
- **The canvas is shared.** The board renders through the shared canvas view in
  `src/components/canvas`, so keyboard navigation, touch, reduced motion and
  workspace appearances behave as they do on Today.

## Reads, writes and what leaves the workspace

| Operation                | Path                                                           | Effect                                                                                                           |
| ------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Read the board           | `GET /api/admin/board`, `get_command_board`                    | Reads board documents and summarizes source records. Nothing leaves the workspace.                               |
| Install a mode           | `POST /api/admin/board/install`                                | Saves a mode template as a new board. Installing the same mode again changes nothing.                            |
| Save a board             | `POST /api/admin/board`                                        | Saves a whole document at the expected revision through `save_command_board`, with a receipt and an audit entry. |
| Propose a change with AI | `preview_command_board_change`, `propose_command_board_change` | Stages the exact before-and-after for an administrator to approve.                                               |

Saving requires a workspace administrator. A stale revision is rejected, and
retrying the same request replays its original receipt instead of saving twice.
Command Board sends no messages and calls no external provider.

## Approvals and AI

The assistant can read the board and prepare a change. A change is staged in
the approval queue with its exact preview; it runs only after a person approves
it, and approval rechecks the module, workspace and board revision. Skills named
on a station show as available only when a registered tool can run them in the
workspace; until then the station shows that the skill is not set up.

## Worked example (fictional)

Open the MLIVM workspace in the [Command Center demo](/demo/command-center). The
desk shows two businesses. MLIVM LLC runs Real Estate Mode: open **Execute**,
then **2A Projects**, and the **Milestones** station shows the open renovation
tasks with the next install date. HI LAWN LLC runs Service Mode: open
**Account & Equipment Management** and **Invoice Chaser** shows the overdue
balances from Collections. Selecting a station lists its records; each link
opens the record where it can be changed. Demo data stays in the browser.

## Settings, cost and disabling

There are no plugin settings. Reading the board makes no model call; the
composer hands questions to the workspace AI, which uses the workspace's own
model and budget. Disable Command Board in **Plugins** to hide it and refuse its
API and AI tools, including changes already waiting for approval. Board
documents and receipts are kept and return when the App is enabled again.

## Recovery

If a stored document no longer validates, the board reports which business needs
recovery and preserves the stored definition. If a source read fails, the
affected stations say their sources are unavailable rather than showing zero.

## Verification

`npm run test:command-board` covers the contract, both mode templates, the
summaries, the canvas projection and the disabled-module path. The migration is
registered in `scripts/lib/migration-manifest.mjs` and checked by
`npm run verify:migrations`. `npm run qa:command-board` exercises the board in
the fictional demo at desktop and phone widths.

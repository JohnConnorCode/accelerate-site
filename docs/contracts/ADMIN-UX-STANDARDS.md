# Shared admin interaction standards

The navigation registry and shared admin/Kanban components own these defaults.
Core pages, extensions and fictional demos must inherit them.

## Boards and spacing

- Keep the board inside the page gutters. Only the board scrolls horizontally;
  the page must never widen to a column's intrinsic content size.
- Async wrappers and grid children must have `min-width: 0`. Shared content stacks
  preserve their 20–24px region gaps through loading, refresh and errors.
- Columns have 16px gaps, a maximum width of 340px, and a visible next-column edge
  on small screens. Do not add route-specific negative margins or snap rules.
- Manual scrolling stays under user control. No mandatory snapping, auto-centering
  or selection-driven ancestor scrolling. Column buttons explicitly navigate the
  board at every width; their selected state may reveal only the corresponding chip.
- Named board scroll regions register with the existing navigation runtime. Its
  bounded per-history-entry numeric cache restores their horizontal offsets when
  returning from a card detail; no board owns separate history or storage.
- Dialog focus restoration uses `preventScroll`. Drag edge scrolling is allowed
  only during a drag; clicking a card must not start a drag.
- Controls have visible focus and at least 40px targets. Column navigation uses
  ordinary pressed buttons, not incomplete ARIA tabs. Reduced motion uses immediate
  scroll changes. The scroll region remains keyboard-focusable.
- Board, list, empty, error and filtered views must explain available actions and
  preserve lifecycle/permission rules. Visual changes cannot grant work permissions.

## Navigation and language

- `src/lib/admin/navigation.ts` owns destination names. Sidebar, search, mobile,
  root headings and document titles must agree. Use `adminPageName` when changing
  a root heading; record details may retain their specific record title.
- Name the object or task: Email Templates, Email Sequences, Content Calendar,
  Workspaces and Setup. Avoid internal execution language such as Delivery Runs.
- Daily work is the operating queue. Sales contains prospects and proposals.
  Marketing groups templates, campaigns, sequences, content and subscribers.
  Client work contains customers and bookings. Insights & AI explains results.
  Administration configures the platform. Lead sources contains intake channels.
- Keep stable URLs, module IDs, saved navigation keys and extension group IDs.
  Display labels can improve without migrating business identifiers.
- Descriptions explain what users can see or do. Avoid source filenames, runtime
  terminology, vague synonyms and claims that are not visible in the interface.

## Records, rows and details

- Every collection has one primary record opener. Use a real link when the
  destination is a route and a button when the record opens a local detail pane.
  The title, supporting content and unused row space use that same opener.
- Keep secondary controls outside the opener. Selection, switches, menus,
  completion, approval and drag handles must not also open the record. Use an
  overflow menu for infrequent actions instead of repeating Open, View and
  Inspect buttons in one row.
- Use responsive list-detail composition for record browsing. Large layouts keep
  the list and selected detail visible together; compact layouts replace the list
  with the detail and provide a labelled Back control. Detail selection is
  navigable state, so direct links and browser history remain truthful.
- Use dialogs for focused edits, confirmations and short review steps. Read-only
  record context and complex editors belong in a detail pane or route. All
  overlays use `AdminDialog` so Escape, focus containment, labelled titles,
  scroll lock and focus restoration stay consistent.
- Static text must not look actionable. If a message says “Set next action,” it
  must be an actual control; otherwise say “No next action.”
- Rows and controls expose visible focus, keyboard activation and at least the
  shared 44px control floor. Coarse-pointer layouts preserve the same target
  floor and never rely on hover to reveal the only opener.

## Verification

Run the shared admin navigation and mobile journeys against an isolated local
fictional demo. They check direct and cached navigation, delayed reads, keyboard
selection, responsive gutters, reduced motion, and page names. Open the captured
screenshots before handoff. Extend the relevant journey whenever a new board or
navigation consumer is added. Never substitute source-string assertions for
measured browser geometry and interaction evidence.

/**
 * The single authority for docs structure, ordering, and section card
 * metadata. MDX files hold only prose; everything structural lives here so
 * a missing page fails the verifier instead of silently vanishing.
 *
 * Convention: every section directory collapses to its first page, which
 * must be that section's overview. The loader resolves a bare section slug
 * to it, so section landings need no separate route.
 */
export const DOCS_MANIFEST_CONTRACT = "docs-manifest.v1";

export interface DocsPageEntry {
  /** Full slug parts, e.g. ["command-center", "overview"]. */
  slug: string[];
  title: string;
  description: string;
}

export interface DocsSection {
  id: string;
  title: string;
  description: string;
  pages: DocsPageEntry[];
}

export const docsManifest: DocsSection[] = [
  {
    id: "start",
    title: "Start",
    description:
      "The words these guides use, then one inquiry from a connected workspace through to a recorded result.",
    pages: [
      {
        slug: ["start", "overview"],
        title: "Workspace, record, work, approval, and receipt",
        description:
          "The five terms every other page uses, taken from the screens and services that already ship.",
      },
      {
        slug: ["start", "first-value"],
        title: "Your first result",
        description:
          "Install a workspace, capture one controlled lead, complete the follow-up task, and read the recorded result.",
      },
    ],
  },
  {
    id: "command-center",
    title: "Command Center",
    description: "The daily operator screens: Today, Pipeline, Inbox, Setup Center, and Activity.",
    pages: [
      {
        slug: ["command-center", "overview"],
        title: "The Command Center",
        description:
          "Where ranked work, records, approvals, and audit history live after you sign in at /admin.",
      },
    ],
  },
  {
    id: "follow-up",
    title: "Follow-up",
    description: "How a captured inquiry becomes a dated next action and a completable task.",
    pages: [
      {
        slug: ["follow-up", "overview"],
        title: "Follow up on an inquiry",
        description:
          "Find the next action on the opportunity, complete or snooze the Today task, and confirm the activity receipt.",
      },
    ],
  },
  {
    id: "self-hosting",
    title: "Self-hosting",
    description:
      "Explore the fictional demo with no credentials, then connect a workspace you control.",
    pages: [
      {
        slug: ["self-hosting", "overview"],
        title: "Install a connected workspace",
        description:
          "Clone the repository, apply the ordered migrations, sign in, and recover when a provider or membership step is missing.",
      },
    ],
  },
];

/** Every page in manifest order. Drives static params, pager, and sidebar. */
export function flattenDocsPages(): DocsPageEntry[] {
  return docsManifest.flatMap((section) => section.pages);
}

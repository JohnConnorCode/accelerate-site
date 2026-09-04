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
    description: "How every engagement begins: your business first, then the smallest solution that solves the problem.",
    pages: [
      {
        slug: ["start", "overview"],
        title: "Start with your business",
        description: "We find where AI and automation can free up time or increase revenue before anyone builds anything.",
      },
    ],
  },
  {
    id: "command-center",
    title: "Command Center",
    description: "One shared operating layer for the businesses that need it — and how to tell whether you do.",
    pages: [
      {
        slug: ["command-center", "overview"],
        title: "The Command Center",
        description: "What the Command Center is, what it is not, and when a smaller solution wins.",
      },
    ],
  },
  {
    id: "follow-up",
    title: "Follow-up",
    description: "The discipline that decides most inquiries: respond first, follow through, and let nothing wait.",
    pages: [
      {
        slug: ["follow-up", "overview"],
        title: "Never lose an inquiry",
        description: "Response time, steady follow-up, and a clear next step on every page.",
      },
    ],
  },
];

/** Every page in manifest order. Drives static params, pager, and sidebar. */
export function flattenDocsPages(): DocsPageEntry[] {
  return docsManifest.flatMap((section) => section.pages);
}

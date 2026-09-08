import type { ChangelogEntry } from "@/lib/types";

export const changelogEntries: ChangelogEntry[] = [
  {
    id: "workflow-guides-with-examples",
    slug: "workflow-guides-with-examples",
    title: "Follow worked examples for the new workspace workflows",
    description:
      "The public guides now walk through tagging and draft enrollment, campaign copying, won-to-delivery handoff, Drive indexing, and private Site Studio drafts. Each example explains its saved result and recovery. Feature descriptions and FAQ clarify that bulk changes have individual outcomes, successful changes remain saved, and suppression is not automatically reversed.",
    id: "release-feature-schema-verification",
    slug: "release-feature-schema-verification",
    title: "Check the database requirements of newly integrated workflows",
    description:
      "Setup verification now checks draft version and checksum fields, Drive indexing state, campaign-copy receipts, delivery revisions, and the protected operations used by bulk and handoff actions. Missing requirements point to their owning migrations. A previous successful check must match the new schema contract before setup is considered ready.",
    category: "fix",
    publishedAt: "2026-09-08",
  },
  {
    id: "admin-appearance-and-kanban-polish",
    slug: "admin-appearance-and-kanban-polish",
    title: "Workspace themes and Kanban share a more consistent interface",
    description:
      "Admin surfaces, controls and dialogs now follow the selected appearance, with improved dark-theme contrast and shorter regional loading transitions. Branding adds a theme preview, palette and geometry controls, portable import/export and governed AI proposals. Kanban uses readable swipeable columns, mouse, touch and keyboard dragging, clear insertion feedback and saved-position recovery.",

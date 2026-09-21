"use client";

import Link from "@/components/admin/AdminLink";

export interface CanonicalSourceLinkModel {
  contact_id?: string | null;
  opportunity_id?: string | null;
  stage?: string | null;
  linked_by?: "source" | "identity" | "email" | null;
}

export function CanonicalSourceLink({
  link,
  schemaReady = true,
}: {
  link?: CanonicalSourceLinkModel | null;
  schemaReady?: boolean;
}) {
  if (schemaReady === false) {
    return <span className="admin-copy text-xs">Canonical schema unavailable</span>;
  }
  if (link?.opportunity_id) {
    return (
      <Link
        href={`/admin/pipeline?opportunity=${encodeURIComponent(link.opportunity_id)}`}
        className="text-xs font-semibold text-[var(--admin-ink)] underline decoration-[var(--admin-border)] underline-offset-4"
      >
        Pipeline{link.stage ? ` · ${link.stage}` : ""}
      </Link>
    );
  }
  if (link?.contact_id) {
    return (
      <span className="admin-copy text-xs">
        Canonical contact linked{link.linked_by ? ` via ${link.linked_by}` : ""}
      </span>
    );
  }
  return <span className="admin-copy text-xs">No canonical match</span>;
}

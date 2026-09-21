"use client";

import type { SourceFieldDisposition } from "@/lib/revenue-os/retained-source-dispositions";

export function SourceToolDispositions({
  schemaReady,
  dispositions,
}: {
  schemaReady?: boolean;
  dispositions?: SourceFieldDisposition[];
}) {
  const retained = (dispositions ?? []).filter((item) => item.owner !== "canonical");
  return (
    <p className="admin-copy mt-4 text-xs">
      {schemaReady === false
        ? "Canonical links could not be loaded; source rows are still shown."
        : "Canonical links come from the compatibility adapter. "}
      {retained.length
        ? `Source-owned or unresolved fields: ${retained.map((item) => item.field).join(", ")}.`
        : null}
    </p>
  );
}

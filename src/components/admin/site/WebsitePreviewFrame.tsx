"use client";
import { useState } from "react";
import { useAdminDemo } from "@/components/admin/AdminDemoBoundary";
import Link from "@/components/admin/AdminLink";
import { websiteButtonClass } from "./WebsiteFields";

/** A real browsing viewport keeps public page styles and media queries separate
 * from the surrounding admin appearance. Only the saved owner-authorized draft
 * is loaded by the frame; its URL contains no content or reusable secret. */
export function WebsitePreviewFrame({ pageId }: { pageId?: string }) {
  const demo = useAdminDemo();
  const [width, setWidth] = useState("100%");
  const query = new URLSearchParams();
  if (pageId) query.set("page", pageId);
  if (demo) query.set("scenario", demo.scenarioId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link className={websiteButtonClass} href="/admin/site/website">
          Back to website editor
        </Link>
        {[
          ["Desktop", "100%"],
          ["Tablet", "768px"],
          ["Mobile", "390px"],
        ].map(([label, value]) => (
          <button
            key={label}
            type="button"
            className={websiteButtonClass}
            aria-pressed={width === value}
            onClick={() => setWidth(value!)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--admin-muted)]">
        This preview shows saved page content. Publishing and the website header and footer are
        still being built.
      </p>
      <iframe
        title="Saved website preview"
        src={`/site-preview?${query}`}
        className="mx-auto block h-[75vh] min-h-[480px] max-w-full border-0 outline outline-1 outline-[var(--admin-border)]"
        style={{ width }}
      />
    </div>
  );
}

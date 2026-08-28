import { LoadingSkeleton } from "@/components/admin/LoadingSkeleton";
import { PageHeader } from "@/components/admin/PageHeader";

type LoadingVariant = "page" | "table" | "board" | "detail" | "form";

interface AdminPageLoadingProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  variant?: LoadingVariant;
  rows?: number;
}

/**
 * A destination-shaped client-data fallback. Page identity is real content and
 * renders immediately; only the data-bearing region remains provisional.
 */
export function AdminPageLoading({
  title,
  subtitle,
  eyebrow,
  variant = "table",
  rows,
}: AdminPageLoadingProps) {
  return (
    <div className="space-y-6 pb-10" aria-busy="true" aria-label={`Loading ${title}`}>
      <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} />
      <div className="admin-async-region" data-admin-async-state="loading">
        <LoadingSkeleton variant={variant} rows={rows} />
      </div>
    </div>
  );
}

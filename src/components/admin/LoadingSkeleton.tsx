import { cn } from "@/lib/utils";

function SkeletonBar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("admin-skeleton-shape block", className)} />;
}

interface LoadingSkeletonProps {
  variant?: "table" | "cards" | "page" | "today" | "board" | "detail" | "form";
  rows?: number;
  count?: number;
  metrics?: 0 | 3 | 4;
  controls?: "compact" | "filters";
  cardSize?: "compact" | "detailed";
}

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-[var(--admin-border)]" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex min-h-[68px] items-center gap-4 px-5 py-4 sm:px-6" key={index}>
          <SkeletonBar className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <SkeletonBar className="h-3 w-[min(15rem,58%)]" />
            <SkeletonBar className="mt-2.5 h-2.5 w-[min(26rem,82%)]" />
          </div>
          <SkeletonBar className="hidden h-8 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}

function Metrics({ count = 4 }: { count?: number }) {
  return (
    <section
      className={cn("grid gap-3", count === 3 ? "grid-cols-3" : "grid-cols-2 xl:grid-cols-4")}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="admin-skeleton-surface min-h-32 p-5" key={index}>
          <SkeletonBar className="h-2.5 w-24" />
          <SkeletonBar className="mt-5 h-8 w-28" />
          <SkeletonBar className="mt-3 h-2.5 w-32" />
        </div>
      ))}
    </section>
  );
}

function LoadingSkeletonContent({
  variant = "table",
  rows: rowsProp,
  count,
  metrics = 0,
  controls = "compact",
  cardSize = "compact",
}: LoadingSkeletonProps) {
  const rows = rowsProp ?? count ?? 5;
  if (variant === "cards") return <Metrics count={Math.min(4, Math.max(1, count ?? 4))} />;
  if (variant === "today")
    return (
      <div className="space-y-6" aria-hidden="true">
        <div className="flex gap-3">
          <SkeletonBar className="h-11 w-20" />
          <SkeletonBar className="h-11 w-24" />
          <SkeletonBar className="h-11 w-24" />
        </div>
        {[2, 4].map((count, index) => (
          <section key={index}>
            <SkeletonBar className="mb-3 h-4 w-28" />
            <div className="admin-skeleton-surface overflow-hidden">
              <Rows count={count} />
            </div>
          </section>
        ))}
      </div>
    );
  if (variant === "page")
    return (
      <div className="space-y-4">
        <Metrics />
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="admin-skeleton-surface overflow-hidden">
            <Rows count={rows} />
          </div>
          <div className="admin-skeleton-surface overflow-hidden">
            <Rows count={3} />
          </div>
        </section>
      </div>
    );
  if (variant === "board")
    return (
      <div className="space-y-4" aria-hidden="true">
        {metrics > 0 && <Metrics count={metrics} />}
        {controls === "filters" ? (
          <div className="admin-skeleton-surface space-y-5 p-5">
            <SkeletonBar className="h-3 w-24" />
            <div className="flex gap-3">
              <SkeletonBar className="h-10 w-20" />
              <SkeletonBar className="h-10 w-32" />
              <SkeletonBar className="h-10 w-24" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SkeletonBar className="h-11 w-72" />
              <SkeletonBar className="h-11 w-32" />
              <SkeletonBar className="h-11 w-32" />
            </div>
          </div>
        ) : (
          <div className="flex h-11 justify-end">
            <SkeletonBar className="h-11 w-20" />
          </div>
        )}
        <section className="kanban-workspace overflow-hidden">
          <div className="flex gap-4">
            {Array.from({ length: 4 }, (_, column) => (
              <div className="kanban-column shrink-0" key={column}>
                <div className="flex h-14 items-center px-3">
                  <SkeletonBar className="h-3 w-24" />
                </div>
                <div className="kanban-column-body min-h-80 space-y-3 rounded-2xl p-2">
                  {Array.from({ length: 2 }, (_, row) => (
                    <div className="admin-skeleton-surface p-4" key={row}>
                      <SkeletonBar className="h-3 w-3/5" />
                      <SkeletonBar className="mt-3 h-2.5 w-4/5" />
                      {cardSize === "detailed" && (
                        <>
                          <SkeletonBar className="mt-5 h-20 w-full" />
                          <SkeletonBar className="mt-3 ml-auto h-9 w-28" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  if (variant === "detail")
    return (
      <section
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
        aria-hidden="true"
      >
        <div className="admin-skeleton-surface p-5 sm:p-6">
          <SkeletonBar className="h-4 w-44" />
          <SkeletonBar className="mt-5 h-20 w-full" />
          <Rows count={rows} />
        </div>
        <div className="admin-skeleton-surface p-5 sm:p-6">
          <SkeletonBar className="h-4 w-32" />
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBar className="mt-4 h-11 w-full" key={index} />
          ))}
        </div>
      </section>
    );
  if (variant === "form")
    return (
      <section
        className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"
        aria-hidden="true"
      >
        <div className="admin-skeleton-surface p-5 sm:p-6">
          <SkeletonBar className="h-4 w-64" />
          <SkeletonBar className="mt-3 h-3 w-4/5" />
          {Array.from({ length: 4 }, (_, index) => (
            <div className="mt-5" key={index}>
              <SkeletonBar className="h-2.5 w-28" />
              <SkeletonBar className="mt-2 h-11 w-full" />
            </div>
          ))}
        </div>
        <div className="admin-skeleton-surface min-h-64 p-5 sm:p-6">
          <SkeletonBar className="h-4 w-36" />
          <SkeletonBar className="mt-5 h-3 w-full" />
          <SkeletonBar className="mt-3 h-3 w-5/6" />
          <SkeletonBar className="mt-3 h-3 w-2/3" />
        </div>
      </section>
    );
  return (
    <section className="admin-skeleton-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
        <SkeletonBar className="h-10 min-w-56 flex-1" />
        <SkeletonBar className="h-10 w-32" />
        <SkeletonBar className="h-10 w-24" />
      </div>
      <Rows count={rows} />
    </section>
  );
}

/** The delayed reveal also covers retained routes that render this directly. */
export function LoadingSkeleton(props: LoadingSkeletonProps) {
  return (
    <div className="admin-loading-placeholder">
      <LoadingSkeletonContent {...props} />
    </div>
  );
}

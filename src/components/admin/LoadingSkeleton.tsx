import { cn } from "@/lib/utils";

function SkeletonBar({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("admin-skeleton-shape block", className)} />;
}

interface LoadingSkeletonProps {
  variant?: "table" | "cards" | "page" | "today" | "board" | "detail" | "form";
  rows?: number;
  count?: number;
}

function Rows({ count }: { count: number }) {
  return <div className="divide-y divide-[var(--admin-border)]" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div className="flex min-h-[68px] items-center gap-4 px-5 py-4 sm:px-6" key={index}>
      <SkeletonBar className="size-9 shrink-0" />
      <div className="min-w-0 flex-1"><SkeletonBar className="h-3 w-[min(15rem,58%)]" /><SkeletonBar className="mt-2.5 h-2.5 w-[min(26rem,82%)]" /></div>
      <SkeletonBar className="hidden h-8 w-24 sm:block" />
    </div>)}
  </div>;
}

function Metrics({ count = 4 }: { count?: number }) {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <div className="admin-skeleton-surface min-h-32 p-5" key={index}>
      <SkeletonBar className="h-2.5 w-24" />
      <SkeletonBar className="mt-5 h-8 w-28" />
      <SkeletonBar className="mt-3 h-2.5 w-32" />
    </div>)}
  </section>;
}

export function LoadingSkeleton({ variant = "table", rows: rowsProp, count }: LoadingSkeletonProps) {
  const rows = rowsProp ?? count ?? 5;
  if (variant === "cards") return <Metrics count={Math.min(4, Math.max(1, count ?? 4))} />;
  if (variant === "today") return <div className="space-y-4" aria-hidden="true">
    <section className="admin-skeleton-surface grid grid-cols-2 overflow-hidden xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div className={cn("min-h-[96px] border-[var(--admin-border)] p-4 xl:border-b-0", index < 2 && "border-b", index % 2 === 0 && "border-r", index < 3 && "xl:border-r")} key={index}>
        <SkeletonBar className="h-2.5 w-20" />
        <SkeletonBar className="mt-3 h-7 w-24" />
        <SkeletonBar className="mt-2 h-2.5 w-28" />
      </div>)}
    </section>
    <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="admin-skeleton-surface overflow-hidden">
        <div className="px-5 py-4 sm:px-6"><SkeletonBar className="h-2.5 w-24" /><SkeletonBar className="mt-3 h-5 w-56" /><div className="mt-4 flex gap-2"><SkeletonBar className="h-10 w-20" /><SkeletonBar className="h-10 w-20" /><SkeletonBar className="h-10 w-28" /></div></div>
        <Rows count={rows} />
      </div>
      <div className="admin-skeleton-surface hidden overflow-hidden xl:block"><Rows count={3} /></div>
    </section>
  </div>;
  if (variant === "page") return <div className="space-y-4"><Metrics /><section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="admin-skeleton-surface overflow-hidden"><Rows count={rows} /></div><div className="admin-skeleton-surface overflow-hidden"><Rows count={3} /></div></section></div>;
  if (variant === "board") return <div className="space-y-4"><Metrics /><section className="grid grid-cols-[repeat(3,minmax(230px,1fr))] gap-3 overflow-hidden" aria-hidden="true">{Array.from({ length: 3 }, (_, column) => <div className="admin-skeleton-surface min-h-80 p-4" key={column}><SkeletonBar className="h-3 w-24" />{Array.from({ length: 3 }, (_, row) => <div className="mt-3 rounded-[14px] bg-[var(--admin-surface-subtle)] p-4" key={row}><SkeletonBar className="h-3 w-3/5" /><SkeletonBar className="mt-3 h-2.5 w-4/5" /><SkeletonBar className="mt-5 h-8 w-full" /></div>)}</div>)}</section></div>;
  if (variant === "detail") return <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true"><div className="admin-skeleton-surface p-5 sm:p-6"><SkeletonBar className="h-4 w-44" /><SkeletonBar className="mt-5 h-20 w-full" /><Rows count={rows} /></div><div className="admin-skeleton-surface p-5 sm:p-6"><SkeletonBar className="h-4 w-32" />{Array.from({ length: 4 }, (_, index) => <SkeletonBar className="mt-4 h-11 w-full" key={index} />)}</div></section>;
  if (variant === "form") return <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true"><div className="admin-skeleton-surface p-5 sm:p-6"><SkeletonBar className="h-4 w-64" /><SkeletonBar className="mt-3 h-3 w-4/5" />{Array.from({ length: 4 }, (_, index) => <div className="mt-5" key={index}><SkeletonBar className="h-2.5 w-28" /><SkeletonBar className="mt-2 h-11 w-full" /></div>)}</div><div className="admin-skeleton-surface min-h-64 p-5 sm:p-6"><SkeletonBar className="h-4 w-36" /><SkeletonBar className="mt-5 h-3 w-full" /><SkeletonBar className="mt-3 h-3 w-5/6" /><SkeletonBar className="mt-3 h-3 w-2/3" /></div></section>;
  return <section className="admin-skeleton-surface overflow-hidden"><div className="flex flex-wrap items-center gap-3 p-5 sm:p-6"><SkeletonBar className="h-10 min-w-56 flex-1" /><SkeletonBar className="h-10 w-32" /><SkeletonBar className="h-10 w-24" /></div><Rows count={rows} /></section>;
}

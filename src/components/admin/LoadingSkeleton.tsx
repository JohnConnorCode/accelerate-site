import { cn } from "@/lib/utils";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/[0.06]",
        className
      )}
    />
  );
}

interface LoadingSkeletonProps {
  variant?: "table" | "cards" | "page";
  rows?: number;
  count?: number;
}

export function LoadingSkeleton({ variant = "table", rows: rowsProp, count }: LoadingSkeletonProps) {
  const rows = rowsProp ?? count ?? 5;
  if (variant === "cards") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-xl p-5 space-y-3">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className="h-8 w-16" />
            <SkeletonBar className="h-2 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonBar className="h-8 w-48" />
          <SkeletonBar className="h-8 w-24" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-xl p-5 space-y-3">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="glass rounded-xl p-5 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonBar key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Table variant
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-glass">
        <div className="flex gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBar key={i} className="h-3 w-20" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border-glass last:border-b-0">
          <div className="flex gap-8 items-center">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-4 w-16" />
            <SkeletonBar className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

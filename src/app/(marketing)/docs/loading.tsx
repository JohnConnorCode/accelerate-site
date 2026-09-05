export default function DocsLoading() {
  return (
    <div
      className="page-offset mx-auto max-w-[80rem] px-6 py-12 lg:px-10"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading documentation</span>
      <div className="flex gap-12">
        <div className="hidden w-64 shrink-0 space-y-3 lg:block">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-4 w-40 rounded bg-[var(--rule)]" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-3 w-24 rounded-full bg-[var(--rule)]" />
          <div className="mt-6 h-12 w-[min(20rem,80%)] rounded-2xl bg-[var(--rule)]" />
          <div className="mt-4 h-5 w-[min(36rem,100%)] rounded-full bg-[var(--rule)]" />
          <div className="mt-10 space-y-3">
            <div className="h-4 w-full rounded bg-[var(--rule)]" />
            <div className="h-4 w-[92%] rounded bg-[var(--rule)]" />
            <div className="h-4 w-[70%] rounded bg-[var(--rule)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketingLoading() {
  return (
    <div className="page-offset mx-auto w-full max-w-6xl px-5 py-16 sm:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <div className="h-3 w-24 rounded-full bg-[var(--rule)]" />
      <div className="mt-6 h-12 w-[min(18rem,80%)] rounded-2xl bg-[var(--rule)]" />
      <div className="mt-4 h-5 w-[min(36rem,100%)] rounded-full bg-[var(--rule)]" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="h-40 rounded-3xl bg-[var(--rule)]" />
        <div className="h-40 rounded-3xl bg-[var(--rule)]" />
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading workspace">
      <div className="space-y-3">
        <div className="admin-loading-shape h-3 w-28 rounded-full" />
        <div className="admin-loading-shape h-10 w-[min(23rem,78vw)] rounded-xl" />
        <div className="admin-loading-shape h-4 w-[min(36rem,88vw)] rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-h-36 rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow)]">
            <div className="admin-loading-shape h-3 w-24 rounded-full" />
            <div className="admin-loading-shape mt-5 h-9 w-28 rounded-lg" />
            <div className="admin-loading-shape mt-4 h-3 w-36 rounded-full" />
          </div>
        ))}
      </div>
      <div className="min-h-80 rounded-[var(--admin-surface-radius)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow)]">
        <div className="admin-loading-shape h-4 w-44 rounded-full" />
        <div className="mt-7 space-y-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="admin-loading-shape h-14 w-full rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

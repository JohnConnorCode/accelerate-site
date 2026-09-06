"use client";
import { useAdminDemo } from "./AdminDemoBoundary";
/** Truthful context on the shared admin interface, never a replacement demo page. */
export function DemoBusinessNotice() {
  const demo = useAdminDemo();
  if (!demo) return null;
  return (
    <p role="note" className="rounded-xl bg-[var(--admin-surface-subtle)] p-4 text-sm admin-copy">
      Fictional workspace · Approvals, invoice sends, AI designs, and saved changes are simulated in
      this browser session. Reset the demo to restore the sample business.
    </p>
  );
}

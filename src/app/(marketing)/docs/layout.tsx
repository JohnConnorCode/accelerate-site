import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 py-12 sm:py-16 lg:px-10">
      <div className="flex gap-12 xl:gap-16">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-28">
            <DocsSidebar />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <details className="mb-8 rounded-xl border border-[var(--rule)] px-4 py-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold">Sections</summary>
            <div className="mt-4">
              <DocsSidebar />
            </div>
          </details>
          {children}
        </div>
      </div>
    </div>
  );
}

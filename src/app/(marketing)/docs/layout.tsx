import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="page-offset mx-auto max-w-[80rem] px-6 pb-16 pt-8 sm:pb-24 sm:pt-10 lg:px-10">
      <div className="flex gap-12 xl:gap-16">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-28 max-h-[calc(100svh-8rem)] overflow-y-auto pr-2">
            <DocsSidebar />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <DocsSearch />
          <DocsMobileNav />
          {children}
        </div>
      </div>
    </div>
  );
}

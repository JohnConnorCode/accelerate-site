import { DocsEntrance } from "@/components/docs/DocsEntrance";
import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import styles from "@/components/docs/docs.module.css";

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      className={`${styles.shell} page-offset mx-auto max-w-[84rem] px-6 pb-16 pt-8 sm:pb-24 sm:pt-10 lg:px-10`}
    >
      <div className="flex gap-10 xl:gap-14">
        <aside className={`${styles.sidebar} hidden w-60 shrink-0 lg:block`}>
          <div className="sticky top-28 max-h-[calc(100svh-8rem)] overflow-y-auto pr-2">
            <DocsSidebar />
          </div>
        </aside>
        <div className={`${styles.main} min-w-0 flex-1`}>
          <DocsSearch />
          <DocsMobileNav />
          <DocsEntrance>{children}</DocsEntrance>
        </div>
      </div>
    </div>
  );
}

import Link from "@/components/admin/AdminLink";
import { ArrowRight, DatabaseZap } from "lucide-react";
import { AdminSurface } from "./AdminSurface";

export function RevenueSetupGate({
  title = "This feature needs setup",
  detail = "Open Setup Center to see what’s missing and the next steps to make this feature available.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <AdminSurface tone="attention" padding="lg" className="text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-amber-500/12 text-amber-800 dark:text-amber-300">
        <DatabaseZap className="size-5" />
      </span>
      <h2 className="mt-4 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">
        {title}
      </h2>
      <p className="admin-copy mx-auto mt-2 max-w-lg text-pretty text-sm leading-6">{detail}</p>
      <Link href="/admin/setup" className="admin-button admin-button--primary mt-5">
        Open Setup Center <ArrowRight className="size-3.5" />
      </Link>
    </AdminSurface>
  );
}

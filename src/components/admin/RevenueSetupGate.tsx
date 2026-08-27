import Link from "@/components/admin/AdminLink";
import { ArrowRight, DatabaseZap } from "lucide-react";
import { AdminSurface } from "./AdminSurface";

export function RevenueSetupGate({ title = "Finish the Revenue OS migration", migration = "migrations/20260816-revenue-os.sql", detail = "Existing funnel records are imported idempotently." }: { title?: string; migration?: string; detail?: string }) {
  return (
    <AdminSurface tone="attention" padding="lg" className="text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-amber-500/12 text-amber-800 dark:text-amber-300"><DatabaseZap className="size-5" /></span>
      <h2 className="mt-4 text-balance text-xl font-semibold tracking-[-0.025em] text-[var(--admin-ink)]">{title}</h2>
      <p className="admin-copy mx-auto mt-2 max-w-lg text-pretty text-sm leading-6">Apply <code className="font-mono text-xs">{migration}</code>, then refresh Setup Center. {detail}</p>
      <Link href="/admin/setup" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--admin-ink)] pl-4 pr-3.5 text-xs font-semibold text-[var(--admin-surface)] transition-[opacity,transform] duration-150 hover:opacity-85 active:scale-[0.96]">Open Setup Center <ArrowRight className="size-3.5" /></Link>
    </AdminSurface>
  );
}

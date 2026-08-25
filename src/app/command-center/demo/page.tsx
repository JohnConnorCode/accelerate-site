import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { CommandCenterDemo } from "@/components/command-center/demo/CommandCenterDemo";

export const metadata: Metadata = {
  title: "Command Center Demo",
  description: "Explore a safe, interactive Command Center workspace using fictional sample data.",
  robots: { index: false, follow: false },
};

export default function CommandCenterDemoPage() {
  return (
    <main className="min-h-screen bg-[#ecece7] py-4 text-[#0b0b0b] sm:py-10">
      <div className="mx-auto w-[min(1500px,calc(100%-24px))] sm:w-[min(1500px,calc(100%-40px))]">
        <div className="mb-4 grid gap-4 sm:mb-5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <Link href="/command-center" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-black/55 transition-[color,transform] hover:text-black active:scale-[0.96]"><ArrowLeft className="size-4" />Command Center overview</Link>
            <div className="mt-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45 sm:mt-3"><ShieldCheck className="size-4 text-emerald-700" />Isolated interactive sandbox</div>
            <h1 className="mt-2 max-w-4xl text-balance font-display text-[clamp(2rem,9.5vw,5.25rem)] font-semibold leading-[0.92] tracking-[-0.055em] sm:mt-3">Run a full morning before you connect a single account.</h1>
            <p className="mt-3 max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-black/58 sm:mt-4 sm:text-lg">Explore priorities, approvals, people, pipeline, grounded answers, and meeting extraction. Your progress stays in this tab until you reset it. Nothing can send, schedule, or change a real record.</p>
          </div>
          <Link href="/contact" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-black px-4 text-xs font-semibold text-white transition-[opacity,transform] hover:opacity-80 active:scale-[0.96]">Build this around your business <ArrowUpRight className="size-4" /></Link>
        </div>
        <CommandCenterDemo standalone />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/[0.045] px-4 py-3 text-xs text-black/55">
          <p className="text-pretty">Demo state is stored only in session storage and disappears when the browser tab closes.</p>
          <Link href="/command-center" className="inline-flex min-h-10 items-center font-semibold text-black transition-[opacity,transform] hover:opacity-65 active:scale-[0.96]">See what a real implementation includes <ArrowUpRight className="ml-2 size-4" /></Link>
        </div>
      </div>
    </main>
  );
}

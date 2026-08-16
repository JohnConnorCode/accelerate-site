"use client";

import { ArrowDown, ArrowRight, Check, Clock3, Gauge, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { trackConversion } from "@/lib/analytics";
import { RoofingQualifier } from "./RoofingQualifier";

const reveal = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const SYSTEM = [
  { icon: MessageSquareText, n: "01", title: "Respond", body: "Every web, text, chat, and phone inquiry gets an immediate, useful response." },
  { icon: Gauge, n: "02", title: "Qualify", body: "The system captures job type, location, urgency, and the next best action." },
  { icon: RefreshCw, n: "03", title: "Follow up", body: "Open estimates and unbooked inquiries stay in motion without someone remembering." },
  { icon: Clock3, n: "04", title: "Book and measure", body: "Appointments land on the calendar and every outcome traces back to its source." },
];

export function RoofingCampaignPage() {
  const goToAudit = (location: string) => {
    trackConversion("roofing_audit_cta", { location });
    document.querySelector("#qualify")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f3ee] text-[#151611] [--acid:#d7ff5f]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6 sm:px-8">
          <Logo />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#151611]/48 sm:text-[10px]">Roofing revenue systems · Midwest</span>
        </div>
      </header>

      <section className="relative flex min-h-[92svh] items-center border-b border-black/10 pt-28">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(0,0,0,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,.055)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        <div className="relative mx-auto grid w-full max-w-[1180px] gap-14 px-5 pb-20 sm:px-8 lg:grid-cols-[1.22fr_.78fr] lg:items-end">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={reveal} className="mb-7 font-mono text-[10px] uppercase tracking-[0.2em] text-[#151611]/52">For established roofing + exterior operators</motion.p>
            <motion.h1 variants={reveal} className="max-w-[800px] text-balance font-display text-[clamp(3.25rem,8.4vw,7.2rem)] font-medium leading-[0.88] tracking-[-0.065em]">
              Your next job may already be in the pipeline.
            </motion.h1>
            <motion.p variants={reveal} className="mt-8 max-w-2xl text-pretty text-lg leading-8 text-[#151611]/64 sm:text-xl">
              We find where new inquiries, open estimates, and follow-up are leaking booked work—then build and run the AI system that closes those gaps.
            </motion.p>
            <motion.div variants={reveal} className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button onClick={() => goToAudit("hero")} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#151611] pl-5 pr-[18px] font-mono text-[11px] uppercase tracking-[0.13em] text-white shadow-[0_10px_28px_rgba(0,0,0,0.2)] transition-[scale,background-color] duration-150 hover:bg-black active:scale-[0.96]">
                Find the revenue leak <ArrowRight className="size-4" />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#151611]/48">Free · 30 minutes · written findings</span>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.55 }} className="relative rounded-[28px] bg-[#151611] p-5 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_30px_80px_rgba(0,0,0,0.2)] sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/46">Revenue path</span>
              <span className="rounded-full bg-[var(--acid)]/12 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--acid)]">Managed by Accelerate</span>
            </div>
            <div className="space-y-2 py-5">
              {["New roof inquiry arrives", "Job details captured", "Estimate visit booked", "Unclosed quote followed up"].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.045] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/6 font-mono text-[9px] tabular-nums text-white/46">0{index + 1}</span>
                  <span className="text-sm text-white/72">{item}</span>
                  <Check className="ml-auto size-4 text-[var(--acid)]" />
                </div>
              ))}
            </div>
            <p className="border-t border-white/10 pt-4 text-pretty text-sm leading-6 text-white/48">Example workflow. Your audit maps the actual handoffs, tools, and response gaps inside your operation.</p>
          </motion.div>
        </div>
        <button aria-label="Continue to the audit" onClick={() => goToAudit("hero_scroll")} className="absolute bottom-5 left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full text-[#151611]/45 transition-[color,scale] duration-150 hover:text-[#151611] active:scale-[0.96]"><ArrowDown className="size-5" /></button>
      </section>

      <section className="bg-[#151611] py-24 text-white sm:py-32">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--acid)]">The managed system</p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
            <h2 className="text-balance font-display text-5xl font-medium leading-[0.96] tracking-[-0.055em] sm:text-6xl">Every inquiry stays in motion.</h2>
            <p className="max-w-xl text-pretty text-lg leading-8 text-white/58 lg:justify-self-end">Not another dashboard for your team to manage. Accelerate connects the channels you already use, operates the workflows, and reports what turned into appointments and revenue.</p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] bg-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.24)] sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEM.map(({ icon: Icon, n, title, body }) => (
              <article key={title} className="bg-[#151611] p-6 sm:p-7">
                <div className="flex items-center justify-between"><Icon className="size-5 text-[var(--acid)]" /><span className="font-mono text-[10px] tabular-nums text-white/30">{n}</span></div>
                <h3 className="mt-12 font-display text-2xl font-medium tracking-[-0.03em]">{title}</h3>
                <p className="mt-3 text-pretty text-sm leading-6 text-white/52">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#151611]/46">Anonymized operator outcome</p>
            <h2 className="mt-5 max-w-xl text-balance font-display text-5xl font-medium leading-[0.96] tracking-[-0.055em] sm:text-6xl">Faster response. Consistent follow-up. Fewer invisible gaps.</h2>
          </div>
          <div className="rounded-[28px] bg-white/55 p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_24px_60px_rgba(0,0,0,0.07)] sm:p-8">
            {["New inquiries moved from manual monitoring to near-instant acknowledgment.", "After-hours opportunities entered the same qualification path as daytime requests.", "Open estimates received consistent follow-up instead of relying on memory."].map((item) => (
              <div key={item} className="flex gap-3 border-b border-black/8 py-4 last:border-0"><Check className="mt-1 size-4 shrink-0 text-[#536d00]" /><p className="text-pretty leading-7 text-[#151611]/66">{item}</p></div>
            ))}
            <p className="mt-4 text-xs leading-5 text-[#151611]/42">Client identity and exact commercial figures are withheld. We share the measurement method and applicable details during the audit.</p>
          </div>
        </div>
      </section>

      <section id="qualify" className="scroll-mt-0 bg-[#ebeae4] py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#151611]/46">Free Roofing Revenue Leak Audit</p>
            <h2 className="mt-5 text-balance font-display text-5xl font-medium leading-[0.96] tracking-[-0.055em]">Leave with the first fix in writing.</h2>
            <div className="mt-8 space-y-4">
              {["The highest-cost handoff or follow-up gap", "What it would take to fix", "A practical implementation order within two business days"].map((item) => <p key={item} className="flex gap-3 text-pretty text-sm leading-6 text-[#151611]/62"><Check className="mt-1 size-4 shrink-0 text-[#536d00]" />{item}</p>)}
            </div>
            <p className="mt-8 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#151611]/42"><ShieldCheck className="size-4" /> You talk to John, not a sales rep</p>
          </div>
          <RoofingQualifier />
        </div>
      </section>

      <section className="bg-[#d7ff5f] py-20">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-7 px-5 sm:px-8 lg:flex-row lg:items-center">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#151611]/48">One useful conversation</p><h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-[-0.045em] sm:text-5xl">Find the leak before buying the system.</h2></div>
          <button onClick={() => goToAudit("closing")} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#151611] pl-5 pr-[18px] font-mono text-[11px] uppercase tracking-[0.13em] text-white transition-[scale,background-color] duration-150 hover:bg-black active:scale-[0.96]">Check fit <ArrowRight className="size-4" /></button>
        </div>
      </section>

      <footer className="bg-[#151611] py-8 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/36 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Accelerate · AI revenue systems, built and run for you</span>
          <a href="mailto:john@acceleratewith.us" className="min-h-10 content-center transition-colors hover:text-white">john@acceleratewith.us</a>
        </div>
      </footer>
    </div>
  );
}

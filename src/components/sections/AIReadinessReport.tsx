import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CircleHelp,
  Download,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReadinessReport, WebsiteAudit } from "@/lib/ai-readiness";

function scoreText(score: number | null) {
  return score === null ? "—" : `${score}`;
}

export function AIReadinessReport({
  report,
  reportToken,
  onDownload,
}: {
  report: ReadinessReport;
  reportToken?: string | null;
  onDownload?: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20 pt-28 sm:pt-36">
      <section className="relative overflow-hidden rounded-[2rem] bg-[var(--ink)] px-6 py-10 text-[var(--paper)] shadow-[0_24px_80px_-36px_rgba(0,0,0,.5)] sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/15"
        />
        <div
          aria-hidden
          className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-white/10"
        />
        <div className="relative max-w-3xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-white/60">
            Accelerate / AI readiness
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 max-w-2xl text-balance font-display text-4xl font-semibold tracking-[-0.045em] focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-6xl"
          >
            Your next useful move is clearer now.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-white/70 sm:text-lg">
            {report.summary}
          </p>
          <div className="mt-9 flex flex-wrap items-end gap-8">
            <div>
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-white/50">
                Readiness score
              </p>
              <p className="mt-1 font-display text-6xl font-semibold tabular-nums tracking-[-0.06em] text-white">
                {scoreText(report.score)}
                <span className="ml-2 text-2xl text-white/50">/100</span>
              </p>
            </div>
            <div className="pb-2">
              <p className="font-semibold text-white">{report.scoreLabel}</p>
              <p className="mt-1 text-sm text-white/60">
                {report.coverage}% of answers provide signal.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        {report.dimensionScores.map((dimension) => (
          <div
            key={dimension.key}
            className="rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_12px_36px_-28px_rgba(0,0,0,.55)] dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--soft)]">
                {dimension.label}
              </p>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {scoreText(dimension.score)}
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <span
                className="block h-full rounded-full bg-[var(--ink)] dark:bg-white"
                style={{ width: `${dimension.score ?? dimension.coverage}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--soft)]">{dimension.description}</p>
          </div>
        ))}
      </section>

      {report.websiteAudit && <WebsiteAuditSection audit={report.websiteAudit} />}

      <section className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--soft)]">
              Priorities
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em]">
              Where to start
            </h2>
          </div>
          {report.recommendations.map((recommendation, index) => (
            <article
              key={recommendation.key}
              className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04] sm:p-7"
            >
              <div className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-sm font-semibold text-[var(--paper)] dark:bg-white dark:text-black">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-[-0.025em]">
                    {recommendation.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
                    {recommendation.summary}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--soft)]">
                    Why it fits
                  </p>
                  <p className="mt-2 text-sm leading-5">{recommendation.why}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--soft)]">
                    Start with
                  </p>
                  <p className="mt-2 text-sm leading-5">{recommendation.effort}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--soft)]">
                    Measure
                  </p>
                  <p className="mt-2 text-sm leading-5">{recommendation.metric}</p>
                </div>
              </div>
              <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--soft)]">
                  Prerequisites
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                  {recommendation.prerequisites.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl bg-[var(--ink)] p-7 text-[var(--paper)]">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5" />
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-white/60">
                First pilot
              </p>
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.03em]">
              {report.pilot.title}
            </h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="text-white/50">Baseline</dt>
                <dd className="mt-1 text-white/90">{report.pilot.baseline}</dd>
              </div>
              <div>
                <dt className="text-white/50">Owner</dt>
                <dd className="mt-1 text-white/90">{report.pilot.owner}</dd>
              </div>
              <div>
                <dt className="text-white/50">Review boundary</dt>
                <dd className="mt-1 text-white/90">{report.pilot.review}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-7 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--soft)]">
                How to use this
              </p>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--soft)]">
              This is a starting point built from your answers. Validate the baseline with your team
              before you automate customer-facing work.
            </p>
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-[var(--soft)]">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
              Scores describe readiness signals, not a guarantee of savings or revenue.
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04] sm:p-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--soft)]">
          30-day action plan
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-4">
          {report.actionPlan.map((step) => (
            <div key={step.week}>
              <p className="font-mono text-xs text-[var(--soft)]">{step.week}</p>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--soft)]">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-7 dark:border-white/10">
        <p className="max-w-xl text-sm leading-6 text-[var(--soft)]">
          Want help choosing the first workflow or setting a useful baseline? We can map that in a
          free 30-minute strategy session.
        </p>
        <div className="flex flex-wrap gap-3">
          {reportToken && (
            <a
              href={`/api/ai-readiness/pdf?token=${encodeURIComponent(reportToken)}`}
              onClick={onDownload}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-semibold transition-colors hover:border-black dark:border-white/20 dark:hover:border-white"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          )}
          <Link
            href="/contact?source=ai-readiness"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--paper)] transition-transform active:scale-[0.96] hover:opacity-85 dark:bg-white dark:text-black"
          >
            <ArrowUpRight className="h-4 w-4" />
            Talk through the first step
          </Link>
        </div>
      </div>
    </div>
  );
}

function WebsiteAuditSection({ audit }: { audit: WebsiteAudit }) {
  const completed = audit.status === "completed";
  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 p-6 dark:border-white/10 dark:bg-white/[0.04] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <Globe2 className="h-5 w-5" />
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--soft)]">
              Website snapshot
            </p>
          </div>
          <h2 className="mt-3 max-w-2xl break-all font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            {audit.url}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--soft)]">{audit.summary}</p>
        </div>
        {audit.score !== null && (
          <div className="shrink-0 rounded-2xl bg-[var(--ink)] px-5 py-4 text-right text-[var(--paper)]">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/60">
              Surface score
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
              {audit.score}
              <span className="ml-1 text-lg text-white/50">/100</span>
            </p>
          </div>
        )}
      </div>
      {!completed ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p>
            {audit.note} {audit.summary}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {audit.categories.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="font-semibold tabular-nums">{item.score}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-[var(--ink)] dark:bg-white"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--soft)]">{item.summary}</p>
              </div>
            ))}
          </div>
          {audit.findings.length > 0 && (
            <div className="mt-7 border-t border-black/10 pt-6 dark:border-white/10">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--soft)]">
                What to improve first
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {audit.findings.map((finding) => (
                  <article
                    key={`${finding.category}-${finding.title}`}
                    className="rounded-xl border border-black/10 p-4 dark:border-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${finding.severity === "priority" ? "bg-amber-500" : finding.severity === "strength" ? "bg-emerald-500" : "bg-[var(--ink)] dark:bg-white"}`}
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--soft)]">
                          {finding.category}
                        </p>
                        <h3 className="mt-1 font-semibold">{finding.title}</h3>
                        <p className="mt-2 text-sm leading-5 text-[var(--soft)]">
                          {finding.detail}
                        </p>
                        <p className="mt-2 text-sm leading-5">
                          <span className="font-semibold">Next:</span> {finding.action}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <p className="mt-6 text-xs leading-5 text-[var(--soft)]">
        {audit.note} Checked {new Date(audit.checkedAt).toLocaleDateString()}.
      </p>
    </section>
  );
}

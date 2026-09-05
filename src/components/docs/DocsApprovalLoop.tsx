import { LOOP_STEPS } from "@/content/command-center";

/** The four beats of the approval loop, from the same source the public page uses. */
export function DocsApprovalLoop() {
  return (
    <div className="not-prose mt-6 space-y-3">
      {LOOP_STEPS.map((step) => (
        <div key={step.n} className="rounded-2xl border border-[var(--rule)] p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white-muted">
            {step.n} · {step.tag}
          </p>
          <p className="mt-1 font-display text-lg font-semibold tracking-[-0.02em] text-heading">
            {step.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white-secondary">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

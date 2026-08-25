"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { EASE } from "@/lib/animations";
import { ACTION_KIND, FEEDBACK_REASONS, type DemoAction } from "./demo-data";

/* The detail view for one queued action.

   This is the only place a draft is read or edited. The queue row used to
   expand a textarea inline, which meant two renderings of the same thing and
   a row that jumped 200px when you touched it. One surface, one behaviour.

   Deliberately a real dialog: Escape closes, the backdrop closes, focus moves
   in on open and returns to the row on close, and the page behind it cannot
   scroll. A mock that fakes the chrome but not the behaviour is the kind of
   thing this whole page is arguing against. */

const MONO = "font-mono text-[0.62rem] uppercase tracking-[0.16em]";
const CITE = "font-mono text-[0.68rem] tracking-[0.01em]";

export function ActionModal({
  action,
  body,
  edited,
  onBody,
  onApprove,
  onSkip,
  onFeedback,
  mode,
  onClose,
}: {
  action: DemoAction | null;
  body: string;
  edited: boolean;
  onBody: (v: string) => void;
  onApprove: () => void;
  onSkip: () => void;
  /** Reject with a reason, and report back what that taught it. */
  onFeedback: (reasonLabel: string, learned: string) => void;
  mode: "detail" | "feedback";
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!action) return;
    returnTo.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The floating Dock is fixed at z-950 and would sit on top of a bottom
    // sheet. Raising the dialog above it is not enough: a "Book a call" bar
    // competing with an open dialog is wrong at any z-index.
    document.body.classList.add("modal-open");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Keep tabbing inside the dialog while it is open.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, textarea, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const t = setTimeout(() => panelRef.current?.querySelector("button")?.focus(), 60);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("modal-open");
      returnTo.current?.focus?.();
    };
  }, [action, onClose]);

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          // Above the floating Dock (z-950) and the chat bubble. A marketing CTA
          // painting over an open dialog is worse than not having the dialog.
          className="fixed inset-0 z-[9990] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-modal-title"
            initial={reduced ? false : { y: 24, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { y: 16, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="relative flex max-h-[calc(100dvh-12px)] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[20px] border border-white/15 bg-[#0B0B0B] pb-[env(safe-area-inset-bottom)] shadow-[0_50px_120px_-40px_rgba(0,0,0,.8)] sm:max-h-[88vh] sm:rounded-[16px] sm:pb-0"
          >
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/25 sm:hidden" aria-hidden="true" />
            <Header action={action} edited={edited} mode={mode} onClose={onClose} />

            {mode === "detail" ? (
              <div className="cc-scroll flex-1 overflow-y-auto">
                <Field label="Why this is here">
                  <p className="text-[0.86rem] leading-relaxed text-white/80">{action.because}</p>
                </Field>

                <Field label="Where it came from">
                  <p className={`${CITE} text-white/45`}>{action.source}</p>
                </Field>

                {action.draft ? (
                  <Field label="The draft" hint="Edit it here. Nothing sends until you approve.">
                    <textarea
                      value={body}
                      onChange={(e) => onBody(e.target.value)}
                      rows={12}
                      aria-label={`Draft for ${action.title}`}
                      className="w-full resize-y border border-white/15 bg-black/50 p-3.5 font-mono text-[0.78rem] leading-relaxed text-white/85 transition-colors focus:border-white/40 focus:outline-none"
                    />
                  </Field>
                ) : (
                  <Field label="What approving does">
                    <p className="text-[0.86rem] leading-relaxed text-white/80">{whatItDoes(action)}</p>
                  </Field>
                )}

                <Field label="What it will not do">
                  <p className="text-[0.86rem] leading-relaxed text-white/55">
                    Nothing else. It will not contact anyone not named here, and it will not
                    touch another record to make this one work.
                  </p>
                </Field>
              </div>
            ) : (
              <FeedbackPanel
                key={`${action.id}-feedback`}
                action={action}
                onSubmit={onFeedback}
                onCancel={onClose}
              />
            )}

            {mode === "detail" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
                <Action tone="solid" icon={Check} onClick={onApprove}>
                  {action.draft ? "Approve and send" : "Approve"}
                </Action>
                <Action icon={X} onClick={onSkip}>
                  Skip
                </Action>
                <button
                  type="button"
                  onClick={onClose}
                  className={`${MONO} ml-auto min-h-10 px-2 py-2 text-white/40 transition-[color,transform] hover:text-white/80 active:scale-[0.96]`}
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header({
  action,
  edited,
  mode,
  onClose,
}: {
  action: DemoAction;
  edited: boolean;
  mode: "detail" | "feedback";
  onClose: () => void;
}) {
  const k = ACTION_KIND[action.kind];
  return (
    <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
      <span
        className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center font-mono text-[0.7rem]"
        style={{ color: `rgb(${k.rgb})`, background: `rgba(${k.rgb},0.14)` }}
        aria-hidden="true"
      >
        {k.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`${MONO} text-white/35`}>
          {mode === "feedback" ? "Teaching it" : k.label}
          {mode === "detail" && action.routine && " / routine"}
          {mode === "detail" && edited && " / edited"}
        </p>
        <h4 id="cc-modal-title" className="mt-1 text-[1rem] leading-snug text-white">
          {action.title}
        </h4>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-white/40 transition-[background-color,color,transform] hover:bg-white/10 hover:text-white active:scale-[0.96]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.07] px-4 py-4 last:border-b-0 sm:px-5">
      <p className={`${MONO} mb-2 text-white/30`}>
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal text-white/25">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

/** Plain-language statement of the single write approving performs. */
function whatItDoes(a: DemoAction) {
  switch (a.kind) {
    case "calendar":
      return "Puts one hold on your calendar with the reason attached. No invite goes out until you send it.";
    case "deal":
      return "Moves one deal to the next stage and records the sentence it read as the reason.";
    case "task":
      return "Creates the tasks listed, each linked back to the line in the transcript it came from.";
    case "note":
      return "Files the note against that person's record. Nothing leaves the system.";
    default:
      return "Performs this one action and records it in the activity log.";
  }
}

function Action({
  children,
  onClick,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "solid";
  icon: typeof Check;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 border px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-[background-color,border-color,color,transform] active:scale-[0.96] ${
        tone === "solid"
          ? "border-white/35 bg-white/10 text-white hover:bg-white/25"
          : "border-white/12 text-white/55 hover:border-white/35 hover:text-white/90"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

/* Its own component so a new action or a switch of mode remounts it and the
   form starts clean. That is React's answer to "reset state when a prop
   changes"; doing it with an effect is a lint error and a wasted render. */
function FeedbackPanel({
  action,
  onSubmit,
  onCancel,
}: {
  action: DemoAction;
  onSubmit: (reasonLabel: string, learned: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const picked = FEEDBACK_REASONS.find((r) => r.id === reason);

  return (
    <>
      <div className="cc-scroll flex-1 overflow-y-auto">
        <Field label="What is wrong with it" hint="This is the input that changes the next one.">
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                aria-pressed={reason === r.id}
                className={`min-h-10 rounded-full border px-3 py-1.5 text-[0.8rem] transition-[background-color,border-color,color,transform] active:scale-[0.96] ${
                  reason === r.id
                    ? "border-white/60 bg-white/15 text-white"
                    : "border-white/15 text-white/55 hover:border-white/40 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Anything else" hint="Optional.">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            aria-label="Additional feedback"
            placeholder="In your own words."
            className="w-full resize-y border border-white/15 bg-black/50 p-3.5 text-[0.84rem] leading-relaxed text-white/85 placeholder:text-white/25 transition-colors focus:border-white/40 focus:outline-none"
          />
        </Field>

        <Field label="What this changes">
          <p className="text-[0.86rem] leading-relaxed text-white/70">
            {picked
              ? picked.learned.replace("{who}", action.who)
              : "Pick a reason and it will tell you what it takes from this."}
          </p>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          disabled={!picked}
          onClick={() => picked && onSubmit(picked.label, picked.learned.replace("{who}", action.who))}
          className="flex min-h-11 items-center gap-2 border border-white/35 bg-white/10 px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white transition-[background-color,border-color,color,transform] hover:bg-white/25 active:scale-[0.96] disabled:opacity-35"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
          Send feedback and reject
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${MONO} ml-auto min-h-10 px-2 py-2 text-white/40 transition-[color,transform] hover:text-white/80 active:scale-[0.96]`}
        >
          Close
        </button>
      </div>
    </>
  );
}

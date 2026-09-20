"use client";

import { useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, LockKeyhole, RotateCcw } from "lucide-react";
import { trackConversion, trackEvent } from "@/lib/analytics";
import { getUTMParams } from "@/lib/utm";
import { AIReadinessReport } from "@/components/sections/AIReadinessReport";
import {
  publicPreview,
  readinessDimensions,
  readinessQuestions,
  type AssessmentAnswers,
  type AssessmentProfile,
  type ReadinessReport,
} from "@/lib/ai-readiness";

type Phase = "intro" | "profile" | "questions" | "preview" | "unlock" | "report";
const STORAGE_KEY = "accelerate:ai-readiness:v2";

const initialProfile: AssessmentProfile = {
  businessType: "",
  teamSize: "2_to_5",
  priority: "save_time",
  bottleneck: "unknown",
  details: "",
  websiteUrl: "",
};

function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-[transform,opacity,background-color,border-color] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function AIReadinessAssessment({
  initialReport,
  initialReportToken,
}: {
  initialReport?: ReadinessReport | null;
  initialReportToken?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(initialReport ? "report" : "intro");
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [profile, setProfile] = useState<AssessmentProfile>(initialProfile);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [preview, setPreview] = useState<ReturnType<typeof publicPreview> | null>(null);
  const [report, setReport] = useState<ReadinessReport | null>(initialReport ?? null);
  const [reportToken, setReportToken] = useState<string | null>(initialReportToken ?? null);
  const [sessionToken, setSessionToken] = useState<string | undefined>();
  const [contact, setContact] = useState({
    name: "",
    email: "",
    businessName: "",
    consentGiven: false,
    marketingConsent: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    trackEvent("ai_readiness_started");
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as {
        answers?: AssessmentAnswers;
        profile?: AssessmentProfile;
        sessionToken?: string;
      } | null;
      if (saved?.answers) setAnswers(saved.answers);
      if (saved?.profile) setProfile({ ...initialProfile, ...saved.profile });
      if (saved?.sessionToken) setSessionToken(saved.sessionToken);
    } catch {
      /* stale local progress is disposable */
    }
  }, []);

  useEffect(() => {
    if (phase === "report") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, profile, sessionToken }));
  }, [answers, profile, sessionToken, phase]);

  const question = readinessQuestions[questionIndex];
  const answered = question ? answers[question.id] : undefined;
  const progress = Math.round(
    ((questionIndex + (phase === "questions" ? 0 : readinessQuestions.length)) /
      readinessQuestions.length) *
      100,
  );
  const profileReady =
    profile.businessType.trim().length > 0 &&
    profile.teamSize &&
    profile.priority &&
    profile.bottleneck &&
    (!profile.websiteUrl?.trim() || /^https?:\/\/[^\s]+$/i.test(profile.websiteUrl.trim()));
  const utm = useMemo(() => getUTMParams(), []);
  const previewRecommendation = preview?.previewRecommendation;

  function start() {
    trackEvent("ai_readiness_profile_started");
    setPhase("profile");
  }
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setAnswers({});
    setProfile(initialProfile);
    setSessionToken(undefined);
    setPreview(null);
    setReport(null);
    setReportToken(null);
    setQuestionIndex(0);
    setPhase("intro");
  }
  function setAnswer(value: string) {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
    trackEvent("ai_readiness_question_answered", {
      question_id: question.id,
      question_number: questionIndex + 1,
    });
  }
  async function requestPreview() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          sessionToken,
          answers,
          profile,
          attribution: {
            ...utm,
            referrerHost:
              typeof document !== "undefined" && document.referrer
                ? new URL(document.referrer).host
                : undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not score those answers.");
      setSessionToken(data.sessionToken);
      setPreview(data.preview);
      trackConversion("ai_readiness_previewed", {
        score_available: data.preview.score === null ? 0 : 1,
      });
      setPhase("preview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not score those answers.");
    } finally {
      setBusy(false);
    }
  }
  async function unlock() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "unlock",
          sessionToken,
          answers,
          profile,
          contact,
          attribution: {
            ...utm,
            referrerHost:
              typeof document !== "undefined" && document.referrer
                ? new URL(document.referrer).host
                : undefined,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not save your report.");
      setSessionToken(data.sessionToken);
      setReportToken(data.reportToken);
      setReport(data.report);
      trackConversion("ai_readiness_unlocked", {
        score: data.report.score ?? -1,
        coverage: data.report.coverage,
      });
      setPhase("report");
      localStorage.removeItem(STORAGE_KEY);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save your report.");
    } finally {
      setBusy(false);
    }
  }

  if (report && phase === "report")
    return (
      <AIReadinessReport
        report={report}
        reportToken={reportToken}
        onDownload={() => trackConversion("ai_readiness_pdf_downloaded")}
      />
    );

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
      <div className="mb-10 flex items-center justify-between gap-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-[var(--soft)]">
          AI readiness /{" "}
          {phase === "intro"
            ? "start"
            : phase === "profile"
              ? "context"
              : phase === "questions"
                ? `${questionIndex + 1} of ${readinessQuestions.length}`
                : phase}
        </p>
        {phase !== "intro" && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--soft)] transition-colors hover:text-[var(--fg)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Start over
          </button>
        )}
      </div>
      {phase === "intro" && (
        <section className="grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-[var(--soft)]">
              A practical diagnostic for small business leaders
            </p>
            <h1 className="mt-5 max-w-3xl text-balance font-display text-5xl font-semibold tracking-[-0.06em] sm:text-7xl">
              Find where AI can help first.
            </h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-[var(--soft)]">
              Answer a few focused questions about your work, tools, team, and guardrails. You will
              get a readiness score, a first pilot to consider, and a 30-day action plan.
            </p>
            <Button
              onClick={start}
              className="mt-8 bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
            >
              Start assessment <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-4 text-xs text-[var(--soft)]">
              About 5 minutes. Your answers are not connected to your contact details unless you
              unlock the report.
            </p>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/60 p-7 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--soft)]">
              You will leave with
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-6">
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0" />A score across five readiness dimensions.
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0" />A practical first workflow to examine.
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0" />A pilot plan with a baseline and review
                boundary.
              </li>
              <li className="flex gap-3">
                <Check className="mt-1 h-4 w-4 shrink-0" />A report you can save as a branded PDF.
              </li>
            </ul>
          </div>
        </section>
      )}

      {phase === "profile" && (
        <section className="max-w-2xl">
          <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
            Start with your context.
          </h1>
          <p className="mt-5 text-lg leading-7 text-[var(--soft)]">
            This lets the recommendations fit your operating reality. No sensitive information
            needed.
          </p>
          <div className="mt-10 grid gap-6">
            <label className="grid gap-2 text-sm font-semibold">
              What kind of business do you run?
              <input
                value={profile.businessType}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, businessType: event.target.value }))
                }
                placeholder="e.g. home services, law firm, advisory"
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal outline-none transition-colors focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              What is your public website?{" "}
              <span className="font-normal text-[var(--soft)]">Optional</span>
              <input
                type="url"
                value={profile.websiteUrl ?? ""}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, websiteUrl: event.target.value }))
                }
                placeholder="https://yourbusiness.com"
                inputMode="url"
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal outline-none transition-colors focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
              />
              <span className="text-xs font-normal leading-5 text-[var(--soft)]">
                We check the public homepage for visible SEO, mobile, accessibility, trust, and
                conversion signals. No login or private pages.
              </span>
              {profile.websiteUrl?.trim() &&
                !/^https?:\/\/[^\s]+$/i.test(profile.websiteUrl.trim()) && (
                  <span role="alert" className="text-xs font-normal text-red-600">
                    Use a full public URL beginning with https:// or http://.
                  </span>
                )}
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              How large is your team?
              <select
                value={profile.teamSize}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    teamSize: event.target.value as AssessmentProfile["teamSize"],
                  }))
                }
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal outline-none focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
              >
                <option value="just_me">Just me</option>
                <option value="2_to_5">2 to 5 people</option>
                <option value="6_to_15">6 to 15 people</option>
                <option value="16_to_50">16 to 50 people</option>
                <option value="50_plus">More than 50</option>
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">What would help most right now?</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["win_more", "Win more of the right work"],
                  ["save_time", "Give the team time back"],
                  ["serve_better", "Serve customers more consistently"],
                  ["understand_business", "See what is happening clearly"],
                  ["prepare_safely", "Prepare for AI carefully"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setProfile((current) => ({
                        ...current,
                        priority: value as AssessmentProfile["priority"],
                      }))
                    }
                    className={`min-h-12 rounded-xl border px-4 text-left text-sm transition-colors ${profile.priority === value ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] dark:border-white dark:bg-white dark:text-black" : "border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.04]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">
                Where does work feel most constrained?
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["follow_up", "Lead response and follow-through"],
                  ["admin", "Routine admin and reminders"],
                  ["intake", "Client or customer intake"],
                  ["delivery", "Delivery coordination"],
                  ["reporting", "Decision-ready reporting"],
                  ["unknown", "I need help finding it"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setProfile((current) => ({
                        ...current,
                        bottleneck: value as AssessmentProfile["bottleneck"],
                      }))
                    }
                    className={`min-h-12 rounded-xl border px-4 text-left text-sm transition-colors ${profile.bottleneck === value ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] dark:border-white dark:bg-white dark:text-black" : "border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.04]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="grid gap-2 text-sm font-semibold">
              Anything else shaping the decision?{" "}
              <span className="font-normal text-[var(--soft)]">Optional</span>
              <textarea
                value={profile.details ?? ""}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, details: event.target.value }))
                }
                placeholder="For example: a workflow you want to improve, a deadline, or a concern about adoption."
                maxLength={500}
                rows={4}
                className="rounded-xl border border-black/15 bg-white/60 px-4 py-3 font-normal outline-none transition-colors focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
              />
              <span className="text-xs font-normal text-[var(--soft)]">
                Do not include customer, health, financial, password, or other sensitive
                information.
              </span>
            </label>
            <Button
              disabled={!profileReady}
              onClick={() => {
                setQuestionIndex(0);
                setPhase("questions");
                trackEvent("ai_readiness_questions_started");
              }}
              className="mt-2 bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {phase === "questions" && question && (
        <section className="mx-auto max-w-2xl">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <span
              className="block h-full rounded-full bg-[var(--ink)] transition-[width] dark:bg-white"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--soft)]">
            {readinessDimensions.find((dimension) => dimension.key === question.dimension)?.label}
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            {question.prompt}
          </h1>
          <p className="mt-4 text-[var(--soft)]">{question.helper}</p>
          <div className="mt-9 grid gap-3">
            {question.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAnswer(option.value)}
                className={`min-h-14 rounded-2xl border px-5 text-left text-sm transition-[transform,background-color,border-color] hover:-translate-y-0.5 ${answered === option.value ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] dark:border-white dark:bg-white dark:text-black" : "border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.04]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-9 flex items-center justify-between gap-3">
            <Button
              type="button"
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex((current) => current - 1)}
              className="border border-black/15 bg-transparent dark:border-white/15"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {questionIndex === readinessQuestions.length - 1 ? (
              <Button
                type="button"
                disabled={!answered || busy}
                onClick={requestPreview}
                className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {profile.websiteUrl?.trim() ? "Checking site" : "Scoring answers"}
                  </>
                ) : (
                  "See my preview"
                )}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!answered}
                onClick={() => setQuestionIndex((current) => current + 1)}
                className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </section>
      )}

      {phase === "preview" && preview && previewRecommendation && (
        <section className="mx-auto max-w-3xl">
          <div className="rounded-3xl bg-[var(--ink)] p-7 text-[var(--paper)] sm:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
              Your preview
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-7">
              <p className="font-display text-7xl font-semibold tracking-[-0.07em]">
                {preview.score === null ? "—" : preview.score}
                <span className="ml-2 text-2xl text-white/50">/100</span>
              </p>
              <p className="pb-2 text-white/70">
                {preview.scoreLabel}
                <br />
                {preview.coverage}% answer coverage
              </p>
            </div>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/80">{preview.summary}</p>
          </div>
          <div className="mt-7 rounded-2xl border border-black/10 bg-white/70 p-7 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--soft)]">
              The clearest first opportunity
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em]">
              {previewRecommendation.title}
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-[var(--soft)]">
              {previewRecommendation.summary}
            </p>
            {preview.websiteAudit && (
              <div className="mt-7 rounded-2xl border border-black/10 bg-black/[0.03] p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--soft)]">
                    Website snapshot
                  </p>
                  <p className="font-semibold tabular-nums">
                    {preview.websiteAudit.score === null
                      ? "Not scored"
                      : `${preview.websiteAudit.score}/100`}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--soft)]">
                  {preview.websiteAudit.summary}
                </p>
                {preview.websiteAudit.findings[0] && (
                  <p className="mt-3 text-sm font-semibold">
                    Next: {preview.websiteAudit.findings[0].title}
                  </p>
                )}
              </div>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => {
                  setPhase("unlock");
                  trackEvent("ai_readiness_gate_viewed");
                }}
                className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
              >
                Unlock full action plan <LockKeyhole className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setPhase("questions");
                  setQuestionIndex(0);
                }}
                className="border border-black/15 bg-transparent dark:border-white/15"
              >
                Review answers
              </Button>
            </div>
          </div>
        </section>
      )}

      {phase === "unlock" && (
        <section className="mx-auto max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--soft)]">
            Your report is ready
          </p>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
            Save the full action plan.
          </h1>
          <p className="mt-5 leading-7 text-[var(--soft)]">
            Get the complete dimension breakdown, pilot guidance, 30-day plan, and a branded PDF you
            can share with your team.
          </p>
          <div className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-semibold">
              Your name
              <input
                value={contact.name}
                onChange={(event) =>
                  setContact((current) => ({ ...current, name: event.target.value }))
                }
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal dark:border-white/15 dark:bg-white/[0.04]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Work email
              <input
                type="email"
                value={contact.email}
                onChange={(event) =>
                  setContact((current) => ({ ...current, email: event.target.value }))
                }
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal dark:border-white/15 dark:bg-white/[0.04]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Business name
              <input
                value={contact.businessName}
                onChange={(event) =>
                  setContact((current) => ({ ...current, businessName: event.target.value }))
                }
                className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal dark:border-white/15 dark:bg-white/[0.04]"
              />
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-[var(--soft)]">
              <input
                type="checkbox"
                checked={contact.consentGiven}
                onChange={(event) =>
                  setContact((current) => ({ ...current, consentGiven: event.target.checked }))
                }
                className="mt-1 h-4 w-4"
              />
              I agree to let Accelerate save my answers and send me this report.
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-[var(--soft)]">
              <input
                type="checkbox"
                checked={contact.marketingConsent}
                onChange={(event) =>
                  setContact((current) => ({ ...current, marketingConsent: event.target.checked }))
                }
                className="mt-1 h-4 w-4"
              />
              Send me occasional practical notes about AI and automation. Optional.
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <Button
              disabled={
                !contact.name.trim() ||
                !contact.email.trim() ||
                !contact.businessName.trim() ||
                !contact.consentGiven ||
                busy
              }
              onClick={unlock}
              className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing report
                </>
              ) : (
                <>
                  Show my report <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="flex items-center gap-2 text-xs text-[var(--soft)]">
              <LockKeyhole className="h-3.5 w-3.5" />
              Your answers are used for this assessment and follow-up only.
            </p>
          </div>
        </section>
      )}
      {error && phase !== "unlock" && (
        <p role="alert" className="mx-auto mt-8 max-w-2xl text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

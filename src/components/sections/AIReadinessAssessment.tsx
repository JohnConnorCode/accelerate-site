"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { trackConversion, trackEvent } from "@/lib/analytics";
import { getUTMParams } from "@/lib/utm";
import { AIReadinessReport } from "@/components/sections/AIReadinessReport";
import { HeroEntranceItem, PublicHeroEntrance } from "@/components/motion/PublicHeroEntrance";
import { EASE } from "@/lib/animations";
import styles from "./AIReadiness.module.css";
import {
  publicPreview,
  readinessDimensions,
  readinessQuestions,
  type AssessmentAnswers,
  type AssessmentProfile,
  type ReadinessReport,
} from "@/lib/ai-readiness";

type Phase = "intro" | "profile" | "questions" | "preview" | "unlock" | "report";
type Direction = 1 | -1;
const STORAGE_KEY = "accelerate:ai-readiness:v2";

const phaseNames: Record<Phase, string> = {
  intro: "Start",
  profile: "Your context",
  questions: "Assessment",
  preview: "Your first insight",
  unlock: "Your action plan",
  report: "Your report",
};

const stageOrder: Phase[] = ["intro", "profile", "questions", "preview", "unlock"];

const phaseVariants: Variants = {
  enter: (direction: Direction) => ({ opacity: 0, x: direction > 0 ? 22 : -22, y: 9 }),
  center: { opacity: 1, x: 0, y: 0, transition: { duration: 0.44, ease: EASE } },
  exit: (direction: Direction) => ({
    opacity: 0,
    x: direction > 0 ? -14 : 14,
    y: -5,
    transition: { duration: 0.2, ease: "easeIn" },
  }),
};

const reducedPhaseVariants: Variants = {
  enter: { opacity: 1, x: 0, y: 0 },
  center: { opacity: 1, x: 0, y: 0, transition: { duration: 0 } },
  exit: { opacity: 0, x: 0, y: 0, transition: { duration: 0.08 } },
};

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
  const [direction, setDirection] = useState<Direction>(1);
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterTransition = useRef(false);
  const prefersReducedMotion = useReducedMotion();

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
    ((questionIndex + (phase === "questions" ? 1 : readinessQuestions.length)) /
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
  const currentStage = stageOrder.indexOf(phase === "report" ? "unlock" : phase);
  const phaseProgress =
    phase === "questions"
      ? Math.min(0.82, 0.18 + ((questionIndex + 1) / readinessQuestions.length) * 0.64)
      : phase === "intro"
        ? 0.06
        : phase === "profile"
          ? 0.18
          : phase === "preview"
            ? 0.86
            : phase === "unlock" || phase === "report"
              ? 1
              : 0;
  const activePhaseVariants = prefersReducedMotion ? reducedPhaseVariants : phaseVariants;

  function transitionTo(next: Phase, nextDirection: Direction = 1) {
    focusAfterTransition.current = true;
    setDirection(nextDirection);
    setPhase(next);
  }

  function start() {
    trackEvent("ai_readiness_profile_started");
    transitionTo("profile");
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
    transitionTo("intro", -1);
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
      transitionTo("preview");
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
      transitionTo("report");
      localStorage.removeItem(STORAGE_KEY);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save your report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page} data-testid="ai-readiness-page">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {phase === "report" && report ? (
          <motion.div
            key="report"
            custom={direction}
            variants={activePhaseVariants}
            initial="enter"
            animate="center"
            exit="exit"
            data-testid="ai-readiness-report-transition"
          >
            <AIReadinessReport
              report={report}
              reportToken={reportToken}
              onDownload={() => trackConversion("ai_readiness_pdf_downloaded")}
            />
          </motion.div>
        ) : (
          <motion.div
            key="assessment"
            custom={direction}
            variants={activePhaseVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <PublicHeroEntrance className={styles.frame} data-testid="ai-readiness-experience">
              <div className={styles.topBar} data-hero-step="1">
                <div className={styles.brandLockup}>
                  <span className={styles.brandMark} aria-hidden="true">
                    A
                  </span>
                  <span>Accelerate</span>
                  <span className={styles.brandDivider}>/</span>
                  <span>AI readiness</span>
                </div>
                {phase !== "intro" && (
                  <button type="button" onClick={reset} className={styles.resetButton}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Start over
                  </button>
                )}
              </div>

              <div className={styles.flowMeta} data-hero-step="2">
                <div>
                  <p className={styles.flowLabel}>A practical diagnostic for your business</p>
                  <p className={styles.flowCurrent}>{phaseNames[phase]}</p>
                </div>
                <p className={styles.flowCount}>
                  {phase === "intro"
                    ? "05 MIN · 15 QUESTIONS"
                    : phase === "questions"
                      ? `${String(questionIndex + 1).padStart(2, "0")} / ${readinessQuestions.length}`
                      : `${currentStage + 1} / ${stageOrder.length}`}
                </p>
                <div
                  className={styles.flowTrack}
                  role="progressbar"
                  aria-label="Assessment journey progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(phaseProgress * 100)}
                >
                  <span
                    className={styles.flowFill}
                    style={{ "--progress": phaseProgress } as CSSProperties}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={`${phase}-${phase === "questions" ? questionIndex : "stage"}`}
                  custom={direction}
                  variants={activePhaseVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className={styles.phasePanel}
                  data-testid="ai-readiness-phase"
                  data-phase={phase}
                  data-transition-direction={direction}
                  onAnimationComplete={(definition) => {
                    if (definition !== "center" || !focusAfterTransition.current) return;
                    const heading = headingRef.current;
                    focusAfterTransition.current = false;
                    if (!heading) return;
                    const transitionPanel = heading.closest<HTMLElement>(
                      '[data-testid="ai-readiness-phase"]',
                    );
                    (transitionPanel ?? heading).scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "auto"
                        : "smooth",
                      block: "start",
                    });
                    heading.focus({ preventScroll: true });
                  }}
                >
                  {phase === "intro" && (
                    <section className={styles.intro}>
                      <div className={styles.heroCopy}>
                        <HeroEntranceItem step={1}>
                          <p className={styles.eyebrow}>AI, applied to your real work</p>
                        </HeroEntranceItem>
                        <HeroEntranceItem step={2}>
                          <h1
                            ref={headingRef}
                            tabIndex={-1}
                            className={`${styles.heroTitle} focus-visible:outline-2 focus-visible:outline-offset-4`}
                          >
                            Make AI useful <em>where it counts.</em>
                          </h1>
                        </HeroEntranceItem>
                        <HeroEntranceItem step={3}>
                          <p className={styles.heroDescription}>
                            See where AI can give your team time back, improve the customer
                            experience, or help revenue grow. Get a practical first move based on
                            how your business works today.
                          </p>
                        </HeroEntranceItem>
                        <HeroEntranceItem step={4}>
                          <div className={styles.actionRow}>
                            <Button onClick={start} className={styles.primaryAction}>
                              Start your assessment <ArrowRight className="h-4 w-4" />
                            </Button>
                            <span className={styles.actionNote}>
                              About five minutes · 15 focused questions
                            </span>
                          </div>
                        </HeroEntranceItem>
                        <HeroEntranceItem step={5}>
                          <p className={styles.privacyNote}>
                            <LockKeyhole className="h-3.5 w-3.5" />
                            Your answers stay separate from your contact details unless you choose
                            to save the full report.
                          </p>
                        </HeroEntranceItem>
                      </div>

                      <HeroEntranceItem step={3} className={styles.visualColumn}>
                        <div
                          className={styles.orbitPanel}
                          data-readiness-visual="true"
                          aria-hidden="true"
                        >
                          <div className={styles.orbitGrid} />
                          <div className={styles.orbitStage}>
                            <div className={`${styles.orbitRing} ${styles.orbitRingInner}`} />
                            <div className={styles.orbitRing} />
                            <div className={styles.orbitAxis} />
                            <div className={`${styles.orbitAxis} ${styles.orbitAxisHorizontal}`} />
                            <div className={styles.orbitSweep} />
                            <div className={styles.orbitCore}>
                              <Sparkles className={styles.coreSpark} />
                              <span className={styles.coreTitle}>AI</span>
                              <span className={styles.coreCaption}>readiness</span>
                            </div>
                            {[
                              styles.nodeOne,
                              styles.nodeTwo,
                              styles.nodeThree,
                              styles.nodeFour,
                              styles.nodeFive,
                            ].map((nodeClass, index) => (
                              <span
                                key={readinessDimensions[index]?.key}
                                className={`${styles.orbitNode} ${nodeClass}`}
                              />
                            ))}
                            {readinessDimensions.map((dimension, index) => (
                              <span
                                key={dimension.key}
                                className={`${styles.dimensionTag} ${
                                  [
                                    styles.dimensionOne,
                                    styles.dimensionTwo,
                                    styles.dimensionThree,
                                    styles.dimensionFour,
                                    styles.dimensionFive,
                                  ][index]
                                }`}
                              >
                                {dimension.label}
                              </span>
                            ))}
                          </div>
                          <div className={styles.orbitReadout}>
                            <span>Business signal map</span>
                            <span className={styles.readoutValue}>05 dimensions</span>
                          </div>
                        </div>
                      </HeroEntranceItem>

                      <HeroEntranceItem step={5} className={styles.deliverables}>
                        <div className={styles.deliverable}>
                          <p className={styles.deliverableIndex}>01 / CLARITY</p>
                          <p className={styles.deliverableTitle}>Your readiness profile</p>
                          <p className={styles.deliverableCopy}>
                            Five practical dimensions, grounded in your answers.
                          </p>
                        </div>
                        <div className={styles.deliverable}>
                          <p className={styles.deliverableIndex}>02 / FOCUS</p>
                          <p className={styles.deliverableTitle}>A useful first pilot</p>
                          <p className={styles.deliverableCopy}>
                            A workflow worth testing with your existing tools.
                          </p>
                        </div>
                        <div className={styles.deliverable}>
                          <p className={styles.deliverableIndex}>03 / ACTION</p>
                          <p className={styles.deliverableTitle}>A 30-day plan</p>
                          <p className={styles.deliverableCopy}>
                            A measured next step with clear review points.
                          </p>
                        </div>
                      </HeroEntranceItem>
                    </section>
                  )}

                  {phase === "profile" && (
                    <section className={`${styles.stepSurface} ${styles.formSurface}`}>
                      <p className={styles.stepEyebrow}>01 / Your context</p>
                      <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className={`${styles.stepTitle} focus-visible:outline-2 focus-visible:outline-offset-4`}
                      >
                        Start with your context.
                      </h1>
                      <p className={styles.stepDescription}>
                        This lets the recommendations fit your operating reality. No sensitive
                        information needed.
                      </p>
                      <div className="mt-10 grid gap-6">
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
                          What kind of business do you run?
                          <input
                            value={profile.businessType}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                businessType: event.target.value,
                              }))
                            }
                            placeholder="e.g. home services, law firm, advisory"
                            className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal outline-none transition-colors focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
                          />
                        </label>
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
                          What is your public website?{" "}
                          <span className="font-normal text-[var(--soft)]">Optional</span>
                          <input
                            type="url"
                            value={profile.websiteUrl ?? ""}
                            onChange={(event) =>
                              setProfile((current) => ({
                                ...current,
                                websiteUrl: event.target.value,
                              }))
                            }
                            placeholder="https://yourbusiness.com"
                            inputMode="url"
                            className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal outline-none transition-colors focus:border-black dark:border-white/15 dark:bg-white/[0.04] dark:focus:border-white"
                          />
                          <span className="text-xs font-normal leading-5 text-[var(--soft)]">
                            We check the public homepage for visible SEO, mobile, accessibility,
                            trust, and conversion signals. No login or private pages.
                          </span>
                          {profile.websiteUrl?.trim() &&
                            !/^https?:\/\/[^\s]+$/i.test(profile.websiteUrl.trim()) && (
                              <span role="alert" className="text-xs font-normal text-red-600">
                                Use a full public URL beginning with https:// or http://.
                              </span>
                            )}
                        </label>
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
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
                          <legend className="text-sm font-semibold">
                            What would help most right now?
                          </legend>
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
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
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
                            transitionTo("questions");
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
                    <section className={`${styles.stepSurface} ${styles.questionSurface}`}>
                      <div className={styles.questionMeta}>
                        <p className={styles.stepEyebrow}>02 / Assessment</p>
                        <span className={styles.questionIndex}>
                          {String(questionIndex + 1).padStart(2, "0")}{" "}
                          <span>/ {readinessQuestions.length}</span>
                        </span>
                      </div>
                      <div
                        className={styles.questionProgress}
                        role="progressbar"
                        aria-label={`Assessment progress: question ${questionIndex + 1} of ${readinessQuestions.length}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <span
                          className="block h-full rounded-full bg-[var(--ink)] transition-[width] dark:bg-white"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className={styles.stepEyebrow}>
                        {
                          readinessDimensions.find(
                            (dimension) => dimension.key === question.dimension,
                          )?.label
                        }
                      </p>
                      <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className={`${styles.questionPrompt} focus-visible:outline-2 focus-visible:outline-offset-4`}
                      >
                        {question.prompt}
                      </h1>
                      <p className={styles.questionHelper}>{question.helper}</p>
                      <div className={styles.choices}>
                        {question.options.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAnswer(option.value)}
                            aria-pressed={answered === option.value}
                            className={`${styles.choice} ${answered === option.value ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] dark:border-white dark:bg-white dark:text-black" : "border-black/15 bg-white/60 dark:border-white/15 dark:bg-white/[0.04]"}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className={styles.navigationRow}>
                        <Button
                          type="button"
                          disabled={questionIndex === 0}
                          onClick={() => {
                            focusAfterTransition.current = true;
                            setDirection(-1);
                            setQuestionIndex((current) => current - 1);
                          }}
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
                            onClick={() => {
                              focusAfterTransition.current = true;
                              setDirection(1);
                              setQuestionIndex((current) => current + 1);
                            }}
                            className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
                          >
                            Next <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </section>
                  )}

                  {phase === "preview" && preview && previewRecommendation && (
                    <section className={styles.stepSurface}>
                      <div className={styles.previewSurface}>
                        <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                          Your AI readiness preview
                        </h1>
                        <div
                          className={styles.scoreDial}
                          style={
                            {
                              "--score": `${preview.score ?? preview.coverage}%`,
                            } as CSSProperties
                          }
                          aria-label={`Readiness score: ${preview.score === null ? "not available" : `${preview.score} out of 100`}`}
                        >
                          <p className={styles.scoreValue}>
                            {preview.score === null ? "—" : preview.score}
                            <span>/100</span>
                          </p>
                        </div>
                        <div className={styles.previewCopy}>
                          <p className={styles.previewEyebrow}>Your first signal</p>
                          <h2 className={styles.previewTitle}>{preview.scoreLabel}</h2>
                          <p className={styles.previewSummary}>{preview.summary}</p>
                          <p className="mt-4 text-xs text-white/55">
                            {preview.coverage}% answer coverage · preliminary, based on your answers
                          </p>
                        </div>
                      </div>
                      <div className={`${styles.formSurface} mt-6`}>
                        <p className={styles.stepEyebrow}>The clearest first opportunity</p>
                        <h2 className={styles.stepTitle}>{previewRecommendation.title}</h2>
                        <p className={styles.stepDescription}>{previewRecommendation.summary}</p>
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
                              transitionTo("unlock");
                              trackEvent("ai_readiness_gate_viewed");
                            }}
                            className="bg-[var(--ink)] text-[var(--paper)] dark:bg-white dark:text-black"
                          >
                            Unlock full action plan <LockKeyhole className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              transitionTo("questions", -1);
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
                    <section className={`${styles.stepSurface} ${styles.formSurface}`}>
                      <p className={styles.stepEyebrow}>03 / Your action plan</p>
                      <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className={`${styles.stepTitle} focus-visible:outline-2 focus-visible:outline-offset-4`}
                      >
                        Save the full action plan.
                      </h1>
                      <p className={styles.stepDescription}>
                        Get the complete dimension breakdown, pilot guidance, 30-day plan, and a
                        branded PDF you can share with your team.
                      </p>
                      <div className="mt-8 grid gap-5">
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
                          Your name
                          <input
                            value={contact.name}
                            onChange={(event) =>
                              setContact((current) => ({ ...current, name: event.target.value }))
                            }
                            className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal dark:border-white/15 dark:bg-white/[0.04]"
                          />
                        </label>
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
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
                        <label className={`${styles.field} grid gap-2 text-sm font-semibold`}>
                          Business name
                          <input
                            value={contact.businessName}
                            onChange={(event) =>
                              setContact((current) => ({
                                ...current,
                                businessName: event.target.value,
                              }))
                            }
                            className="min-h-12 rounded-xl border border-black/15 bg-white/60 px-4 font-normal dark:border-white/15 dark:bg-white/[0.04]"
                          />
                        </label>
                        <label className="flex items-start gap-3 text-sm leading-6 text-[var(--soft)]">
                          <input
                            type="checkbox"
                            checked={contact.consentGiven}
                            onChange={(event) =>
                              setContact((current) => ({
                                ...current,
                                consentGiven: event.target.checked,
                              }))
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
                              setContact((current) => ({
                                ...current,
                                marketingConsent: event.target.checked,
                              }))
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
                </motion.div>
              </AnimatePresence>
            </PublicHeroEntrance>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

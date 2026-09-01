"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getUTMParams } from "@/lib/utm";
import { trackConversion } from "@/lib/analytics";
import { RoofingBookingEmbed } from "./RoofingBookingEmbed";

type FormState = {
  email: string;
  companyWebsite: string;
  role: string;
  revenueBand: string;
  primaryLeak: string;
  website: string;
};

const initialForm: FormState = {
  email: "",
  companyWebsite: "",
  role: "",
  revenueBand: "",
  primaryLeak: "",
  website: "",
};

const selectClass =
  "min-h-12 w-full appearance-none rounded-xl border border-white/12 bg-white/[0.055] px-4 text-[15px] text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:border-[#d7ff5f]/70 focus:bg-white/[0.075] focus:shadow-[0_0_0_3px_rgba(215,255,95,0.09)]";

export function RoofingQualifier() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState<"form" | "submitting" | "qualified" | "nurture">("form");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [bookingMode, setBookingMode] = useState<"manual" | "calendly">("manual");
  const started = useRef(false);

  useEffect(() => {
    const resume = new URLSearchParams(window.location.search).get("resume");
    if (!resume) return;
    fetch(`/api/qualify/resume?token=${encodeURIComponent(resume)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { email: string; bookingMode?: "manual" | "calendly" }) => {
        setForm((current) => ({ ...current, email: data.email }));
        setToken(resume);
        setBookingMode(data.bookingMode === "calendly" ? "calendly" : "manual");
        setStatus("qualified");
        requestAnimationFrame(() =>
          document.querySelector("#book")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      })
      .catch(() => undefined);
  }, []);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (!started.current) {
      started.current = true;
      trackConversion("qualifier_started", { funnel: "roofing" });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const response = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, messageVariant: "roofing_v1", utm: getUTMParams() }),
      });
      const data = (await response.json()) as {
        error?: string;
        qualified?: boolean;
        token?: string;
        email?: string;
        bookingMode?: "manual" | "calendly";
      };
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      if (!data.token) throw new Error("We couldn't finish that request. Please try again.");
      setToken(data.token);
      setBookingMode(data.bookingMode === "calendly" ? "calendly" : "manual");
      setStatus(data.qualified ? "qualified" : "nurture");
      trackConversion("qualifier_completed", {
        funnel: "roofing",
        qualified: data.qualified ? 1 : 0,
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Something went wrong.",
      );
      setStatus("form");
    }
  };

  return (
    <div id="book" className="scroll-mt-8">
      <AnimatePresence mode="wait" initial={false}>
        {(status === "form" || status === "submitting") && (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)", transition: { duration: 0.15 } }}
            className="rounded-[28px] bg-[#11120f] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_28px_90px_rgba(0,0,0,0.3)] sm:p-8"
          >
            <div className="mb-7">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#d7ff5f]">
                Check fit · about 60 seconds
              </p>
              <h2 className="text-balance font-display text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                Tell us where the operation needs help.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-sm leading-6 text-white/58">
                We review established roofing and exterior businesses to identify the most useful
                first application of AI, automation, or managed execution.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm text-white/72">Company email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  className={selectClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm text-white/72">Company website</span>
                <input
                  type="text"
                  value={form.companyWebsite}
                  onChange={(event) => update("companyWebsite", event.target.value)}
                  placeholder="yourroofingcompany.com"
                  autoComplete="url"
                  required
                  className={selectClass}
                />
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/72">Your role</span>
                <select
                  value={form.role}
                  onChange={(event) => update("role", event.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">Select role</option>
                  <option value="owner">Owner</option>
                  <option value="founder">Founder</option>
                  <option value="president">President</option>
                  <option value="general_manager">General manager</option>
                  <option value="operations">Operations leader</option>
                  <option value="marketing">Marketing leader</option>
                  <option value="team_member">Team member</option>
                  <option value="vendor">Vendor / agency</option>
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm text-white/72">Annual revenue</span>
                <select
                  value={form.revenueBand}
                  onChange={(event) => update("revenueBand", event.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">Select range</option>
                  <option value="under_1m">Under $1M</option>
                  <option value="1m_3m">$1M–$3M</option>
                  <option value="3m_10m">$3M–$10M</option>
                  <option value="10m_plus">$10M+</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm text-white/72">
                  Where would help matter most?
                </span>
                <select
                  value={form.primaryLeak}
                  onChange={(event) => update("primaryLeak", event.target.value)}
                  required
                  className={selectClass}
                >
                  <option value="">Choose the closest fit</option>
                  <option value="slow_response">Slow response to new inquiries</option>
                  <option value="estimate_followup">Estimates and quotes go quiet</option>
                  <option value="after_hours">After-hours inquiries slip through</option>
                  <option value="scheduling">Too much scheduling back-and-forth</option>
                  <option value="visibility">No clear pipeline or source visibility</option>
                </select>
              </label>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
                className="pointer-events-none absolute -left-[9999px] opacity-0"
              />
            </div>

            {error && (
              <p role="alert" className="mt-5 text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d7ff5f] pl-5 pr-[18px] font-mono text-[11px] font-medium uppercase tracking-[0.13em] text-[#11120f] transition-[scale,background-color,opacity] duration-150 hover:bg-[#e1ff83] active:scale-[0.96] disabled:cursor-wait disabled:opacity-65 sm:w-auto"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking fit
                </>
              ) : (
                <>
                  Request the session <ArrowRight className="size-4" />
                </>
              )}
            </button>
            <p className="mt-4 flex items-center gap-2 text-xs text-white/72">
              <ShieldCheck className="size-4" /> No sales reps. Your information stays with
              Accelerate.
            </p>
          </motion.form>
        )}

        {status === "qualified" && token && (
          <motion.div
            key="qualified"
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)", transition: { duration: 0.15 } }}
          >
            <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#d7ff5f]/24 p-4 shadow-[0_0_0_1px_rgba(114,139,24,0.22)]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#d7ff5f] text-[#11120f]">
                <Check className="size-5" />
              </span>
              <div>
                <p className="font-medium text-[#11120f]">You’re a fit for the strategy session.</p>
                <p className="mt-1 text-sm text-[#11120f]/62">
                  {bookingMode === "calendly"
                    ? "Choose a time below. The session is directly with John."
                    : "John will review the company and reply personally within one business day."}
                </p>
              </div>
            </div>
            {bookingMode === "calendly" ? (
              <RoofingBookingEmbed email={form.email} token={token} />
            ) : (
              <div className="rounded-[28px] bg-[#11120f] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_28px_90px_rgba(0,0,0,0.3)] sm:p-10">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d7ff5f]">
                  Manual review is active
                </p>
                <h2 className="mt-5 text-balance font-display text-3xl font-medium tracking-[-0.035em] text-white sm:text-4xl">
                  John will take it from here.
                </h2>
                <p className="mt-4 max-w-xl text-pretty leading-7 text-white/62">
                  We sent a confirmation to {form.email}. John will review the company and email you
                  personally within one business day with the best next step and times to talk.
                </p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {["Company reviewed", "Personal reply", "Written finding after the call"].map(
                    (item, index) => (
                      <div
                        key={item}
                        className="rounded-xl bg-white/[0.05] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                      >
                        <span className="font-mono text-[9px] tabular-nums text-[#d7ff5f]">
                          0{index + 1}
                        </span>
                        <p className="mt-3 text-pretty text-sm leading-5 text-white/65">{item}</p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {status === "nurture" && (
          <motion.div
            key="nurture"
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="rounded-[28px] bg-[#11120f] p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_28px_90px_rgba(0,0,0,0.3)] sm:p-10"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white/8 text-[#d7ff5f]">
              <Check className="size-5" />
            </span>
            <h2 className="mt-6 text-balance font-display text-3xl font-medium tracking-[-0.035em] text-white">
              Start with the follow-up playbook.
            </h2>
            <p className="mt-4 max-w-xl text-pretty leading-7 text-white/62">
              The managed system is built for established operators with enough inquiry volume to
              support hands-on optimization. We emailed you a practical next step now, and we can
              revisit the audit as the business grows.
            </p>
            <Link
              href="/learn/automate-lead-follow-up"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#11120f] transition-[scale,background-color] duration-150 hover:bg-white/90 active:scale-[0.96]"
            >
              Read the playbook <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

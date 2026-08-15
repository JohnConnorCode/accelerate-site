"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  MessageSquareWarning,
  Inbox,
  Users,
  Columns3,
  Sparkles,
  FileText,
  Check,
  Pencil,
  X,
  Sun,
  Mail,
  Building2,
  Share2,
  FolderKanban,
  CheckSquare,
  Files,
  Newspaper,
  HelpCircle,
  BarChart3,
  History,
  Workflow,
  Plug,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EASE } from "@/lib/animations";
import { ActionModal } from "./ActionModal";
import {
  ACTION_KIND,
  DEMO_ACTIONS,
  DEMO_ANSWERS,
  DEMO_EXTRACTED,
  DEMO_PEOPLE,
  DEMO_PIPELINE,
  DEMO_TRANSCRIPT,
  OVERNIGHT,
  RAIL,
  STUBS,
  type DemoAction,
} from "./demo-data";

/* An interactive mock of the Command Center, with invented data.

   Everything is client state; nothing calls anything. The point is that a
   visitor can work the queue, open a person, ask a question and apply a
   meeting rather than read a paragraph claiming those things are possible.

   Motion is deliberate here: every view enters on a stagger, the rail marker
   slides between tabs, answers stream in word by word. A tool that claims to
   run your business should not feel like a slide deck. All of it collapses to
   plain state changes under prefers-reduced-motion. */

const ICONS: Record<string, LucideIcon> = {
  Sun, Inbox, Mail, Users, Building2, Columns3, Share2, FolderKanban,
  CheckSquare, FileText, Files, Sparkles, Newspaper, HelpCircle, BarChart3,
  History, Workflow, Plug, Settings,
};

const MONO = "font-mono text-[0.62rem] uppercase tracking-[0.16em]";
/* Citations stay sentence case. The uppercase label style turns a quiet
   "here is where this came from" into shouting. */
const CITE = "font-mono text-[0.68rem] tracking-[0.01em]";

/* One motion vocabulary, shared by every view. */
const VIEW: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASE, staggerChildren: 0.05, delayChildren: 0.04 },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE } },
};

export function CommandCenterDemo() {
  const [view, setView] = useState<string>("approvals");
  const [approved, setApproved] = useState(11);
  const [pending, setPending] = useState(DEMO_ACTIONS.length);
  const reduced = useReducedMotion();

  return (
    <div className="cc overflow-hidden border border-white/10 bg-[#0B0B0B] shadow-[0_40px_90px_-40px_rgba(0,0,0,.55)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          </span>
          <span className={`${MONO} truncate text-white/45`}>
            <span className="text-white/75">Command Center</span> / your workspace
          </span>
        </div>
        <span className={`${MONO} shrink-0 border border-white/15 px-2 py-1 text-white/40`}>
          Sample data
        </span>
      </div>

      <div className="grid lg:grid-cols-[212px_1fr]">
        <nav
          aria-label="Command Center sections"
          className="cc-rail flex gap-1 overflow-x-auto border-b border-white/10 p-2 lg:block lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-3"
        >
          {RAIL.map((group) => (
            <div key={group.label} className="contents lg:mb-3 lg:block lg:last:mb-0">
              <p className={`${MONO} hidden px-3 pb-1.5 pt-2 text-white/25 lg:block`}>
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? Inbox;
                const on = view === item.id;
                const count = item.id === "approvals" ? (pending > 0 ? String(pending) : undefined) : item.badge;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    aria-current={on ? "page" : undefined}
                    className={`relative flex shrink-0 items-center gap-2.5 px-3 py-[7px] text-left text-[0.78rem] transition-colors duration-200 lg:w-full ${
                      on ? "text-white" : "text-white/45 hover:text-white/85"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId={reduced ? undefined : "cc-rail-marker"}
                        className="absolute inset-0 bg-white/10"
                        transition={{ duration: 0.3, ease: EASE }}
                        aria-hidden="true"
                      />
                    )}
                    <Icon className="relative h-[15px] w-[15px] shrink-0" strokeWidth={1.75} />
                    <span className="relative whitespace-nowrap">{item.label}</span>
                    {count && (
                      <motion.span
                        key={count}
                        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.26, ease: EASE }}
                        className="relative ml-auto hidden rounded-full bg-white/15 px-1.5 py-0.5 font-mono text-[0.58rem] text-white lg:inline"
                      >
                        {count}
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="min-h-[380px] min-w-0 sm:min-h-[600px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              variants={reduced ? undefined : VIEW}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {view === "approvals" && (
                <Approvals
                  approved={approved}
                  setApproved={setApproved}
                  setPending={setPending}
                />
              )}
              {view === "people" && <People />}
              {view === "pipeline" && <Pipeline />}
              {view === "ask" && <Ask />}
              {view === "meeting" && <Meeting />}
              {STUBS[view] && <Stub id={view} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── approvals ─────────────────────────────────────────────────────────── */

function Approvals({
  approved,
  setApproved,
  setPending,
}: {
  approved: number;
  setApproved: (fn: (n: number) => number) => void;
  setPending: (n: number) => void;
}) {
  const [queue, setQueue] = useState<DemoAction[]>(DEMO_ACTIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"detail" | "feedback">("detail");
  const [taught, setTaught] = useState(0);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => setPending(queue.length), [queue.length, setPending]);

  const resolve = (item: DemoAction, how: "approved" | "skipped") => {
    setQueue((q) => q.filter((x) => x.id !== item.id));
    setOpenId(null);
    setMode("detail");
    setLast(`${how === "approved" ? "Approved" : "Skipped"}: ${item.title}`);
    if (how === "approved") setApproved((n) => n + 1);
  };

  const approveRoutine = () => {
    const routine = queue.filter((q) => q.routine);
    if (routine.length === 0) return;
    setQueue((q) => q.filter((x) => !x.routine));
    setApproved((n) => n + routine.length);
    setLast(`Approved ${routine.length} routine items in one go`);
  };

  const routineLeft = queue.filter((q) => q.routine).length;

  return (
    <div className="flex h-full flex-col">
      <Head
        title={queue.length > 0 ? `${queue.length} waiting on you` : "Queue clear"}
        sub={
          queue.length > 0
            ? "Approve sends it. Edit changes it first. Skip throws it away."
            : "This is what the end of a morning is supposed to look like."
        }
        right={taught > 0 ? `Approved ${approved} / taught it ${taught}` : `Approved today ${approved}`}
      />

      {/* what it did overnight without asking anyone */}
      <motion.ul
        variants={reduced ? undefined : ITEM}
        className="grid grid-cols-2 gap-px border-b border-white/10 bg-white/[0.06] sm:grid-cols-4"
      >
        {OVERNIGHT.map((o) => (
          <li key={o.label} className="bg-[#0B0B0B] px-4 py-3">
            <p className="font-display text-[1.05rem] font-semibold leading-none text-white">{o.n}</p>
            <p className={`${CITE} mt-1.5 text-white/35`}>{o.label}</p>
          </li>
        ))}
      </motion.ul>

      {routineLeft > 1 && (
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-5"
        >
          <button
            type="button"
            onClick={approveRoutine}
            className="border border-white/25 bg-white/[0.08] px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/20"
          >
            Approve {routineLeft} routine
          </button>
          <span className={`${CITE} text-white/35`}>
            The kind that graduates out of this queue first.
          </span>
        </motion.div>
      )}

      <div className="flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          {queue.map((item) => {
            const k = ACTION_KIND[item.kind];
            return (
              <motion.div
                key={item.id}
                layout={!reduced}
                variants={reduced ? undefined : ITEM}
                initial={reduced ? false : "hidden"}
                animate="show"
                exit={reduced ? undefined : { opacity: 0, x: 26, transition: { duration: 0.24, ease: EASE } }}
                className="border-b border-white/[0.07] px-4 py-3.5 sm:px-5"
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
                  <span
                    className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center font-mono text-[0.7rem]"
                    style={{ color: `rgb(${k.rgb})`, background: `rgba(${k.rgb},0.14)` }}
                    aria-hidden="true"
                  >
                    {k.glyph}
                  </span>

                  <button
                    type="button"
                    onClick={() => { setMode("detail"); setOpenId(item.id); }}
                    aria-label={`Open details for ${item.title}`}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[0.9rem] leading-snug text-white underline-offset-4 hover:underline">
                      {item.title}
                      {edited.includes(item.id) && (
                        <span className={`${MONO} ml-2 align-middle text-white/40`}>edited</span>
                      )}
                    </p>
                    <p className="mt-1 text-[0.78rem] leading-snug text-white/45">{item.because}</p>
                    <p className={`${CITE} mt-2 text-white/30`}>{item.source}</p>
                  </button>

                  <div className="flex w-full gap-1.5 pl-[34px] sm:w-auto sm:shrink-0 sm:pl-0">
                    <Btn tone="solid" icon={Check} onClick={() => resolve(item, "approved")}>
                      Approve
                    </Btn>
                    <Btn icon={Pencil} onClick={() => { setMode("detail"); setOpenId(item.id); }}>
                      Edit
                    </Btn>
                    <Btn
                      icon={MessageSquareWarning}
                      onClick={() => { setMode("feedback"); setOpenId(item.id); }}
                    >
                      Feedback
                    </Btn>
                    <Btn icon={X} onClick={() => resolve(item, "skipped")}>
                      Skip
                    </Btn>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {queue.length === 0 && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.15 }}
            className="px-5 py-16 text-center"
          >
            <p className="text-[0.95rem] text-white/80">Nothing left waiting.</p>
            <p className="mx-auto mt-2 max-w-sm text-[0.82rem] leading-relaxed text-white/45">
              It keeps working while the queue is empty. The next batch builds itself out of
              your calls and email as they happen.
            </p>
            <button
              type="button"
              onClick={() => {
                setQueue(DEMO_ACTIONS);
                setEdited([]);
                setBodies({});
                setLast(null);
                setOpenId(null);
              }}
              className="mt-5 border border-white/20 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/40 hover:text-white"
            >
              Refill the demo queue
            </button>
          </motion.div>
        )}
      </div>

      <ActionModal
        action={queue.find((q) => q.id === openId) ?? null}
        body={openId ? bodies[openId] ?? queue.find((q) => q.id === openId)?.draft ?? "" : ""}
        edited={openId ? edited.includes(openId) : false}
        onBody={(v) => {
          if (!openId) return;
          setBodies((b) => ({ ...b, [openId]: v }));
          setEdited((e) => (e.includes(openId) ? e : [...e, openId]));
        }}
        onApprove={() => {
          const it = queue.find((q) => q.id === openId);
          if (it) resolve(it, "approved");
        }}
        onSkip={() => {
          const it = queue.find((q) => q.id === openId);
          if (it) resolve(it, "skipped");
        }}
        mode={mode}
        onFeedback={(reasonLabel, learned) => {
          const it = queue.find((q) => q.id === openId);
          setQueue((q) => q.filter((x) => x.id !== openId));
          setOpenId(null);
          setMode("detail");
          setTaught((n) => n + 1);
          setLast(`Rejected: ${it?.title ?? ""} (${reasonLabel}). ${learned}`);
        }}
        onClose={() => { setOpenId(null); setMode("detail"); }}
      />

      <AnimatePresence>
        {last && (
          <motion.p
            key={last}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={`${CITE} border-t border-white/10 px-4 py-3 text-white/45 sm:px-5`}
          >
            {last}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── people ────────────────────────────────────────────────────────────── */

const TEMP: Record<string, { label: string; rgb: string }> = {
  warm: { label: "Warm", rgb: "163,230,53" },
  cooling: { label: "Cooling", rgb: "251,191,36" },
  cold: { label: "Cold", rgb: "248,113,113" },
};

const TL_ICON: Record<string, string> = {
  "email-in": "←",
  "email-out": "→",
  meeting: "◆",
  note: "★",
  ai: "✦",
};

function People() {
  const [sel, setSel] = useState(DEMO_PEOPLE[0]!.id);
  const person = DEMO_PEOPLE.find((p) => p.id === sel)!;
  const reduced = useReducedMotion();

  return (
    <div>
      <Head title="People" sub="Everything the business knows about someone, in one place." />
      <div className="grid sm:grid-cols-[196px_1fr]">
        <ul className="relative border-b border-white/10 sm:border-b-0 sm:border-r">
          {DEMO_PEOPLE.map((p) => {
            const on = p.id === sel;
            const t = TEMP[p.temp]!;
            return (
              <li key={p.id} className="relative">
                <button
                  type="button"
                  onClick={() => setSel(p.id)}
                  className="relative w-full border-b border-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/5"
                >
                  {on && (
                    <motion.span
                      layoutId={reduced ? undefined : "cc-person-marker"}
                      className="absolute inset-0 bg-white/10"
                      transition={{ duration: 0.3, ease: EASE }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: `rgb(${t.rgb})` }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[0.84rem] text-white">{p.name}</span>
                  </span>
                  <span className={`${CITE} relative mt-1 block truncate text-white/35`}>{p.last}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={person.id}
            variants={reduced ? undefined : VIEW}
            initial="hidden"
            animate="show"
            exit="exit"
            className="min-w-0 p-4 sm:p-5"
          >
            <motion.div
              variants={reduced ? undefined : ITEM}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
            >
              <h4 className="font-display text-[1.15rem] font-semibold text-white">{person.name}</h4>
              <span className="text-[0.8rem] text-white/45">
                {person.role}, {person.company}
              </span>
              <span
                className={`${MONO} ml-auto px-2 py-1`}
                style={{
                  color: `rgb(${TEMP[person.temp]!.rgb})`,
                  background: `rgba(${TEMP[person.temp]!.rgb},0.12)`,
                }}
              >
                {TEMP[person.temp]!.label}
              </span>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>What it has learned</Sub>
              <dl className="space-y-2">
                {person.facts.map((f) => (
                  <div key={f.k} className="grid gap-1 sm:grid-cols-[136px_1fr] sm:gap-3">
                    <dt className={`${CITE} pt-0.5 text-white/35`}>{f.k}</dt>
                    <dd className="text-[0.82rem] leading-snug text-white/75">{f.v}</dd>
                  </div>
                ))}
              </dl>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>Open questions</Sub>
              <ul className="space-y-1.5">
                {person.open.map((q) => (
                  <li key={q} className="flex gap-2 text-[0.82rem] leading-snug text-white/75">
                    <span className="text-white/30" aria-hidden="true">
                      ?
                    </span>
                    {q}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div variants={reduced ? undefined : ITEM}>
              <Sub>History</Sub>
              <ul className="space-y-2.5">
                {person.timeline.map((e, i) => (
                  <li key={i} className="grid grid-cols-[62px_16px_1fr] gap-2">
                    <span className={`${CITE} pt-0.5 text-white/30`}>{e.when}</span>
                    <span
                      className={`pt-0.5 font-mono text-[0.7rem] ${
                        e.kind === "ai" ? "text-[rgb(163,230,53)]" : "text-white/35"
                      }`}
                      aria-hidden="true"
                    >
                      {TL_ICON[e.kind]}
                    </span>
                    <span
                      className={`text-[0.82rem] leading-snug ${
                        e.kind === "ai" ? "italic text-white/55" : "text-white/80"
                      }`}
                    >
                      {e.text}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── pipeline ──────────────────────────────────────────────────────────── */

function Pipeline() {
  const reduced = useReducedMotion();
  return (
    <div>
      <Head
        title="Pipeline"
        sub="Moved by what people actually said, not by you remembering to drag a card."
      />
      <div className="cc-scroll flex gap-3 overflow-x-auto p-4 sm:p-5">
        {DEMO_PIPELINE.map((col) => (
          <motion.div
            key={col.stage}
            variants={reduced ? undefined : ITEM}
            className="w-[214px] shrink-0"
          >
            <p className={`${MONO} mb-2 flex items-center justify-between text-white/40`}>
              {col.stage}
              <span className="text-white/25">{col.deals.length}</span>
            </p>
            <div className="space-y-2">
              {col.deals.map((d) => (
                <motion.div
                  key={d.id}
                  whileHover={reduced ? undefined : { y: -2 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-white/25"
                >
                  <p className="text-[0.84rem] leading-snug text-white">{d.name}</p>
                  <p className="mt-0.5 text-[0.76rem] text-white/45">{d.company}</p>
                  <p className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[0.78rem] text-white">{d.value}</span>
                    <span className={`${CITE} text-white/30`}>{d.age}</span>
                  </p>
                  {d.flag && (
                    <p
                      className={`${MONO} mt-2 inline-block px-1.5 py-0.5`}
                      style={{ color: "rgb(251,191,36)", background: "rgba(251,191,36,0.12)" }}
                    >
                      {d.flag}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── ask ───────────────────────────────────────────────────────────────── */

interface Turn {
  role: "you" | "ai";
  text: string;
  sources?: string[];
}

function Ask() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const reduced = useReducedMotion();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const send = (q: string) => {
    if (!q.trim() || thinking) return;
    const hit = DEMO_ANSWERS.find((a) => a.q.toLowerCase() === q.trim().toLowerCase());
    setTurns((t) => [...t, { role: "you", text: q.trim() }]);
    setInput("");
    setThinking(true);
    timers.current.push(
      setTimeout(() => {
        setTurns((t) => [
          ...t,
          hit
            ? { role: "ai", text: hit.a, sources: hit.sources }
            : {
                role: "ai",
                text: "In the real thing this reads your own records and answers from them, with a source on every claim. This mock only carries a few canned answers, so try one of the suggestions.",
              },
        ]);
        setThinking(false);
      }, 700)
    );
  };

  return (
    <div className="flex h-full min-h-[380px] flex-col sm:min-h-[600px]">
      <Head title="Ask" sub="It answers from your records, and shows you where each answer came from." />

      <div className="cc-scroll flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <AnimatePresence initial={false}>
          {turns.length === 0 && (
            <motion.div
              key="suggestions"
              variants={reduced ? undefined : ITEM}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              {DEMO_ANSWERS.map((a) => (
                <button
                  key={a.q}
                  type="button"
                  onClick={() => send(a.q)}
                  className="border border-white/15 px-3 py-2 text-left text-[0.8rem] text-white/70 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white"
                >
                  {a.q}
                </button>
              ))}
            </motion.div>
          )}

          {turns.map((t, i) =>
            t.role === "you" ? (
              <motion.p
                key={`u${i}`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="ml-auto max-w-[85%] bg-white/10 px-3.5 py-2.5 text-[0.85rem] text-white"
              >
                {t.text}
              </motion.p>
            ) : (
              <motion.div
                key={`a${i}`}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-[92%]"
              >
                <Streamed text={t.text} reduced={!!reduced} />
                {t.sources && (
                  <motion.ul
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduced ? 0 : 0.5, duration: 0.3, ease: EASE }}
                    className="mt-2.5 space-y-1"
                  >
                    {t.sources.map((s) => (
                      <li key={s} className={`${CITE} flex gap-2 text-white/40`}>
                        <span className="text-[rgb(163,230,53)]" aria-hidden="true">
                          ✦
                        </span>
                        {s}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </motion.div>
            )
          )}
        </AnimatePresence>

        {thinking && <Thinking reduced={!!reduced} />}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your business"
          aria-label="Ask the Command Center"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[0.85rem] text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 border border-white/20 px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white/70 transition-colors hover:border-white/45 hover:text-white"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

/** Answers arrive word by word. An answer that appears all at once reads as a
 *  lookup; one that streams reads as something working. */
function Streamed({ text, reduced }: { text: string; reduced: boolean }) {
  const words = text.split(" ");
  if (reduced) return <p className="text-[0.87rem] leading-relaxed text-white/85">{text}</p>;
  return (
    <p className="text-[0.87rem] leading-relaxed text-white/85">
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.018, duration: 0.18 }}
        >
          {w}{i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </p>
  );
}

function Thinking({ reduced }: { reduced: boolean }) {
  return (
    <p className={`${CITE} flex items-center gap-2 text-white/35`}>
      Reading your records
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-white/50"
            animate={reduced ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </span>
    </p>
  );
}

/* ── meeting extraction ────────────────────────────────────────────────── */

function Meeting() {
  const [checked, setChecked] = useState<string[]>(DEMO_EXTRACTED.map((e) => e.id));
  const [applied, setApplied] = useState(false);
  const reduced = useReducedMotion();

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div>
      <Head
        title="Northwind kickoff call"
        sub="It read the transcript and pulled these out. You decide what gets kept."
        right="42 min, Tue 10:02"
      />
      <div className="grid lg:grid-cols-2">
        <motion.div
          variants={reduced ? undefined : ITEM}
          className="border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r"
        >
          <p className={`${MONO} mb-3 text-white/35`}>Transcript</p>
          <div className="space-y-2.5">
            {DEMO_TRANSCRIPT.map((line, i) => (
              <p key={i} className="text-[0.82rem] leading-relaxed">
                <span className={`${MONO} mr-2 text-white/30`}>{line.who}</span>
                <span className="text-white/70">{line.text}</span>
              </p>
            ))}
          </div>
        </motion.div>

        <motion.div variants={reduced ? undefined : ITEM} className="p-4 sm:p-5">
          <p className={`${MONO} mb-3 text-white/35`}>
            Found {DEMO_EXTRACTED.length}, keeping {checked.length}
          </p>
          <ul className="space-y-2">
            {DEMO_EXTRACTED.map((e) => {
              const on = checked.includes(e.id);
              return (
                <li key={e.id}>
                  <motion.button
                    type="button"
                    onClick={() => !applied && toggle(e.id)}
                    disabled={applied}
                    animate={{ opacity: on ? 1 : 0.45 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className={`flex w-full gap-3 border p-3 text-left transition-colors ${
                      on ? "border-white/20 bg-white/[0.05]" : "border-white/10"
                    } ${applied ? "cursor-default" : "hover:border-white/35"}`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border transition-colors ${
                        on ? "border-white/50 bg-white/85 text-black" : "border-white/25"
                      }`}
                      aria-hidden="true"
                    >
                      <AnimatePresence>
                        {on && (
                          <motion.span
                            initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={reduced ? undefined : { scale: 0.4, opacity: 0 }}
                            transition={{ duration: 0.18, ease: EASE }}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="min-w-0">
                      <span className={`${MONO} block text-white/35`}>{e.type}</span>
                      <span className="mt-1 block text-[0.84rem] leading-snug text-white">{e.text}</span>
                      <span className="mt-1.5 block border-l border-white/15 pl-2 text-[0.76rem] italic leading-snug text-white/40">
                        {e.quote}
                      </span>
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setApplied(true)}
              disabled={applied || checked.length === 0}
              className="border border-white/25 bg-white/10 px-3.5 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-white transition-colors hover:border-white/45 disabled:opacity-40"
            >
              {applied ? "Applied" : `Apply ${checked.length} to the records`}
            </button>
            <AnimatePresence>
              {applied && (
                <motion.span
                  initial={reduced ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`${CITE} text-[rgb(163,230,53)]`}
                >
                  Filed. Nothing else was touched.
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── the rest of the system ────────────────────────────────────────────────
   Every rail item resolves to something real. The five core surfaces get a
   purpose-built view; the other fourteen render here from a small data map.
   The alternative was a rail full of dead links, which would say the opposite
   of what the rail is there to say. */

function Stub({ id }: { id: string }) {
  const v = STUBS[id];
  const reduced = useReducedMotion();
  if (!v) return null;
  return (
    <div>
      <Head title={v.title} sub={v.sub} right="Sample data" />
      <motion.div variants={reduced ? undefined : ITEM} className="cc-scroll overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {v.head.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`${MONO} border-b border-white/10 px-4 py-2.5 text-left font-normal text-white/30 sm:px-5 ${
                    i === 0 ? "w-[42%]" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {v.rows.map((r, i) => (
              <motion.tr
                key={i}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: reduced ? 0 : 0.04 * i }}
                className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 align-top text-[0.84rem] leading-snug text-white sm:px-5">
                  <span className="flex items-start gap-2">
                    {r.ai && (
                      <span className="mt-[3px] shrink-0 text-[0.7rem] text-[rgb(163,230,53)]" aria-label="Done by the AI">
                        ✦
                      </span>
                    )}
                    {r.a}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-[0.8rem] leading-snug text-white/50 sm:px-5">{r.b}</td>
                <td className={`${CITE} px-4 py-3 align-top text-white/35 sm:px-5`}>{r.c ?? ""}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
      <motion.p
        variants={reduced ? undefined : ITEM}
        className={`${CITE} border-t border-white/10 px-4 py-3 text-white/30 sm:px-5`}
      >
        <span className="text-[rgb(163,230,53)]" aria-hidden="true">✦</span> marks work the system did on
        its own. Approvals, People, Pipeline, Ask and Meetings are the five built out in full here.
      </motion.p>
    </div>
  );
}

/* ── shared bits ───────────────────────────────────────────────────────── */

function Head({ title, sub, right }: { title: string; sub: string; right?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={reduced ? undefined : ITEM}
      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-white/10 px-4 py-3.5 sm:px-5"
    >
      <div className="min-w-0">
        <h4 className="text-[0.95rem] font-medium text-white">{title}</h4>
        <p className="mt-0.5 text-[0.8rem] text-white/45">{sub}</p>
      </div>
      {right && <span className={`${CITE} shrink-0 text-white/35`}>{right}</span>}
    </motion.div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p className={`${MONO} mb-2.5 mt-5 border-t border-white/[0.07] pt-4 text-white/35`}>{children}</p>
  );
}

function Btn({
  children,
  onClick,
  tone,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "solid";
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[34px] items-center gap-1.5 whitespace-nowrap border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors duration-200 ${
        tone === "solid"
          ? "border-white/35 bg-white/10 text-white hover:bg-white/25"
          : "border-white/12 text-white/50 hover:border-white/35 hover:text-white/90"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={2} />}
      {children}
    </button>
  );
}

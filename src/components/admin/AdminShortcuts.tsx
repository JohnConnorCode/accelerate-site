"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useModalDismiss } from "@/lib/admin/useModalDismiss";

/** How long a `g`-prefix chord stays "armed" waiting for the second key. */
const CHORD_TIMEOUT_MS = 1200;

const GO_TO: Record<string, string> = {
  d: "/admin",
  l: "/admin/leads",
  c: "/admin/clients",
  p: "/admin/proposals",
};

const SHORTCUT_HELP: { keys: string[]; label: string }[] = [
  { keys: ["g", "d"], label: "Go to Dashboard" },
  { keys: ["g", "l"], label: "Go to Leads" },
  { keys: ["g", "c"], label: "Go to Clients" },
  { keys: ["g", "p"], label: "Go to Proposals" },
  { keys: ["n"], label: "New lead (on Leads page)" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["?"], label: "Toggle this help" },
];

/** True when a keystroke should be ignored (typing in a field or a dialog is open). */
function shouldIgnore(target: EventTarget | null): boolean {
  if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
    return true;
  }
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function AdminShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const chordArmedRef = useRef(false);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const closeHelp = useCallback(() => setHelpOpen(false), []);
  useModalDismiss(helpOpen, closeHelp);

  useEffect(() => {
    const disarmChord = () => {
      chordArmedRef.current = false;
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };

    const handler = (e: KeyboardEvent) => {
      // "?" always toggles help, even when only reachable via Shift+/.
      if (e.key === "?" && !shouldIgnore(e.target)) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        disarmChord();
        return;
      }

      // Help overlay is a dialog; its own dismiss hook handles Escape.
      if (helpOpen) return;

      // Never hijack modifier combos (Cmd+K etc. belong to other handlers).
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (shouldIgnore(e.target)) return;

      // Second key of a `g` chord.
      if (chordArmedRef.current) {
        const dest = GO_TO[e.key.toLowerCase()];
        disarmChord();
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      if (e.key === "g") {
        chordArmedRef.current = true;
        if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
        chordTimerRef.current = setTimeout(disarmChord, CHORD_TIMEOUT_MS);
        return;
      }

      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[type="text"]',
        );
        if (input) {
          e.preventDefault();
          input.focus();
        }
        return;
      }

      if (e.key === "n") {
        e.preventDefault();
        if (pathname === "/admin/leads") {
          window.dispatchEvent(new CustomEvent("admin:new-lead"));
        } else {
          router.push("/admin/leads");
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    };
  }, [router, pathname, helpOpen]);

  return (
    <AnimatePresence>
      {helpOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={closeHelp}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm mx-4 glass-prominent rounded-xl border border-border-glass p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-white-primary">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={closeHelp}
                aria-label="Close shortcuts"
                className="text-white-muted transition-colors hover:text-white-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-base)] rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {SHORTCUT_HELP.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-white-secondary">{s.label}</span>
                  <span className="flex items-center gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex min-w-[1.5rem] justify-center rounded border border-border-glass bg-bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-white-primary"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

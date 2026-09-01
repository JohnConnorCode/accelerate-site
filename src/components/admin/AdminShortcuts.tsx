"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAdminNavigation } from "@/components/admin/AdminLink";
import { X } from "lucide-react";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { AdminSurface } from "@/components/admin/AdminSurface";

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
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function AdminShortcuts() {
  const router = useAdminNavigation();
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const chordArmedRef = useRef(false);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const closeHelp = useCallback(() => setHelpOpen(false), []);

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
    <AdminDialog
      open={helpOpen}
      onClose={closeHelp}
      title="Keyboard shortcuts"
      ariaLabel="Keyboard shortcuts"
      maxWidth="sm"
    >
      <AdminSurface padding="lg" className="admin-dialog-surface rounded-[20px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--admin-ink)]">Keyboard Shortcuts</h2>
          <button onClick={closeHelp} aria-label="Close shortcuts" className="admin-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUT_HELP.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-[var(--admin-muted)]">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex min-w-[1.5rem] justify-center rounded-md bg-[var(--admin-surface-subtle)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--admin-ink)] shadow-[var(--admin-shadow-border)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </AdminSurface>
    </AdminDialog>
  );
}

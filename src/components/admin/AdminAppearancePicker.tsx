"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronUp, Moon, Palette, Sparkles, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AdminAppearance = "light" | "dark" | "signal" | "studio";

const appearances: Array<{
  id: AdminAppearance;
  label: string;
  description: string;
  icon: typeof Sun;
  previewClass: string;
}> = [
  { id: "light", label: "Paper", description: "Clear editorial workspace", icon: Sun, previewClass: "bg-[#f3f3f0] text-[#0b0b0b]" },
  { id: "dark", label: "Night", description: "Low-light operating view", icon: Moon, previewClass: "bg-[#10100f] text-[#fbfbfa]" },
  { id: "signal", label: "Signal", description: "Focused violet operations", icon: Sparkles, previewClass: "bg-[#171225] text-[#f3edff]" },
  { id: "studio", label: "Studio", description: "Bright project workspace", icon: Palette, previewClass: "bg-[#f4f7fc] text-[#18233c]" },
];

function isAdminAppearance(theme: string | undefined): theme is AdminAppearance {
  return appearances.some((appearance) => appearance.id === theme);
}

export function AdminAppearancePicker({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentTheme = isAdminAppearance(theme) ? theme : isAdminAppearance(resolvedTheme) ? resolvedTheme : "light";
  const current = appearances.find((appearance) => appearance.id === currentTheme) ?? appearances[0]!;

  // next-themes resolves its stored preference only in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!mounted) return <div className={collapsed ? "size-10" : "min-h-10 w-full"} />;

  return (
    <div ref={rootRef} className={cn("relative", open && "z-30")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-10 items-center rounded-[10px] text-xs text-white/58 transition-[background-color,color,transform] duration-150 hover:bg-white/7 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          collapsed ? "size-10 justify-center px-0" : "w-full justify-between gap-3 px-2.5",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="admin-appearance-picker"
        aria-label={`Appearance: ${current.label}`}
        title={collapsed ? `Appearance: ${current.label}` : undefined}
      >
        <span className="flex min-w-0 items-center gap-3">
          <current.icon className="size-4 shrink-0 text-white/72" aria-hidden="true" />
          {!collapsed && <span className="truncate font-medium">{current.label}</span>}
        </span>
        {!collapsed && <ChevronUp className={cn("size-3.5 shrink-0 text-white/38 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="admin-appearance-picker"
            role="dialog"
            aria-label="Choose admin appearance"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            className={cn(
              "absolute bottom-[calc(100%+0.5rem)] z-[70] overflow-hidden rounded-[18px] bg-[#171716] p-2 text-white shadow-[0_20px_52px_-22px_rgba(0,0,0,0.72)] ring-1 ring-white/10",
              collapsed ? "left-0 w-64" : "left-0 w-full min-w-64",
            )}
          >
            <div className="px-2 pb-2 pt-1">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-white/42">Appearance</p>
              <p className="mt-1 text-[11px] leading-4 text-white/58">One operating system, four focused working environments.</p>
            </div>
            <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Admin appearance">
              {appearances.map((appearance) => {
                const Icon = appearance.icon;
                const selected = appearance.id === currentTheme;
                return (
                  <button
                    key={appearance.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setTheme(appearance.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "group relative min-h-[92px] rounded-[12px] p-2.5 text-left transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      selected ? "bg-white/[0.12]" : "hover:bg-white/[0.07]",
                    )}
                  >
                    <span className={cn("mb-2 flex h-8 items-center rounded-[8px] px-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]", appearance.previewClass)}>
                      <Icon className="size-3.5" aria-hidden="true" />
                      <span className="ml-1.5 h-1.5 w-9 rounded-full bg-current opacity-30" />
                    </span>
                    <span className="block pr-5 text-[11px] font-semibold text-white">{appearance.label}</span>
                    <span className="mt-0.5 block text-[9px] leading-3 text-white/48">{appearance.description}</span>
                    {selected && <Check className="absolute right-2.5 top-[3.25rem] size-3.5 text-white" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

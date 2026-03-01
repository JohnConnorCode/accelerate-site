"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { IntakeOption } from "@/lib/types";

interface ChipSelectProps {
  options: IntakeOption[];
  onConfirm: (values: string[], labels: string[]) => void;
  maxSelections?: number;
  preSelected?: string[];
}

export function ChipSelect({
  options,
  onConfirm,
  maxSelections,
  preSelected = [],
}: ChipSelectProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(preSelected));

  useEffect(() => {
    if (preSelected.length > 0) {
      setSelected(new Set(preSelected));
    }
  }, [preSelected]);

  const toggle = (value: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(value);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const values = Array.from(selected);
    const labels = values
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean) as string[];
    onConfirm(values, labels);
  };

  const atMax = maxSelections ? selected.size >= maxSelections : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {options.map((option, i) => {
          const isSelected = selected.has(option.value);
          const isDisabled = !isSelected && atMax;

          return (
            <motion.button
              key={option.value}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              onClick={() => !isDisabled && toggle(option.value)}
              disabled={isDisabled}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer min-h-[44px]",
                isSelected
                  ? "bg-[var(--glass-gold-bg)] border border-[var(--gold-base)] text-[var(--gold-base)]"
                  : "glass border border-[var(--border-glass)] text-white-primary hover:border-[var(--gold-base)]/40",
                isDisabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {isSelected && <Check className="w-3.5 h-3.5" />}
              {option.label}
            </motion.button>
          );
        })}
      </div>

      {maxSelections && (
        <p className="text-xs text-white-muted">
          {selected.size} of {maxSelections} selected
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: selected.size > 0 ? 1 : 0.4, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className="min-h-[44px]"
        >
          Continue ({selected.size} selected)
        </Button>
      </motion.div>
    </div>
  );
}

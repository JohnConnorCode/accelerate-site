"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { IntakeOption } from "@/lib/types";

interface BubbleButtonsProps {
  options: IntakeOption[];
  onSelect: (value: string, label: string) => void;
}

export function BubbleButtons({ options, onSelect }: BubbleButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (option: IntakeOption) => {
    setSelected(option.value);
    setTimeout(() => {
      onSelect(option.value, option.label);
    }, 300);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, i) => {
        const isSelected = selected === option.value;
        return (
          <motion.button
            key={option.value}
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            onClick={() => handleSelect(option)}
            className={cn(
              "px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
              isSelected
                ? "bg-gold-gradient text-black shadow-[0_0_16px_rgba(var(--accent-rgb),0.3)]"
                : "glass border border-border-glass text-white-primary hover:border-gold/40"
            )}
          >
            {option.label}
            {option.priceHint && (
              <span className={cn(
                "block text-xs mt-0.5",
                isSelected ? "text-black/60" : "text-white-muted"
              )}>
                {option.priceHint}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

interface AmbientOrbsProps {
  count?: number;
  color?: "gold" | "white";
  className?: string;
}

const orbPositions = [
  { top: "15%", left: "10%", size: 280 },
  { top: "60%", right: "8%", size: 220 },
  { top: "35%", left: "55%", size: 180 },
  { top: "80%", left: "25%", size: 240 },
  { top: "10%", right: "30%", size: 160 },
];

export function AmbientOrbs({
  count = 3,
  color = "gold",
  className,
}: AmbientOrbsProps) {
  const orbs = orbPositions.slice(0, Math.min(count, 5));
  const bg =
    color === "gold"
      ? "radial-gradient(circle, rgba(var(--accent-rgb), 0.07) 0%, transparent 70%)"
      : "radial-gradient(circle, rgba(255, 255, 255, 0.03) 0%, transparent 70%)";

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none motion-safe:block motion-reduce:hidden",
        className
      )}
      aria-hidden="true"
    >
      {orbs.map((pos, i) => (
        <div
          key={i}
          className={cn(
            "absolute rounded-full",
            i % 2 === 0 ? "animate-[drift-1_28s_ease-in-out_infinite]" : "animate-[drift-2_25s_ease-in-out_infinite]"
          )}
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            width: pos.size,
            height: pos.size,
            background: bg,
            animationDelay: `${i * -5}s`,
          }}
        />
      ))}
    </div>
  );
}

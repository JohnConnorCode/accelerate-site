import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoProps {
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
  /**
   * The mark is also used inside authenticated products. Keep its animation
   * and letter treatment in this shared component while letting that product
   * choose its own home destination.
   */
  href?: string;
  ariaLabel?: string;
}

const WORD = "ACCELERATE";

export function Logo({
  size = "md",
  className,
  onClick,
  href = "/",
  ariaLabel = "Accelerate home",
}: LogoProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn("logo-link group inline-flex items-center gap-2.5", className)}
    >
      <LogoMark className={size === "sm" ? "h-[14px] w-7" : "h-4 w-8"} />
      {/* Per-letter spans so the wordmark can (a) rise in sequentially on entrance
          and (b) share the chevrons' cascading gold shade-shift on hover. Marked
          aria-hidden; the Link's aria-label carries the accessible name. */}
      <span
        aria-hidden
        className={cn(
          "logo-word font-sans font-bold uppercase",
          size === "sm" ? "text-base" : "text-lg"
        )}
      >
        {WORD.split("").map((ch, i) => (
          <span key={i} className="logo-letter" style={{ "--i": i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </span>
    </Link>
  );
}

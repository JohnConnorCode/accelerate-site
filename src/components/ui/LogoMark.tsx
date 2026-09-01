import { cn } from "@/lib/utils";

/**
 * The Accelerate chevron mark — three stacked chevrons that cascade-shimmer
 * to suggest acceleration. Used next to the ACCELERATE wordmark in the
 * Logo, and shipped as the favicon (src/app/icon.svg) with identical geometry.
 *
 * Animation is pure CSS (`.logo-mark` in globals.css), reduced-motion safe.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 32"
      className={cn("logo-mark", className)}
      width="32"
      height="16"
      fill="var(--gold-base)"
    >
      <defs>
        {/* one chevron — translated three times below at different opacities */}
        <path id="lm-chevron" d="M 0 0 L 14 0 L 22 16 L 14 32 L 0 32 L 8 16 Z" />
      </defs>
      <use
        href="#lm-chevron"
        transform="translate(0,0)"
        className="logo-mark__cv logo-mark__cv--1"
      />
      <use
        href="#lm-chevron"
        transform="translate(18,0)"
        className="logo-mark__cv logo-mark__cv--2"
      />
      <use
        href="#lm-chevron"
        transform="translate(36,0)"
        className="logo-mark__cv logo-mark__cv--3"
      />
    </svg>
  );
}

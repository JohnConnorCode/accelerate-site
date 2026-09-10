import { tenant } from "@/config/tenant";
import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoProps {
  name?: string;
  logoSrc?: string;
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

export function Logo({
  name = tenant.brand.name,
  logoSrc,
  size = "md",
  className,
  onClick,
  href = "/",
  ariaLabel,
}: LogoProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={ariaLabel ?? `${name} home`}
      className={cn("logo-link group inline-flex items-center gap-2.5", className)}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          width={32}
          height={16}
          className={size === "sm" ? "h-[14px] w-7 object-contain" : "h-4 w-8 object-contain"}
        />
      ) : (
        <LogoMark className={size === "sm" ? "h-[14px] w-7" : "h-4 w-8"} />
      )}
      {/* Per-letter spans so the wordmark can (a) rise in sequentially on entrance
          and (b) share the chevrons' cascading gold shade-shift on hover. Marked
          aria-hidden; the Link's aria-label carries the accessible name. */}
      <span
        aria-hidden
        className={cn(
          "logo-word font-sans font-bold uppercase",
          size === "sm" ? "text-base" : "text-lg",
          name.length > 20 && "max-w-[min(45vw,260px)] overflow-hidden",
        )}
      >
        {name
          .toUpperCase()
          .split("")
          .map((ch, i) => (
            <span key={i} className="logo-letter" style={{ "--i": i } as CSSProperties}>
              {ch}
            </span>
          ))}
      </span>
    </Link>
  );
}

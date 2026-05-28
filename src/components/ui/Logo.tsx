import Link from "next/link";
import { cn } from "@/lib/utils";
import { LogoMark } from "./LogoMark";

interface LogoProps {
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function Logo({ size = "md", className, onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn("logo-link group inline-flex items-center gap-2.5", className)}
    >
      <LogoMark className={size === "sm" ? "h-[14px] w-7" : "h-4 w-8"} />
      <span
        className={cn(
          "font-sans font-bold tracking-[0.22em] uppercase text-gold-gradient",
          size === "sm" ? "text-base" : "text-lg"
        )}
      >
        ACCELERATE
      </span>
    </Link>
  );
}

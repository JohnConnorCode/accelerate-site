import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

export function Logo({ size = "md", className, onClick }: LogoProps) {
  return (
    <Link href="/" className={cn("inline-flex items-center", className)} onClick={onClick}>
      <span
        className={cn(
          "font-bold text-gold-gradient tracking-[0.15em] uppercase font-display",
          size === "sm" ? "text-lg" : "text-xl"
        )}
      >
        ACCELERATE
      </span>
    </Link>
  );
}

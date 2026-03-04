"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";

interface ArticleCTAProps {
  slug: string;
  href: string;
  variant: "primary" | "secondary";
  size?: "sm" | "lg";
  className?: string;
  children: React.ReactNode;
}

export function ArticleCTA({
  slug,
  href,
  variant,
  size = "lg",
  className,
  children,
}: ArticleCTAProps) {
  const handleClick = () => {
    trackEvent("Page CTA Click", {
      slug,
      cta_text: typeof children === "string" ? children : "",
      href,
    });
  };

  return (
    <Link href={href} onClick={handleClick}>
      <Button variant={variant} size={size} className={className}>
        {children}
        {variant === "primary" && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>
    </Link>
  );
}

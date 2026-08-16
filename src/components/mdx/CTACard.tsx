"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

interface CTACardProps {
  title: string;
  description: string;
  href?: string;
  buttonText?: string;
}

export function CTACard({
  title,
  description,
  href = "/contact",
  buttonText = "Book a free strategy call",
}: CTACardProps) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/learn/") ? pathname.replace("/learn/", "") : pathname;

  const handleClick = () => {
    trackEvent("CTA Click", { article: slug, cta_text: buttonText, href });
  };

  return (
    <div className="my-8 glass-gold rounded-lg p-6 text-center">
      <h3 className="m-0 font-display text-lg font-semibold text-white-primary">
        {title}
      </h3>
      <p className="mt-2 mb-4 text-sm text-white-secondary">{description}</p>
      <Link
        href={href}
        onClick={handleClick}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-semibold transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.96]"
      >
        {buttonText}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

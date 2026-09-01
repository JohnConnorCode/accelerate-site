"use client";

import Link from "next/link";
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
  buttonText = "Book a free strategy session",
}: CTACardProps) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/learn/") ? pathname.replace("/learn/", "") : pathname;

  const handleClick = () => {
    trackEvent("CTA Click", { article: slug, cta_text: buttonText, href });
  };

  return (
    <aside className="cta-band">
      <h3 className="cta-band-title">{title}</h3>
      <p className="cta-band-copy">{description}</p>
      <Link href={href} onClick={handleClick} className="btn">
        {buttonText}
        <span className="arw" aria-hidden="true">
          →
        </span>
      </Link>
    </aside>
  );
}

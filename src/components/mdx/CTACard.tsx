import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface CTACardProps {
  title: string;
  description: string;
  href?: string;
  buttonText?: string;
}

export function CTACard({
  title,
  description,
  href = "/plan-builder",
  buttonText = "Get Your Free Growth Plan",
}: CTACardProps) {
  return (
    <div className="my-8 glass-gold rounded-lg p-6 text-center">
      <h4 className="m-0 font-display text-lg font-semibold text-white-primary">
        {title}
      </h4>
      <p className="mt-2 mb-4 text-sm text-white-secondary">{description}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-black transition-all hover:brightness-110"
      >
        {buttonText}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

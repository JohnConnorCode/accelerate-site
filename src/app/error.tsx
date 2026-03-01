"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p
          className="text-6xl font-bold text-gold-gradient mb-4"
          style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
        >
          Oops
        </p>
        <h1 className="text-2xl font-bold text-white mb-3">Something Went Wrong</h1>
        <p className="text-white/60 mb-8">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={reset}>
            Try Again
          </Button>
          <Link href="/">
            <Button variant="secondary">Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
